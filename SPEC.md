# Trading Futures Profit Simulator

## 1. Objetivo

Construir una aplicación web simple para calcular el beneficio o pérdida neta de una operación de futuros, especialmente BTCUSDT.

La aplicación debe responder de forma inmediata a preguntas como:

"Si entro con 100 USDT de margen, 80x, en 84,600 y cierro en 85,100, ¿cuánto dinero neto me queda después de fees?"

La prioridad principal es mostrar el RESULTADO NETO de forma clara, rápida y grande.

---

# 2. Stack

Usar:

- React
- TypeScript
- Vite
- CSS simple o Tailwind CSS
- Vitest para unit tests

No usar:

- Backend
- Base de datos
- Login
- Redux
- Docker
- API externa para V1

Debe ser una aplicación completamente estática.

---

# 3. Funcionalidad principal

La aplicación debe permitir seleccionar:

- LONG
- SHORT

Inputs:

- Entry Price
- Exit Price
- Margin
- Leverage
- Entry Fee %
- Exit Fee %

Valores iniciales sugeridos:

- Margin: 100
- Leverage: 80
- Entry Fee: 0.06%
- Exit Fee: 0.06%

Agregar botones rápidos de leverage:

- 10x
- 20x
- 50x
- 80x
- 100x
- 200x

Agregar presets de fees:

- Maker: 0.02%
- Taker: 0.06%
- Custom

Los fees deben ser editables.

---

# 4. Resultado principal

El resultado más importante debe aparecer grande en pantalla:

NET PROFIT

Ejemplo:

+37.69 USDT

Si es pérdida:

-25.32 USDT

Debe diferenciar visualmente profit y loss.

No depender únicamente de color para comunicar profit/loss.

Agregar también signo + o -.

---

# 5. Cálculos

## Position Size

positionSize = margin * leverage

Ejemplo:

100 USDT * 80x = 8,000 USDT

---

## BTC Position Size

btcSize = positionSize / entryPrice

Ejemplo:

8000 / 84600 = 0.09456265 BTC

---

# 6. Gross PnL

## LONG

grossPnL = btcSize * (exitPrice - entryPrice)

## SHORT

grossPnL = btcSize * (entryPrice - exitPrice)

---

# 7. Fees

## Entry Fee

entryFee = positionSize * entryFeeRate

entryFeeRate debe convertirse de porcentaje a decimal.

Ejemplo:

0.06% = 0.0006

---

## Exit Notional

exitNotional = btcSize * exitPrice

---

## Exit Fee

exitFee = exitNotional * exitFeeRate

---

## Total Fees

totalFees = entryFee + exitFee

---

# 8. Net PnL

netPnL = grossPnL - totalFees

Este debe ser el valor principal mostrado.

---

# 9. ROI

roi = (netPnL / margin) * 100

Mostrar:

ROI on Margin: +XX.XX%

---

# 10. Price Movement

Mostrar diferencia absoluta:

priceMovement = exitPrice - entryPrice

Para LONG:

84,600 -> 85,100
Movement: +500

Para SHORT, mostrar también el movimiento real del precio, pero indicar que fue favorable o desfavorable.

---

# 11. Price Movement %

priceMovementPercent =
((exitPrice - entryPrice) / entryPrice) * 100

Ejemplo:

84,600 -> 85,100

+0.591%

---

# 12. Datos que debe mostrar

Mostrar siempre:

- Side
- Entry Price
- Exit Price
- Price Movement
- Price Movement %
- Margin
- Leverage
- Position Size
- BTC Size
- Gross PnL
- Entry Fee
- Exit Fee
- Total Fees
- Net PnL
- ROI on Margin

---

# 13. Target Profit Calculator

Agregar una segunda función.

El usuario puede introducir:

- Entry Price
- Margin
- Leverage
- Fees
- Desired Net Profit
- LONG / SHORT

Ejemplo:

Entry: 84,600
Margin: 100
Leverage: 80x
Desired Net Profit: 20 USDT

La app debe responder:

Target Exit Price: XXXXX.XX

Debe calcular el precio aproximado necesario para obtener ese beneficio NETO después de fees.

Debe funcionar para LONG y SHORT.

Preferiblemente resolverlo matemáticamente, no mediante aproximaciones visuales.

---

# 14. Target Price Solver

Para LONG:

btcSize = positionSize / entryPrice

entryFee = positionSize * entryFeeRate

Queremos resolver exitPrice.

netProfit =
btcSize * (exitPrice - entryPrice)
- entryFee
- (btcSize * exitPrice * exitFeeRate)

Resolver para exitPrice.

Simplificado:

target =
(desiredNetProfit + entryFee + btcSize * entryPrice)
/
(btcSize * (1 - exitFeeRate))

Validar matemáticamente esta fórmula con tests.

Para SHORT hacer la fórmula equivalente.

---

# 15. UX

Debe ser extremadamente rápido de usar.

Desktop y mobile.

No obligar al usuario a presionar "Calculate" si no es necesario.

Ideal:

Cada cambio en un input recalcula automáticamente.

Layout sugerido:

