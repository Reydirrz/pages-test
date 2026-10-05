import type { BitunixPositionInput, BitunixProxyPayload } from '../../src/types/bitunix'

export const bitunixGrossFixture: BitunixProxyPayload = {
  realizedPnlMode: 'gross',
  fetchedAt: '2026-10-04T12:00:00.000Z',
  positions: [{
    positionId: 'fixture-long', symbol: 'BTCUSDT', side: 'LONG', qty: '0.5', avgOpenPrice: '60000',
    markPrice: '61000', unrealizedPNL: '1.5', realizedPNL: '102.9', fee: '0.1', funding: '-0.2',
    liqPrice: '22209', marginRate: '0.01', leverage: 10,
  }],
}

export const bitunixNetFixture: BitunixProxyPayload = {
  realizedPnlMode: 'net',
  positions: [{
    positionId: 'fixture-short', symbol: 'ETHUSDT', side: 'SHORT', qty: '-2', avgOpenPrice: '3000',
    unrealizedPNL: '-4', realizedPNL: '12.5', fee: '0.4', funding: '-0.1', leverage: 5,
  } as BitunixPositionInput],
  tickers: [{ symbol: 'ETHUSDT', markPrice: '2995', lastPrice: '2996' }],
}
