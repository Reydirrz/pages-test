export type RealizedPnlMode = 'gross' | 'net'
export type BitunixSide = 'LONG' | 'SHORT'

export interface BitunixPositionInput {
  positionId?: string | number
  symbol: string
  side: BitunixSide
  qty: string | number
  avgOpenPrice: string | number
  markPrice?: string | number | null
  lastPrice?: string | number | null
  unrealizedPNL: string | number
  realizedPNL: string | number
  fee?: string | number | null
  funding?: string | number | null
  liqPrice?: string | number | null
  marginRate?: string | number | null
  leverage?: string | number | null
  realizedPnlMode?: RealizedPnlMode
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
  /** `gross` matches Bitunix's documented realizedPNL; use `net` only when the proxy verifies costs are already included. */
  realizedPnlMode?: RealizedPnlMode
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
  liqPrice: number | null
  marginRate: number | null
  leverage: number | null
  realizedPnlMode: RealizedPnlMode
}

export interface PositionEstimate extends OpenPosition {
  closingNotional: number
  estimatedClosingFee: number
  accumulatedNetPnl: number
  estimatedNetIfClosedNow: number
}