--------------------------------

Trading Futures Simulator

[ LONG ] [ SHORT ]

Entry
[ 84600 ]

Exit
[ 85100 ]

Margin
[ 100 ]

Leverage
[ 20x ][50x][80x][100x][200x]

Fees
Entry [0.06]
Exit  [0.06]

--------------------------------

NET PROFIT

+37.XX USDT

--------------------------------

Position Size: 8,000 USDT
BTC Size: 0.09456 BTC
Movement: +500
Movement: +0.591%
Gross PnL: +47.28
Fees: -9.XX
ROI: +37.XX%

--------------------------------

---

# 16. Validation

No permitir:

- Margin <= 0
- Leverage <= 0
- Entry <= 0
- Exit <= 0
- Negative fees

Mostrar errores claros.

No romper la app con campos vacíos.

---

# 17. Precision

Internamente usar números con suficiente precisión.

Mostrar:

Prices:
2 decimales

USDT:
2 decimales

BTC size:
hasta 8 decimales

Percentage:
2 o 3 decimales según contexto

No redondear prematuramente durante los cálculos.

---

# 18. Important financial behavior

No asumir que:

Margin = Position Size

Position Size siempre debe ser:

margin * leverage

El PnL debe calcularse usando BTC size real.

No calcular simplemente:

margin * leverage * percent movement

aunque matemáticamente pueda aproximarse.

Usar la posición real para mantener precisión con fees y precio de salida.

---

# 19. Tests obligatorios

Crear unit tests.

Test 1:

LONG

Entry: 84600
Exit: 85100
Margin: 100
Leverage: 80
Entry fee: 0.06%
Exit fee: 0.06%

Validar:

- Position size
- BTC size
- Gross PnL
- Total fees
- Net PnL

---

Test 2:

SHORT

Entry: 85100
Exit: 84600
Margin: 100
Leverage: 80
Fees: 0.06 / 0.06

---

Test 3:

Entry = Exit

Debe producir pérdida únicamente por fees.

---

Test 4:

Fees = 0

Net PnL debe ser igual a Gross PnL.

---

Test 5:

Target Profit Calculator

Introducir target net profit.

Tomar el precio resultante y volver a pasarlo por el calculador normal.

El resultado neto debe coincidir con el target dentro de una tolerancia pequeña.

---

# 20. Arquitectura sugerida

src/
  components/
    TradeForm.tsx
    ResultCard.tsx
    LeverageSelector.tsx
    FeeSelector.tsx
    TargetProfitCalculator.tsx

  lib/
    futuresCalculator.ts

  types/
    trading.ts

  App.tsx
  main.tsx

tests/
  futuresCalculator.test.ts

---

# 21. Functions

Crear funciones puras:

calculatePositionSize()

calculateBtcSize()

calculateGrossPnl()

calculateFees()

calculateNetPnl()

calculateRoi()

calculateTrade()

calculateTargetExitPrice()

No poner la lógica financiera directamente dentro de componentes React.

---

# 22. UI style

Quiero apariencia de herramienta de trading.

Oscura por defecto.

Simple.

No sobrecargar.

Inspiración:

- Binance
- Bitunix
- TradingView

Pero no copiar diseños propietarios.

Prioridad:

Resultado visible inmediatamente.

---

# 23. Deploy

Preparar el proyecto para deploy estático.

Build:

npm run build

Output:

dist/

Debe funcionar directamente en:

- Cloudflare Pages
- Vercel
- Netlify

---

# 24. CI/CD

El objetivo es:

git push origin main

y automáticamente:

1. instalar dependencias
2. correr tests
3. hacer build
4. publicar

Preferencia inicial:

Cloudflare Pages conectado directamente al repo GitHub.

No crear infraestructura compleja.

---

# 25. README

Crear README.md con:

- Qué hace la app
- Cómo instalar
- Cómo correr local
- Cómo correr tests
- Cómo hacer build
- Cómo desplegar en Cloudflare Pages

Commands:

npm install

npm run dev

npm run test

npm run build

---

# 26. Fase 2 futura

NO implementar todavía, pero dejar arquitectura preparada para:

- Liquidation Calculator
- Break-even Calculator
- Risk Calculator
- Position Size Calculator
- Multiple positions
- Average Entry Calculator
- Long vs Short comparison
- PnL history
- Saved scenarios
- Bitunix fee presets
- Binance fee presets
- Live BTC price
- Shareable calculation URL
- PWA/mobile install

---

# 27. Acceptance Criteria

La aplicación está terminada cuando:

1. Puedo introducir Entry, Exit, Margin y Leverage.
2. Puedo escoger LONG o SHORT.
3. Puedo configurar fees.
4. Veo inmediatamente mi NET PROFIT.
5. Puedo saber cuánto pagué en fees.
6. Puedo ver mi size real.
7. Puedo ver el movimiento real de BTC.
8. Puedo introducir cuánto quiero ganar y obtener el target price.
9. Todos los cálculos tienen unit tests.
10. npm run build funciona sin errores.
11. La app es usable desde móvil.
12. Puede desplegarse como sitio estático.