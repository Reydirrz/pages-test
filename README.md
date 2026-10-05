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

En local, la interfaz envía la API key/secret al servicio Python del mismo Compose. Ese servicio valida y firma las peticiones a Bitunix y mantiene las credenciales solo en memoria. Usa una API key con permiso de lectura únicamente; no habilites trading ni retiros. Actualizar la página conserva la sesión mientras siga vivo el contenedor. El botón «Desconectar y borrar claves» borra la sesión; `docker compose down` también la elimina.

GitHub Pages no pide ni recibe las credenciales. Bitunix requiere headers firmados (`api-key`, `nonce`, `timestamp`, `sign`) y su API no permite CORS desde el navegador; una página estática no puede saltarse esa regla. Por eso el panel alojado muestra cómo abrir la versión local. El workflow sigue publicando automáticamente la calculadora y el panel seguro en `main`.

El servicio local llama a estos endpoints oficiales desde Docker y combina posiciones con mark price:

- `GET /api/v1/futures/position/get_pending_positions`
- `GET /api/v1/futures/market/tickers?symbols=...`

## Seguridad y cálculo

La firma se genera en el servicio Docker conforme a la fórmula oficial SHA256 doble de Bitunix. No se envían credenciales al bundle de Pages. El servicio no publica un puerto propio al host ni escribe claves en logs/disco. `docker compose down` detiene el servicio y borra su memoria.

- `realizedPNL` excluye fee y funding según la documentación de Bitunix, así que el neto acumulado se calcula como `realizedPNL - fee - funding`.
- Estimación al cerrar: `realized neto + unrealizedPNL - (abs(qty × markPrice) × closingFeePercent / 100)`.
- El agregado superior es exactamente la suma de los netos individuales.
