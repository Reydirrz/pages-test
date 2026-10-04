# Requerimientos y estado

Última actualización: 2026-10-03

## Listo

- [x] App estática React + TypeScript + Vite, sin backend, login ni API externa.
- [x] Selector LONG / SHORT y actualización automática.
- [x] Entry, exit, margin, leverage y fees editables; leverage rápido 10x, 20x, 50x, 80x, 100x y 200x.
- [x] Presets Maker 0.02%, Taker 0.06% y custom.
- [x] Resultado neto prominente con signo, texto de profit/loss y ROI.
- [x] Tamaño nocional, BTC size, gross PnL, fees, movimiento absoluto y porcentual.
- [x] Target exit price para LONG y SHORT resuelto algebraicamente.
- [x] Validación de valores no válidos y campos vacíos.
- [x] Interfaz adaptable a móviles.
- [x] Workflow de GitHub Actions para tests, build y GitHub Pages.
- [x] README con instrucciones de uso dentro de Docker.
- [x] Módulo financiero puro separado de React.

## Pendiente de configuración de despliegue

- [x] Tests y build ejecutados dentro de Docker.
- [ ] Confirmar el nombre del repositorio GitHub si no es `pages-test`; actualizar la base de Pages en `vite.config.ts`.
- [ ] Habilitar GitHub Actions como fuente de GitHub Pages en los ajustes del repositorio.

## Decisiones y correcciones matemáticas

- LONG: `net = btcSize * exit * (1 - exitFeeRate) - positionSize - entryFee`; despejando el target se obtiene la fórmula del SPEC.
- SHORT: `net = positionSize + entryFee - btcSize * exit * (1 + exitFeeRate)`. El precio objetivo se despeja como `(positionSize + entryFee - desiredNetProfit) / (btcSize * (1 + exitFeeRate))`.
- El SPEC no especifica el dominio de fees del solver. Para mantener un denominador LONG positivo se valida `exitFee < 100%`; se rechazan precios objetivo no positivos, que no representan una salida posible.
- El cambio de precio se muestra como el movimiento real (Exit − Entry); la etiqueta favorable/desfavorable se determina además según el lado LONG/SHORT.
- [x] `docker-compose.yml` para levantar el servidor local dentro de Docker.
- [x] Servidor de desarrollo accesible en `http://localhost:5173/` mediante Docker Compose.
