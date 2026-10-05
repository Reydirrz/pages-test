# Futures PnL Calculator

App estática React + TypeScript + Vite para estimar PnL de futuros. Incluye la calculadora simuladora original y un panel de posiciones abiertas Bitunix en modo solo lectura.

## Requisitos

Docker. No es necesario instalar Node.js ni npm en el equipo.

## Desarrollo local con Docker

```sh
docker compose up
```

Abre http://localhost:5173. Para detenerlo usa `Ctrl+C` o `docker compose down`.

## Tests y build

```sh
docker compose exec -T app npm test
docker compose exec -T app npm run build
```

El build estático queda en `dist/`.

## GitHub Pages

El workflow `.github/workflows/deploy.yml` corre tests, genera el build y publica automáticamente al hacer push a `main`. La fuente de Pages debe ser **Settings → Pages → Build and deployment → Source: GitHub Actions**. Vite construye con la base `/pages-test/`.

El build también se puede publicar manualmente en Cloudflare Pages, Vercel o Netlify usando `dist/`.

## Bitunix en vivo: proxy requerido

GitHub Pages es estático y no puede guardar un API secret. El panel por eso **no solicita ni almacena credenciales** y solo hace GET a un endpoint proxy configurado por ti. El proxy debe vivir en infraestructura tuya, firmar las llamadas Bitunix en el servidor y guardar la API key/secret como secrets privados. Usa una key restringida a lectura; no habilites trading ni retiros.

Configura `VITE_BITUNIX_PROXY_URL` con la URL pública del endpoint en el entorno de build (por ejemplo, en `.env.local` durante desarrollo o en las variables de tu pipeline). La URL del proxy no es una credencial y queda embebida en el sitio; nunca pongas keys o secrets en variables `VITE_*`. `.env.local` está ignorado por Git. El panel también permite escribir temporalmente la URL mientras la página está abierta; no la persiste.

El endpoint GET debe responder JSON con este contrato:

```json
{
  "fetchedAt": "2026-10-04T12:00:00.000Z",
  "realizedPnlMode": "gross",
  "positions": [
    {
      "positionId": "position-id",
      "symbol": "BTCUSDT",
      "side": "LONG",
      "qty": "0.01",
      "avgOpenPrice": "60000",
      "markPrice": "61000",
      "unrealizedPNL": "1.50",
      "realizedPNL": "0.00",
      "fee": "0.10",
      "funding": "-0.02",
      "liqPrice": "0",
      "marginRate": "0.01",
      "leverage": 10
    }
  ]
}
```

`realizedPnlMode` es `gross` por defecto y coincide con la documentación actual de Bitunix, que especifica que `realizedPNL` excluye comisiones y funding. En ese modo el estimador resta esos costes una vez. Si tu proxy verifica con el historial que `realizedPNL` ya es neto, debe devolver `"realizedPnlMode": "net"`; el estimador no volverá a restar fee/funding. El endpoint debe incluir el mark price de cada posición o `tickers: [{ "symbol": "BTCUSDT", "markPrice": "61000" }]` para que el adaptador lo asocie. Si no hay precio actual, la app falla cerrada y no calcula una cifra parcial.

Por posición se calcula:

- Modo `gross`: `realizedPNL - fee - funding + unrealizedPNL - (abs(qty × markPrice) × closingFeePercent / 100)`.
- Modo `net`: `realizedPNL + unrealizedPNL - feeDeCierreEstimado`.
- El agregado superior es exactamente la suma de los netos individuales.

El navegador consulta el proxy con GET cada 2 segundos por defecto (configurable a 5, 10 o 30) y sin cookies. Si el proxy requiere acceso, el panel admite un **token independiente del proxy** en un campo temporal: se conserva solo en memoria mientras la página está abierta, se envía como `Authorization: Bearer` únicamente a la URL configurada y se borra al desconectar. No es la API key de Bitunix. El proxy debe autenticar al usuario; CORS no es autenticación y por sí solo no protege datos de cuenta. Además, acepta CORS solo para `https://reydirrz.github.io` y el origen local de desarrollo que uses; permite GET/OPTIONS, `Accept` y `Authorization`, y no registra headers ni secretos. El servidor puede consultar `GET /api/v1/futures/position/get_pending_positions` y `GET /api/v1/futures/market/tickers?symbols=...` en `https://fapi.bitunix.com`, fusionando ticker `markPrice` con posiciones.

Este repositorio contiene el frontend configurable, el contrato del proxy y tests con fixtures. No incluye ni despliega proxy, API key o secret; una conexión real requiere configurar un proxy propio.
