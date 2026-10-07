# Requerimientos y estado

Última actualización: 2026-10-07

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
- [x] En GitHub Pages, bóveda local cifrada AES-GCM-256 con PBKDF2-SHA-256; la contraseña no se almacena y permite conservar el texto cifrado entre refrescos.
- [x] Servicio de firma Bitunix aislado en la red interna Docker; solo la UI se publica en loopback `127.0.0.1`.
- [x] Estimación neta por posición y total agregado a partir de posiciones normalizadas, mark price y fee de cierre editable.
- [x] GitHub Pages pide credenciales y guarda únicamente el texto cifrado en el navegador; se informa claramente que el preflight CORS de Bitunix bloquea la consulta firmada directa.
- [x] Tests offline de normalización, posiciones vacías, error sin mark price, fee de cierre, aggregate, funding y equivalencia con la fórmula del monitor original.

## Pendiente para conexión desde GitHub Pages

- [ ] Bitunix debe permitir CORS desde `https://reydirrz.github.io` para `api-key`, `nonce`, `timestamp`, `sign` y `content-type`, o debe existir un intermediario firmado. El preflight verificado actualmente bloquea la solicitud antes de enviar las credenciales.

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

- [x] Replicar la convención ya validada por el monitor `Trading/bitunix-live-net.py`: neto vivo = `realizedPNL + unrealizedPNL + funding`; no volver a restar `fee` histórica cuando Bitunix ya la refleja en el PnL realizado.
- [x] Mostrar PnL neto total, PnL flotante total y neto estimado al cerrar, con fórmula consistente por fila.
- [x] Conservar nodos de posición entre consultas; no actualizar el estado de posiciones si los valores recibidos no cambiaron.
- [x] Portar el refresco del original: actualizar nodos ya montados y solo pedir a React reconstruir la lista si cambian los IDs de posiciones; conservar los datos durante errores de red transitorios.
- [x] Organizar el helper para revisar de un vistazo: tres totales en una fila y posiciones en filas compactas con diferencia de precio y break-even.
- [x] Mostrar PnL y fee con cuatro decimales (máximo) para comparar contra el panel previo sin ocultar precisión útil.
- El endpoint documentado de posiciones no incluye mark price; el helper lo busca en el ticker. Si falta, la app no muestra una cifra estimada.
- La actualización consulta Bitunix cada 2 segundos desde el helper Docker local; la UI conserva la lista existente durante la consulta y solo modifica cifras que cambian.
- [x] En el monitor Bitunix local, abrir una ventana flotante Picture-in-Picture con PnL agregado, estimado de cierre, posiciones, precio y break-even actualizados en cada consulta.
- El panel no ejecuta órdenes. El modo Docker firma en el helper; Pages cifra su bóveda local con Web Crypto.
- En Pages se almacena solo el ciphertext; en Docker las claves viven en RAM del helper y se borran al desconectar o parar el contenedor.
- La API de Bitunix no permite CORS desde este origen de Pages para sus headers de firma. El helper local de Docker evita exponer credenciales al navegador y al bundle público.
