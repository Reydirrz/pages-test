# Futures PnL Calculator

Calculadora React + TypeScript + Vite para estimar PnL de futuros, con panel de posiciones Bitunix de solo lectura. La interfaz se publica en GitHub Pages; el acceso a credenciales de Bitunix se habilita solo al ejecutar la app localmente con Docker.

## Requisitos

Docker. No es necesario instalar Node.js ni npm en el equipo.

## Desarrollo local con Docker

```sh
docker compose up
```

Abre http://localhost:5173. En la pestaña Bitunix introduce API key y secret de una key configurada con permiso de lectura. Para detenerlo usa `Ctrl+C` o `docker compose down`.

El Compose inicia dos contenedores: la interfaz y un servicio Python pequeño que firma las consultas oficiales de Bitunix. El servicio solo es accesible dentro de la red de Docker; el único puerto publicado es la interfaz y queda ligado a `127.0.0.1`. La API key/secret se conservan en la memoria del servicio para sobrevivir a refrescos de página. No se guardan en localStorage ni en disco y se borran al desconectar o detener el contenedor.

## Tests y build

```sh
docker compose exec -T app npm test
docker compose exec -T app npm run build
```

El build estático queda en `dist/`.

## GitHub Pages

El workflow `.github/workflows/deploy.yml` corre tests, genera el build y publica automáticamente al hacer push a `main`. La fuente de Pages debe ser **Settings → Pages → Build and deployment → Source: GitHub Actions**. Vite construye con la base `/pages-test/`.

El build también se puede publicar manualmente en Cloudflare Pages, Vercel o Netlify usando `dist/`.

## Bitunix en vivo

En local, la interfaz envía la API key/secret al servicio Python del mismo Compose. Ese servicio valida y firma las peticiones a Bitunix y mantiene las credenciales solo en memoria. Actualizar la página conserva la sesión mientras siga vivo el contenedor.

Conectado al monitor local, usa «Ventana flotante» para abrir Picture-in-Picture con el neto estimado, PnL y break-even de las posiciones. La ventana sigue actualizándose cada 2 segundos; requiere una versión reciente de Chrome o Edge.

En GitHub Pages, el panel cifra las credenciales en el navegador con AES-GCM y una contraseña que tú eliges. Solo el texto cifrado queda en `localStorage`; tras refrescar, introduce la contraseña para desbloquear. La contraseña no se guarda. «Borrar credenciales cifradas» elimina la bóveda.

**Límite de conexión de GitHub Pages:** Bitunix requiere los headers firmados `api-key`, `nonce`, `timestamp` y `sign`. Se verificó desde Docker que el preflight `OPTIONS` para `https://reydirrz.github.io` no devuelve permisos CORS para esos headers. El navegador, por tanto, bloquea la consulta y no envía la solicitud firmada. La bóveda cifra y conserva las claves, pero no puede quitar esta restricción del servidor de Bitunix. Para consultar la cuenta hoy, abre `http://localhost:5173` con Docker Compose, donde el helper local firma las solicitudes. El workflow sigue publicando la UI en `main`.

El servicio local llama a estos endpoints oficiales desde Docker y combina posiciones con mark price:

- `GET /api/v1/futures/position/get_pending_positions`
- `GET /api/v1/futures/market/tickers?symbols=...`

## Seguridad y cálculo

En Pages, el formato guardado es AES-GCM-256 con una clave derivada por PBKDF2-SHA-256 (600.000 iteraciones); la contraseña maestra no se persiste. Esto protege el archivo guardado en el navegador, pero no vuelve posible la llamada directa si Bitunix bloquea CORS. Usa una clave Bitunix restringida a lectura y borra la bóveda si compartes el dispositivo.

En Docker, la firma se genera conforme a la fórmula oficial SHA256 doble de Bitunix. El servicio no publica un puerto propio al host ni escribe claves en logs/disco. `docker compose down` detiene el servicio y borra su memoria.

- El monitor replica la fórmula que ya validaste en `Trading/bitunix-live-net.py`: `realizedPNL + unrealizedPNL + funding`; las fees históricas que Bitunix ya refleja en `realizedPNL` no se vuelven a restar.
- Estimación al cerrar: exactamente como el original, `realizedPNL + unrealizedPNL + funding - (qty × markPrice × closingFeePercent / 100)`.
- El agregado superior es exactamente la suma de los netos individuales.
