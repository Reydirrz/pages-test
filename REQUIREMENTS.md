# Requerimientos y estado

Última actualización: 2026-10-04

## Listo

- [x] Calculadora estática React + TypeScript + Vite; helper Python local en Docker para la conexión Bitunix firmada.
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
- [x] Formulario de API key/secret solo en localhost; las claves viven en memoria del servicio Docker, persisten al refrescar y se borran al desconectar o detener el contenedor.
- [x] Servicio de firma Bitunix aislado en la red interna Docker; solo la UI se publica en loopback `127.0.0.1`.
- [x] Estimación neta por posición y total agregado a partir de posiciones normalizadas, mark price y fee de cierre editable.
- [x] GitHub Pages no solicita ni recibe claves; muestra cómo iniciar la versión local con Docker.
- [x] Tests offline de normalización, posiciones vacías, error sin mark price, fee de cierre, aggregate, funding y variantes de realized PnL gross/net.

## Pendiente para validar contra una cuenta real

- [ ] Validar los importes de una cuenta real contra UI/historial Bitunix. No se usaron credenciales ni datos reales en este cambio; se sigue el esquema oficial documentado.

## Decisiones y correcciones matemáticas

- LONG: `net = btcSize * exit * (1 - exitFeeRate) - positionSize - entryFee`; despejando el target se obtiene la fórmula del SPEC.
- SHORT: `net = positionSize + entryFee - btcSize * exit * (1 + exitFeeRate)`. El precio objetivo se despeja como `(positionSize + entryFee - desiredNetProfit) / (btcSize * (1 + exitFeeRate))`.
- El SPEC no especifica el dominio de fees del solver. Para mantener un denominador LONG positivo se valida `exitFee < 100%`; se rechazan precios objetivo no positivos, que no representan una salida posible.
- El cambio de precio se muestra como el movimiento real (Exit − Entry); la etiqueta favorable/desfavorable se determina además según el lado LONG/SHORT.
- [x] `docker-compose.yml` para levantar interfaz y helper seguro local, sin dependencias instaladas en el host.
- [x] Interfaz accesible solo en `http://localhost:5173/`; el helper Python no publica puerto en el host.

## Convención Bitunix y límites

- La documentación oficial indica que `realizedPNL` excluye transaction fee y funding; el helper calcula `realizedPNL - fee - funding` antes de sumar unrealized PnL y restar el fee de cierre.
- El endpoint documentado de posiciones no incluye mark price; el helper lo busca en el ticker. Si falta, la app no muestra una cifra estimada.
- La actualización consulta Bitunix cada 2 segundos desde el helper Docker local.
- El panel no ejecuta órdenes ni firma requests en frontend. Pages muestra instrucciones para usar Docker localmente; el modo local consulta en solo lectura.
- Las claves nunca se guardan en localStorage, cookies, logs o disco. Se conservan en RAM del helper para sobrevivir a refrescos y se borran al desconectar o parar el contenedor.
- La API de Bitunix no permite CORS desde este origen de Pages para sus headers de firma. El helper local de Docker evita exponer credenciales al navegador y al bundle público.
