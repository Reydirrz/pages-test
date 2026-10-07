import type {
  BitunixPositionInput,
  BitunixSide,
  BitunixProxyPayload,
  BitunixTickerInput,
  OpenPosition,
  PositionEstimate,
} from '../types/bitunix'

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' ? value as UnknownRecord : {}
}

function numberValue(value: unknown, field: string, fallback?: number): number {
  if ((value === undefined || value === null || value === '') && fallback !== undefined) return fallback
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) throw new RangeError(`Bitunix proxy returned an invalid ${field}.`)
  return parsed
}

function positivePrice(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

function normalizeTicker(value: unknown): BitunixTickerInput {
  const item = record(value)
  if (typeof item.symbol !== 'string' || !item.symbol) throw new RangeError('Bitunix proxy returned a ticker without a symbol.')
  return item as unknown as BitunixTickerInput
}

function normalizePosition(
  value: unknown,
  tickers: Map<string, BitunixTickerInput>,
  index: number,
): OpenPosition {
  const item = record(value) as unknown as BitunixPositionInput
  if (typeof item.symbol !== 'string' || !item.symbol.trim()) throw new RangeError(`Open position ${index + 1} has no symbol.`)
  const side = normalizeSide(item.side, index)

  const ticker = tickers.get(item.symbol)
  const legacyItem = record(value)
  const markPrice = positivePrice(item.markPrice, legacyItem.mark, item.lastPrice, ticker?.markPrice, ticker?.lastPrice, ticker?.last)
  if (markPrice === null) throw new RangeError(`No mark price is available for ${item.symbol}; the position total cannot be estimated.`)

  const qty = numberValue(item.qty, 'position quantity')
  const avgOpenPrice = numberValue(item.avgOpenPrice ?? legacyItem.entry, 'average open price')
  if (qty === 0 || avgOpenPrice <= 0) throw new RangeError(`Open position ${index + 1} has a zero quantity or non-positive entry price.`)

  return {
    positionId: String(item.positionId ?? `${item.symbol}-${item.side}-${index}`),
    symbol: item.symbol,
    side,
    qty,
    avgOpenPrice,
    markPrice,
    unrealizedPnl: numberValue(item.unrealizedPNL ?? legacyItem.unrealized, 'unrealized PnL', 0),
    realizedPnl: numberValue(item.realizedPNL ?? legacyItem.realized, 'realized PnL', 0),
    fee: numberValue(item.fee, 'transaction fees', 0),
    funding: numberValue(item.funding, 'funding', 0),
    liqPrice: optionalNumber(item.liqPrice),
    marginRate: optionalNumber(item.marginRate),
    leverage: optionalNumber(item.leverage),
  }
}

function normalizeSide(value: unknown, index: number): BitunixSide {
  const side = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (side === 'LONG' || side === 'BUY') return 'LONG'
  if (side === 'SHORT' || side === 'SELL') return 'SHORT'
  throw new RangeError(`Open position ${index + 1} has an unsupported side.`)
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** Normalize Bitunix's `{code,data}` response or the documented proxy contract. */
export function normalizeBitunixPayload(value: unknown): { positions: OpenPosition[]; fetchedAt: string | null } {
  const root = record(value)
  if (root.code !== undefined && Number(root.code) !== 0) throw new Error('Bitunix proxy reported an upstream API error.')
  const data = record(root.data)
  const proxy = root as unknown as BitunixProxyPayload
  const rawPositions = Array.isArray(proxy.positions) ? proxy.positions : Array.isArray(root.data) ? root.data : null
  if (!rawPositions) throw new RangeError('Bitunix proxy response must contain a positions array.')

  const rawTickers = Array.isArray(proxy.tickers) ? proxy.tickers : Array.isArray(data.tickers) ? data.tickers : []
  const tickers = new Map(rawTickers.map(normalizeTicker).map(ticker => [ticker.symbol, ticker]))
  const positions = rawPositions.map((item, index) => normalizePosition(item, tickers, index))
  return { positions, fetchedAt: typeof proxy.fetchedAt === 'string' ? proxy.fetchedAt : null }
}

/** Direct port of `show()` in Trading/bitunix-live-net.py. Keep its arithmetic in one place. */
export function calculateLegacyLiveTotals(positions: OpenPosition[], closingFeePercent: number) {
  if (!Number.isFinite(closingFeePercent) || closingFeePercent < 0) {
    throw new RangeError('Closing taker fee must be a non-negative percentage.')
  }
  const rate = closingFeePercent / 100
  const unrealizedPnl = positions.reduce((sum, position) => sum + (Number(position.unrealizedPnl) || 0), 0)
  const realizedPnl = positions.reduce((sum, position) => sum + (Number(position.realizedPnl) || 0), 0)
  const funding = positions.reduce((sum, position) => sum + (Number(position.funding) || 0), 0)
  const closingFees = positions.reduce((sum, position) => sum + position.qty * position.markPrice * rate, 0)
  const netPnl = realizedPnl + unrealizedPnl + funding

  return {
    netPnl,
    unrealizedPnl,
    estimatedClosingFees: closingFees,
    estimatedClosePnl: netPnl - closingFees,
    perPosition: positions.map(position => ({
      positionId: position.positionId,
      estimatedClosePnl: position.realizedPnl + position.unrealizedPnl + position.funding
        - position.qty * position.markPrice * rate,
    })),
  }
}

export function estimatePositionNet(position: OpenPosition, closingFeePercent: number): PositionEstimate {
  if (!Number.isFinite(closingFeePercent) || closingFeePercent < 0) {
    throw new RangeError('Closing taker fee must be a non-negative percentage.')
  }
  const closingNotional = position.qty * position.markPrice
  const estimatedClosingFee = closingNotional * closingFeePercent / 100
  const liveTotals = calculateLegacyLiveTotals([position], closingFeePercent)
  const accumulatedNetPnl = position.realizedPnl + position.funding
  // Solve accumulated net + directional price PnL - closing fee = 0.
  const feeRate = closingFeePercent / 100
  const absoluteQty = Math.abs(position.qty)
  const breakEvenDenominator = position.side === 'LONG'
    ? absoluteQty - position.qty * feeRate
    : absoluteQty + position.qty * feeRate
  const currentNetBeforeCloseFee = position.realizedPnl + position.unrealizedPnl + position.funding
  const breakEvenPrice = position.side === 'LONG'
    ? (absoluteQty * position.markPrice - currentNetBeforeCloseFee) / breakEvenDenominator
    : (absoluteQty * position.markPrice + currentNetBeforeCloseFee) / breakEvenDenominator
  const breakEvenMovePercent = (position.side === 'LONG'
    ? breakEvenPrice - position.markPrice
    : position.markPrice - breakEvenPrice) / position.markPrice * 100

  if (!Number.isFinite(breakEvenPrice) || breakEvenPrice <= 0) {
    throw new RangeError('A positive break-even price cannot be calculated for this position and closing fee.')
  }

  return {
    ...position,
    closingNotional,
    estimatedClosingFee,
    accumulatedNetPnl,
    estimatedNetIfClosedNow: liveTotals.perPosition[0].estimatedClosePnl,
    breakEvenPrice,
    breakEvenMovePercent,
  }
}

export function estimateAllPositions(positions: OpenPosition[], closingFeePercent: number): PositionEstimate[] {
  return positions.map(position => estimatePositionNet(position, closingFeePercent))
}

export function sumPositionEstimates(estimates: PositionEstimate[]): number {
  return estimates.reduce((total, estimate) => total + estimate.estimatedNetIfClosedNow, 0)
}
