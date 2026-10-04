import type { Side, TargetInput, TradeInput, TradeResult } from '../types/trading'

const percentToRate = (percent: number): number => percent / 100

export function calculatePositionSize(margin: number, leverage: number): number {
  return margin * leverage
}

export function calculateBtcSize(positionSize: number, entryPrice: number): number {
  return positionSize / entryPrice
}

export function calculateGrossPnl(side: Side, btcSize: number, entryPrice: number, exitPrice: number): number {
  return btcSize * (side === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice)
}

export function calculateFees(positionSize: number, exitNotional: number, entryFeePercent: number, exitFeePercent: number) {
  const entryFee = positionSize * percentToRate(entryFeePercent)
  const exitFee = exitNotional * percentToRate(exitFeePercent)
  return { entryFee, exitFee, totalFees: entryFee + exitFee }
}

export function calculateNetPnl(grossPnl: number, totalFees: number): number {
  return grossPnl - totalFees
}

export function calculateRoi(netPnl: number, margin: number): number {
  return (netPnl / margin) * 100
}

export function validateTradeInput(input: TradeInput): string[] {
  const errors: string[] = []
  if (!Number.isFinite(input.entryPrice) || input.entryPrice <= 0) errors.push('Entry price debe ser mayor que 0.')
  if (!Number.isFinite(input.exitPrice) || input.exitPrice <= 0) errors.push('Exit price debe ser mayor que 0.')
  if (!Number.isFinite(input.margin) || input.margin <= 0) errors.push('Margin debe ser mayor que 0.')
  if (!Number.isFinite(input.leverage) || input.leverage <= 0) errors.push('Leverage debe ser mayor que 0.')
  if (!Number.isFinite(input.entryFeePercent) || input.entryFeePercent < 0) errors.push('Entry fee no puede ser negativo.')
  if (!Number.isFinite(input.exitFeePercent) || input.exitFeePercent < 0) errors.push('Exit fee no puede ser negativo.')
  return errors
}

export function calculateTrade(input: TradeInput): TradeResult {
  const errors = validateTradeInput(input)
  if (errors.length) throw new RangeError(errors.join(' '))

  const positionSize = calculatePositionSize(input.margin, input.leverage)
  const btcSize = calculateBtcSize(positionSize, input.entryPrice)
  const grossPnl = calculateGrossPnl(input.side, btcSize, input.entryPrice, input.exitPrice)
  const exitNotional = btcSize * input.exitPrice
  const { entryFee, exitFee, totalFees } = calculateFees(positionSize, exitNotional, input.entryFeePercent, input.exitFeePercent)
  const netPnl = calculateNetPnl(grossPnl, totalFees)
  const priceMovement = input.exitPrice - input.entryPrice

  return {
    positionSize, btcSize, grossPnl, entryFee, exitNotional, exitFee, totalFees, netPnl,
    roi: calculateRoi(netPnl, input.margin),
    priceMovement,
    priceMovementPercent: (priceMovement / input.entryPrice) * 100,
    favorableMovement: input.side === 'LONG' ? priceMovement >= 0 : priceMovement <= 0,
  }
}

export function calculateTargetExitPrice(input: TargetInput): number {
  const { side, entryPrice, margin, leverage, entryFeePercent, exitFeePercent, desiredNetProfit } = input
  if (![entryPrice, margin, leverage, entryFeePercent, exitFeePercent, desiredNetProfit].every(Number.isFinite)) {
    throw new RangeError('Todos los valores deben ser números válidos.')
  }
  if (entryPrice <= 0 || margin <= 0 || leverage <= 0) throw new RangeError('Entry, margin y leverage deben ser mayores que 0.')
  if (entryFeePercent < 0 || exitFeePercent < 0) throw new RangeError('Los fees no pueden ser negativos.')
  const exitRate = percentToRate(exitFeePercent)
  if (exitRate >= 1) throw new RangeError('Exit fee debe ser menor que 100%.')

  const positionSize = calculatePositionSize(margin, leverage)
  const btcSize = calculateBtcSize(positionSize, entryPrice)
  const entryFee = positionSize * percentToRate(entryFeePercent)
  const desiredGross = desiredNetProfit + entryFee

  // Net LONG = btcSize * exitPrice * (1-exitRate) - positionSize - entryFee.
  if (side === 'LONG') {
    const target = (desiredGross + positionSize) / (btcSize * (1 - exitRate))
    if (target <= 0) throw new RangeError('El beneficio solicitado implica un precio objetivo no positivo.')
    return target
  }

  // Net SHORT = positionSize + entryFee - btcSize * exitPrice * (1+exitRate).
  // This is monotone decreasing in exit price; targets above the available entry proceeds may be impossible.
  const target = (positionSize - desiredGross) / (btcSize * (1 + exitRate))
  if (target <= 0) throw new RangeError('Ese beneficio neto no es posible con un precio de salida positivo para SHORT.')
  return target
}
