# Futures PnL Calculator

Calculadora estática para estimar el PnL neto de operaciones de futuros LONG y SHORT. Incluye tamaño de posición, fees de entrada y salida, ROI y precio objetivo para un beneficio neto deseado.

## Requisitos

Docker. No es necesario instalar Node.js ni npm en el equipo.

## Desarrollo local con Docker

```sh
docker run --rm -it -p 5173:5173 -v "$PWD":/app -w /app node:22-alpine sh -c "npm install && npm run dev -- --host 0.0.0.0"
```

Abre http://localhost:5173.

## Tests y build

```sh
docker run --rm -v "$PWD":/app -w /app node:22-alpine sh -c "npm ci && npm test && npm run build"
```

El build estático queda en `dist/`.

## GitHub Pages

El workflow `.github/workflows/deploy.yml` corre tests, genera el build y publica automáticamente al hacer push a `main`. En GitHub, habilita **Settings → Pages → Build and deployment → Source: GitHub Actions**. La base de Vite se configura con el nombre de este repositorio (`/pages-test/`) en Actions.

También se puede publicar `dist/` manualmente en Cloudflare Pages, Vercel o Netlify. Para estos proveedores la salida es `dist/`.

## Levantar con Docker Compose

```sh
docker compose up
```

Luego abre http://localhost:5173. Para detenerlo usa `Ctrl+C` y, si se inició en segundo plano, `docker compose down`.
