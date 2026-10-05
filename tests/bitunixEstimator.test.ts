import { describe, expect, it } from 'vitest'
import { estimateAllPositions, estimatePositionNet, normalizeBitunixPayload, sumPositionEstimates } from '../src/lib/bitunixEstimator'
import { bitunixGrossFixture, bitunixNetFixture } from './fixtures/bitunixPositions'

describe('Bitunix position normalization and close-now estimates', () => {
  it('uses the ticker mark price when the positions response omits it', () => {
    const { positions } = normalizeBitunixPayload(bitunixNetFixture)
    expect(positions[0].markPrice).toBe(2995)
    expect(positions[0].side).toBe('SHORT')
    expect(positions[0].qty).toBe(2)
  })

  it('subtracts documented historical fee and funding exactly once for gross realized PnL', () => {
    const { positions } = normalizeBitunixPayload(bitunixGrossFixture)
    const estimate = estimatePositionNet(positions[0], 0.06)
    expect(estimate.closingNotional).toBe(30500)
    expect(estimate.estimatedClosingFee).toBeCloseTo(18.3, 10)
    expect(estimate.accumulatedNetPnl).toBeCloseTo(103.0, 10) // 102.9 - 0.1 - (-0.2)
    expect(estimate.estimatedNetIfClosedNow).toBeCloseTo(86.2, 10)
  })

  it('does not subtract fee or funding again when realized PnL is already net', () => {
    const { positions } = normalizeBitunixPayload(bitunixNetFixture)
    const estimate = estimatePositionNet(positions[0], 0.06)
    expect(estimate.closingNotional).toBe(5990)
    expect(estimate.estimatedClosingFee).toBeCloseTo(3.594, 10)
    expect(estimate.accumulatedNetPnl).toBe(12.5)
    expect(estimate.estimatedNetIfClosedNow).toBeCloseTo(4.906, 10)
  })

  it('uses each position estimate consistently in the aggregate', () => {
    const { positions: gross } = normalizeBitunixPayload(bitunixGrossFixture)
    const { positions: net } = normalizeBitunixPayload(bitunixNetFixture)
    const estimates = estimateAllPositions([...gross, ...net], 0.06)
    expect(sumPositionEstimates(estimates)).toBeCloseTo(91.106, 10)
    expect(sumPositionEstimates([])).toBe(0)
  })

  it('accepts the official Bitunix `{code,data}` response shape', () => {
    const { positions } = normalizeBitunixPayload({ code: 0, data: bitunixGrossFixture.positions })
    expect(positions[0].realizedPnlMode).toBe('gross')
    expect(positions).toHaveLength(1)
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
    expect(estimate.estimatedNetIfClosedNow).toBeCloseTo(85.895, 12)
  })
})
