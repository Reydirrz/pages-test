import { describe, expect, it } from 'vitest'
import { calculateLegacyLiveTotals, estimateAllPositions, estimatePositionNet, normalizeBitunixPayload, sumPositionEstimates } from '../src/lib/bitunixEstimator'
import { bitunixGrossFixture, bitunixNetFixture } from './fixtures/bitunixPositions'

describe('Bitunix position normalization and close-now estimates', () => {
  it('uses the ticker mark price when the positions response omits it', () => {
    const { positions } = normalizeBitunixPayload(bitunixNetFixture)
    expect(positions[0].markPrice).toBe(2995)
    expect(positions[0].side).toBe('SHORT')
    expect(positions[0].qty).toBe(-2)
  })

  it('ports the original monitor arithmetic: realized + floating + funding - close fee', () => {
    const { positions } = normalizeBitunixPayload(bitunixGrossFixture)
    const estimate = estimatePositionNet(positions[0], 0.06)
    expect(estimate.closingNotional).toBe(30500)
    expect(estimate.estimatedClosingFee).toBeCloseTo(18.3, 10)
    expect(estimate.accumulatedNetPnl).toBeCloseTo(102.7, 10) // realized + funding
    expect(estimate.estimatedNetIfClosedNow).toBeCloseTo(85.9, 10)
    expect(estimate.breakEvenPrice).toBeCloseTo(
      (positions[0].markPrice - (positions[0].realizedPnl + positions[0].unrealizedPnl + positions[0].funding) / positions[0].qty) / (1 - 0.0006), 10,
    )
    expect(estimate.breakEvenMovePercent).toBeCloseTo((estimate.breakEvenPrice - positions[0].markPrice) / positions[0].markPrice * 100, 10)
  })

  it('includes funding in the original monitor total', () => {
    const { positions } = normalizeBitunixPayload(bitunixNetFixture)
    const estimate = estimatePositionNet(positions[0], 0.06)
    expect(estimate.closingNotional).toBe(-5990)
    expect(estimate.estimatedClosingFee).toBeCloseTo(-3.594, 10)
    expect(estimate.accumulatedNetPnl).toBeCloseTo(12.4, 10)
    expect(estimate.estimatedNetIfClosedNow).toBeCloseTo(11.994, 10)
    expect(estimate.breakEvenPrice).toBeCloseTo(
      (Math.abs(positions[0].qty) * positions[0].markPrice + (positions[0].realizedPnl + positions[0].unrealizedPnl + positions[0].funding))
        / (Math.abs(positions[0].qty) + positions[0].qty * 0.0006), 10,
    )
    expect(estimate.breakEvenMovePercent).toBeCloseTo((positions[0].markPrice - estimate.breakEvenPrice) / positions[0].markPrice * 100, 10)
  })

  it('solves close-now break-even using unrealized PnL and closing fee for both sides', () => {
    const { positions } = normalizeBitunixPayload({ positions: [
      { symbol: 'BTCUSDT', side: 'LONG', qty: 2, avgOpenPrice: 100, markPrice: 110, unrealizedPNL: 20, realizedPNL: 0 },
      { symbol: 'BTCUSDT', side: 'SHORT', qty: 2, avgOpenPrice: 100, markPrice: 90, unrealizedPNL: 20, realizedPNL: 0 },
    ] })
    const [long, short] = estimateAllPositions(positions, 0.1)
    expect(long.breakEvenPrice).toBeCloseTo(100 / 0.999, 10)
    expect(short.breakEvenPrice).toBeCloseTo(100 / 1.001, 10)
    expect((long.breakEvenPrice - 100) * long.qty - long.breakEvenPrice * long.qty * 0.001).toBeCloseTo(0, 10)
    expect((100 - short.breakEvenPrice) * short.qty - short.breakEvenPrice * short.qty * 0.001).toBeCloseTo(0, 10)
    expect(long.breakEvenMovePercent).toBeLessThan(0)
    expect(short.breakEvenMovePercent).toBeLessThan(0)
  })

  it('uses each position estimate consistently in the aggregate', () => {
    const { positions: gross } = normalizeBitunixPayload(bitunixGrossFixture)
    const { positions: net } = normalizeBitunixPayload(bitunixNetFixture)
    const estimates = estimateAllPositions([...gross, ...net], 0.06)
    expect(sumPositionEstimates(estimates)).toBeCloseTo(97.894, 10)
    expect(sumPositionEstimates([])).toBe(0)
  })

  it('accepts the official Bitunix `{code,data}` response shape', () => {
    const { positions } = normalizeBitunixPayload({ code: 0, data: bitunixGrossFixture.positions })
    expect(positions).toHaveLength(1)
  })

  it('matches the previous live monitor formula for Bitunix account data', () => {
    const { positions } = normalizeBitunixPayload({ positions: [{
      symbol: 'BTCUSDT', side: 'BUY', qty: '0.0167', avgOpenPrice: '85590.50', markPrice: '85720.10',
      unrealizedPNL: '2.1643', realizedPNL: '-0.8576', fee: '0.8576', funding: '0', leverage: 80,
    }] })
    const estimate = estimatePositionNet(positions[0], 0.06)
    expect(estimate.accumulatedNetPnl).toBeCloseTo(-0.8576, 10)
    expect(estimate.estimatedNetIfClosedNow).toBeCloseTo(0.447784598, 9)
    const totals = calculateLegacyLiveTotals(positions, 0.06)
    expect(totals.netPnl).toBeCloseTo(1.3067, 10)
    expect(totals.unrealizedPnl).toBeCloseTo(2.1643, 10)
    expect(totals.estimatedClosePnl).toBeCloseTo(0.447784598, 9)
    expect(totals.perPosition[0].estimatedClosePnl).toBeCloseTo(0.447784598, 9)
  })

  it('accepts the original monitor position contract without translating its field names', () => {
    const { positions } = normalizeBitunixPayload({ positions: [{
      symbol: 'BTCUSDT', side: 'BUY', qty: 0.0167, entry: 85590.5, mark: 85720.1,
      leverage: 80, unrealized: 2.1643, realized: -0.8576, fee: 0.8576, funding: 0,
    }] })
    const estimate = estimatePositionNet(positions[0], 0.06)
    expect(estimate.estimatedNetIfClosedNow).toBeCloseTo(0.447784598, 9)
  })

  it('maps Bitunix position sides BUY and SELL to LONG and SHORT', () => {
    const base = bitunixGrossFixture.positions![0]
    const payload = normalizeBitunixPayload({ positions: [
      { ...base, side: 'BUY' },
      { ...base, positionId: 'fixture-short-from-sell', side: 'SELL' },
    ] })
    expect(payload.positions.map(position => position.side)).toEqual(['LONG', 'SHORT'])
  })

  it('returns an empty list for an account without open positions', () => {
    expect(normalizeBitunixPayload({ positions: [] }).positions).toEqual([])
  })

  it('fails closed when no current mark price is available', () => {
    const missingMark = {
      positions: [{ symbol: 'BTCUSDT', side: 'LONG', qty: '1', avgOpenPrice: '60000', unrealizedPNL: '0', realizedPNL: '0' }],
    }
    expect(() => normalizeBitunixPayload(missingMark)).toThrow('No mark price is available')
  })

  it('rejects negative estimated closing fees', () => {
    const { positions } = normalizeBitunixPayload(bitunixGrossFixture)
    expect(() => estimatePositionNet(positions[0], -0.01)).toThrow('non-negative')
  })

  it('does not round internal estimates prematurely', () => {
    const { positions } = normalizeBitunixPayload(bitunixGrossFixture)
    const estimate = estimatePositionNet(positions[0], 0.061)
    expect(estimate.estimatedClosingFee).toBeCloseTo(18.605, 12)
    expect(estimate.estimatedClosingFee).not.toBe(18.61)
    expect(estimate.estimatedNetIfClosedNow).toBeCloseTo(85.595, 12)
  })
})
