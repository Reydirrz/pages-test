# Requerimientos y estado

Última actualización: 2026-10-04

## Listo

- [x] App estática React + TypeScript + Vite, sin backend, login ni conexión Bitunix directa desde el navegador.
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
- [x] Configurar `pages-test` como base de GitHub Pages en `vite.config.ts`.
- [x] Habilitar GitHub Actions como fuente de GitHub Pages en los ajustes del repositorio.
- [x] Despliegue automático confirmado en `https://reydirrz.github.io/pages-test/`.
- [x] Mostrar precio de break-even neto con fees incluidos y distancia favorable del exit actual.
- [x] Tests LONG y SHORT validan que el precio break-even retorna net PnL de cero.
- [x] Navegación entre la calculadora original y un panel independiente «Bitunix en vivo».
- [x] UI configurable para GET a proxy del usuario, intervalo mínimo de 2 segundos, latencia, última consulta, errores y estado de conexión.
- [x] Estimación neta por posición y total agregado a partir de posiciones normalizadas, mark price y fee de cierre editable.
- [x] No se solicita ni persiste API key/secret en el navegador; `VITE_BITUNIX_PROXY_URL` solo contiene la URL pública del proxy. El token opcional del proxy es distinto, vive en memoria y se borra al desconectar.
- [x] Tests offline de normalización, posiciones vacías, error sin mark price, fee de cierre, aggregate, funding y variantes de realized PnL gross/net.

## Pendiente para conectar una cuenta Bitunix real

- [ ] Implementar y desplegar un proxy propio que firme requests en servidor y guarde la API key/secret como secrets (no está incluido en este repo).
- [ ] Restringir la API key de Bitunix a lectura y permitir CORS únicamente para GitHub Pages y el origen local de desarrollo elegido.
- [ ] Configurar `VITE_BITUNIX_PROXY_URL` en el entorno de build para que Pages apunte al proxy.
- [ ] Validar los importes de una cuenta real contra UI/historial Bitunix. No se usaron credenciales ni datos reales en este cambio; se sigue el esquema oficial documentado.

## Decisiones y correcciones matemáticas

- LONG: `net = btcSize * exit * (1 - exitFeeRate) - positionSize - entryFee`; despejando el target se obtiene la fórmula del SPEC.
- SHORT: `net = positionSize + entryFee - btcSize * exit * (1 + exitFeeRate)`. El precio objetivo se despeja como `(positionSize + entryFee - desiredNetProfit) / (btcSize * (1 + exitFeeRate))`.
- El SPEC no especifica el dominio de fees del solver. Para mantener un denominador LONG positivo se valida `exitFee < 100%`; se rechazan precios objetivo no positivos, que no representan una salida posible.
- El cambio de precio se muestra como el movimiento real (Exit − Entry); la etiqueta favorable/desfavorable se determina además según el lado LONG/SHORT.
- [x] `docker-compose.yml` para levantar el servidor local dentro de Docker.
- [x] Servidor de desarrollo accesible en `http://localhost:5173/` mediante Docker Compose.

## Convención Bitunix y límites

- La documentación oficial de posiciones indica que `realizedPNL` excluye transaction fee y funding; la normalización usa por defecto `realizedPnlMode: gross` y calcula `realizedPNL - fee - funding` antes de sumar unrealized PnL y restar el fee estimado de cierre.
- Para respuestas de proxy verificadas contra el historial donde realized PnL ya incluya esos costes, `realizedPnlMode: net` evita restarlos una segunda vez.
- El endpoint documentado de posiciones no incluye mark price; el proxy debe fusionarlo desde tickers (`markPrice`). Si falta, la app no muestra una cifra estimada para evitar un total engañoso.
- Bitunix documenta 10 solicitudes/s/UID para posiciones y 10 solicitudes/s/IP para tickers. El polling predeterminado del navegador es cada 2 segundos; el proxy debe limitar también cualquier fan-out a upstream.
- El panel no ejecuta órdenes y no firma requests en frontend. Sin un proxy seguro configurado, muestra el estado desconectado y no puede leer posiciones reales.
- CORS limita orígenes de navegador, pero no autentica al usuario ni evita solicitudes fuera del navegador; el proxy debe autorizar acceso a cada cuenta y no exponer un endpoint anónimo con datos privados.
