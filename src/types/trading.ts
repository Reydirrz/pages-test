export type Side = 'LONG' | 'SHORT'

export interface TradeInput {
  side: Side
  entryPrice: number
  exitPrice: number
  margin: number
  leverage: number
  entryFeePercent: number
  exitFeePercent: number
}

export interface TradeResult {
  positionSize: number
  btcSize: number
  grossPnl: number
  entryFee: number
  exitNotional: number
  exitFee: number
  totalFees: number
  netPnl: number
  roi: number
  priceMovement: number
  priceMovementPercent: number
  favorableMovement: boolean
}

export interface TargetInput {
  side: Side
  entryPrice: number
  margin: number
  leverage: number
  entryFeePercent: number
  exitFeePercent: number
  desiredNetProfit: number
}
