"""Local-only Bitunix read proxy. Credentials live in process memory only."""
from __future__ import annotations

import hashlib
import json
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

HOST, PORT = "0.0.0.0", 8765  # Docker-internal only; Compose does not publish this port.
BASE_URL = "https://fapi.bitunix.com"
_lock = threading.Lock()
_credentials: tuple[str, str] | None = None


def sign_request(nonce: str, timestamp: str, api_key: str, api_secret: str,
                 query_params: str = "", body: str = "") -> str:
    """Bitunix REST signature: SHA256(SHA256(nonce+ts+key+query+body)+secret)."""
    first = hashlib.sha256((nonce + timestamp + api_key + query_params + body).encode()).hexdigest()
    return hashlib.sha256((first + api_secret).encode()).hexdigest()


def _json_request(url: str, headers: dict[str, str] | None = None) -> dict:
    request = Request(url, headers=headers or {}, method="GET")
    with urlopen(request, timeout=10) as response:
        result = json.load(response)
    if not isinstance(result, dict) or result.get("code") != 0:
        message = result.get("msg", "respuesta no válida") if isinstance(result, dict) else "respuesta no válida"
        raise RuntimeError(f"Bitunix: {message}")
    return result


def _positions_with_credentials(api_key: str, api_secret: str) -> dict:
    nonce = secrets.token_hex(16)
    timestamp = str(int(time.time() * 1000))
    signature = sign_request(nonce, timestamp, api_key, api_secret)
    headers = {
        "api-key": api_key,
        "nonce": nonce,
        "timestamp": timestamp,
        "sign": signature,
        "language": "en-US",
        "Content-Type": "application/json",
    }
    positions_result = _json_request(
        f"{BASE_URL}/api/v1/futures/position/get_pending_positions", headers
    )
    raw_positions = positions_result.get("data") or []
    if not isinstance(raw_positions, list):
        raise RuntimeError("Bitunix devolvió un formato de posiciones inesperado.")

    symbols = sorted({str(p.get("symbol", "")) for p in raw_positions if p.get("symbol")})
    tickers: list[dict] = []
    if symbols:
        query = urlencode({"symbols": ",".join(symbols)})
        tickers_result = _json_request(f"{BASE_URL}/api/v1/futures/market/tickers?{query}")
        tickers = tickers_result.get("data") or []
        if not isinstance(tickers, list):
            raise RuntimeError("Bitunix devolvió un formato de precios inesperado.")

    return {
        "positions": raw_positions,
        "tickers": tickers,
        "realizedPnlMode": "gross",
        "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def set_credentials(api_key: str, api_secret: str) -> None:
    global _credentials
    with _lock:
        _credentials = (api_key, api_secret)


def clear_credentials() -> None:
    global _credentials
    with _lock:
        _credentials = None


def get_positions() -> dict:
    with _lock:
        credentials = _credentials
    if credentials is None:
        raise PermissionError("Conecta tu API key y secret de solo lectura.")
    return _positions_with_credentials(*credentials)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        # Never log request bodies, headers, or upstream URLs that may contain account data.
        return

    def _answer(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("Solicitud inválida.") from None
        if length <= 0 or length > 4096:
            raise ValueError("Solicitud vacía o demasiado grande.")
        try:
            result = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ValueError("Formato JSON inválido.") from None
        if not isinstance(result, dict):
            raise ValueError("Formato de credenciales inválido.")
        return result

    def do_GET(self) -> None:
        if self.path == "/api/status":
            with _lock:
                connected = _credentials is not None
            self._answer(200, {"connected": connected})
            return
        if self.path == "/api/positions":
            try:
                self._answer(200, get_positions())
            except PermissionError as error:
                self._answer(401, {"error": str(error)})
            except (HTTPError, URLError, TimeoutError, RuntimeError, ValueError) as error:
                self._answer(502, {"error": str(error)})
            return
        self._answer(404, {"error": "Ruta no encontrada."})

    def do_POST(self) -> None:
        if self.path == "/api/disconnect":
            clear_credentials()
            self._answer(200, {"ok": True})
            return
        if self.path != "/api/connect":
            self._answer(404, {"error": "Ruta no encontrada."})
            return
        try:
            data = self._read_body()
            api_key = data.get("apiKey")
            api_secret = data.get("apiSecret")
            if not isinstance(api_key, str) or not api_key.strip() or not isinstance(api_secret, str) or not api_secret.strip():
                raise ValueError("Introduce API key y API secret.")
            pair = (api_key.strip(), api_secret.strip())
            # Validate before retaining; a failed key is never left in memory.
            _positions_with_credentials(*pair)
            set_credentials(*pair)
            self._answer(200, {"ok": True})
        except (HTTPError, URLError, TimeoutError, RuntimeError, ValueError) as error:
            clear_credentials()
            self._answer(401, {"error": str(error)})


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("Bitunix local-only service ready on Docker network", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        clear_credentials()
        server.server_close()
