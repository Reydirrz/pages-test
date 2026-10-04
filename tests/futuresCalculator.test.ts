import { describe, expect, it } from 'vitest'
import { calculateTargetExitPrice, calculateTrade } from '../src/lib/futuresCalculator'
import type { TradeInput } from '../src/types/trading'

const base: TradeInput = { side: 'LONG', entryPrice: 84600, exitPrice: 85100, margin: 100, leverage: 80, entryFeePercent: 0.06, exitFeePercent: 0.06 }

describe('calculateTrade', () => {
  it('calculates LONG position, pnl and fees from actual BTC size', () => {
    const result = calculateTrade(base)
    expect(result.positionSize).toBe(8000)
    expect(result.btcSize).toBeCloseTo(8000 / 84600, 12)
    expect(result.grossPnl).toBeCloseTo(8000 / 84600 * 500, 10)
    expect(result.entryFee).toBeCloseTo(4.8, 12)
    expect(result.exitFee).toBeCloseTo((8000 / 84600 * 85100) * 0.0006, 12)
    expect(result.totalFees).toBeCloseTo(9.62836879432624, 10)
    expect(result.netPnl).toBeCloseTo(37.65295508274232, 10)
  })

  it('calculates SHORT pnl for a falling market', () => {
    const result = calculateTrade({ ...base, side: 'SHORT', entryPrice: 85100, exitPrice: 84600 })
    expect(result.positionSize).toBe(8000)
    expect(result.grossPnl).toBeCloseTo(8000 / 85100 * 500, 10)
    expect(result.netPnl).toBeCloseTo(37.431727379553465, 10)
    expect(result.favorableMovement).toBe(true)
  })

  it('equal entry and exit produces a loss equal to fees', () => {
    const result = calculateTrade({ ...base, exitPrice: base.entryPrice })
    expect(result.grossPnl).toBe(0)
    expect(result.netPnl).toBe(-result.totalFees)
  })

  it('zero fees make net equal gross', () => {
    const result = calculateTrade({ ...base, entryFeePercent: 0, exitFeePercent: 0 })
    expect(result.netPnl).toBe(result.grossPnl)
  })

  it.each(['LONG', 'SHORT'] as const)('solves a %s target that round-trips through normal calculation', side => {
    const target = 20
    const exitPrice = calculateTargetExitPrice({ side, entryPrice: 84600, margin: 100, leverage: 80, entryFeePercent: 0.06, exitFeePercent: 0.06, desiredNetProfit: target })
    const result = calculateTrade({ ...base, side, entryPrice: 84600, exitPrice })
    expect(result.netPnl).toBeCloseTo(target, 10)
  })

  it('rejects invalid inputs', () => {
    expect(() => calculateTrade({ ...base, margin: 0 })).toThrow(RangeError)
  })
})
