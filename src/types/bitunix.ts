export type BitunixSide = 'LONG' | 'SHORT'
export type BitunixSideInput = BitunixSide | 'BUY' | 'SELL'

export interface BitunixPositionInput {
  positionId?: string | number
  symbol: string
  side: BitunixSideInput
  qty: string | number
  avgOpenPrice?: string | number
  entry?: string | number
  markPrice?: string | number | null
  mark?: string | number | null
  lastPrice?: string | number | null
  unrealizedPNL?: string | number
  unrealized?: string | number
  realizedPNL?: string | number
  realized?: string | number
  fee?: string | number | null
  funding?: string | number | null
  margin?: string | number | null
  liqPrice?: string | number | null
  marginRate?: string | number | null
  leverage?: string | number | null
}

export interface BitunixTickerInput {
  symbol: string
  markPrice?: string | number | null
  lastPrice?: string | number | null
  last?: string | number | null
}

export interface BitunixProxyPayload {
  positions?: BitunixPositionInput[]
  tickers?: BitunixTickerInput[]
  fetchedAt?: string
}

export interface OpenPosition {
  positionId: string
  symbol: string
  side: BitunixSide
  qty: number
  avgOpenPrice: number
  markPrice: number
  unrealizedPnl: number
  realizedPnl: number
  fee: number
  funding: number
  margin: number | null
  liqPrice: number | null
  marginRate: number | null
  leverage: number | null
}

export interface PositionEstimate extends OpenPosition {
  closingNotional: number
  estimatedClosingFee: number
  accumulatedNetPnl: number
  estimatedNetIfClosedNow: number
  breakEvenPrice: number
  breakEvenMovePercent: number
}
