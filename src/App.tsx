import { useMemo, useState } from 'react'
import { calculateTargetExitPrice, calculateTrade, validateTradeInput } from './lib/futuresCalculator'
import type { TradeInput } from './types/trading'

const initial: TradeInput = { side: 'LONG', entryPrice: 84600, exitPrice: 85100, margin: 100, leverage: 80, entryFeePercent: 0.06, exitFeePercent: 0.06 }
const usd = (value: number) => `${value < 0 ? '−' : value > 0 ? '+' : ''}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const price = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function App() {
  const [trade, setTrade] = useState<TradeInput>(initial)
  const [targetProfit, setTargetProfit] = useState(20)
  const [feePreset, setFeePreset] = useState('custom')
  const errors = validateTradeInput(trade)
  const result = useMemo(() => errors.length ? null : calculateTrade(trade), [trade, errors.length])
  const target = useMemo(() => {
    try {
      return calculateTargetExitPrice({ side: trade.side, entryPrice: trade.entryPrice, margin: trade.margin, leverage: trade.leverage, entryFeePercent: trade.entryFeePercent, exitFeePercent: trade.exitFeePercent, desiredNetProfit: targetProfit })
    } catch { return null }
  }, [trade, targetProfit])

  function update<K extends keyof TradeInput>(key: K, value: TradeInput[K]) {
    setTrade(current => ({ ...current, [key]: value }))
  }
  function numeric(key: keyof TradeInput, value: string) {
    update(key, value === '' ? Number.NaN : Number(value))
  }
  function preset(value: string) {
    setFeePreset(value)
    if (value !== 'custom') {
      const fee = value === 'maker' ? 0.02 : 0.06
      setTrade(current => ({ ...current, entryFeePercent: fee, exitFeePercent: fee }))
    }
  }

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="brand-icon">↗</span><div><h1>Futures calculator</h1><p>BTCUSDT · PnL simulator</p></div></div><span className="live"><i /> LIVE CALCULATION</span></header>
    <section className="hero"><div><p className="eyebrow">TRADE ANALYZER <span> / </span> USDT-M</p><h2>Know your numbers<br /><em>before the trade.</em></h2></div><p className="hero-note">Estimate your net outcome with position size and fees included.</p></section>
    <div className="workspace">
      <section className="panel inputs-panel">
        <div className="section-heading"><div><span className="step">01</span><h3>Trade setup</h3></div><span className="muted">Edit any value</span></div>
        <div className="side-toggle"><button className={trade.side === 'LONG' ? 'selected long' : ''} onClick={() => update('side', 'LONG')}>↗ &nbsp; LONG</button><button className={trade.side === 'SHORT' ? 'selected short' : ''} onClick={() => update('side', 'SHORT')}>↘ &nbsp; SHORT</button></div>
        <div className="field-grid">
          <Field label="ENTRY PRICE" value={trade.entryPrice} suffix="USDT" onChange={v => numeric('entryPrice', v)} />
          <Field label="EXIT PRICE" value={trade.exitPrice} suffix="USDT" onChange={v => numeric('exitPrice', v)} />
          <Field label="MARGIN" value={trade.margin} suffix="USDT" onChange={v => numeric('margin', v)} />
          <div className="field"><label>LEVERAGE</label><div className="input-wrap"><input aria-label="Leverage" type="number" min="0" step="1" value={Number.isFinite(trade.leverage) ? trade.leverage : ''} onChange={e => numeric('leverage', e.target.value)} /><span className="suffix">X</span></div></div>
        </div>
        <div className="quick-row"><span>QUICK LEVERAGE</span><div>{[10, 20, 50, 80, 100, 200].map(x => <button key={x} className={trade.leverage === x ? 'quick active' : 'quick'} onClick={() => update('leverage', x)}>{x}x</button>)}</div></div>
        <div className="divider" />
        <div className="section-heading compact"><div><span className="step">02</span><h3>Trading fees</h3></div><select value={feePreset} onChange={e => preset(e.target.value)} aria-label="Fee preset"><option value="custom">Custom fees</option><option value="maker">Maker · 0.02%</option><option value="taker">Taker · 0.06%</option></select></div>
        <div className="fee-grid"><Field label="ENTRY FEE" value={trade.entryFeePercent} suffix="%" step="0.01" onChange={v => { setFeePreset('custom'); numeric('entryFeePercent', v) }} /><Field label="EXIT FEE" value={trade.exitFeePercent} suffix="%" step="0.01" onChange={v => { setFeePreset('custom'); numeric('exitFeePercent', v) }} /></div>
      </section>

      <section className="panel result-panel">
        <div className="section-heading"><div><span className="step">03</span><h3>Trade result</h3></div><span className="computed">● AUTO</span></div>
        {errors.length ? <div className="error-box"><strong>Check your inputs</strong>{errors.map(error => <p key={error}>{error}</p>)}</div> : result && <>
          <div className={`profit-card ${result.netPnl >= 0 ? 'positive' : 'negative'}`}><div className="profit-head"><span>NET PROFIT</span><span className="pill">{result.netPnl >= 0 ? 'PROFIT' : 'LOSS'}</span></div><strong>{usd(result.netPnl)} <small>USDT</small></strong><div className="profit-footer"><span>ROI ON MARGIN</span><b>{usd(result.roi)}%</b></div></div>
          <div className="movement"><div><span>PRICE MOVEMENT</span><strong className={result.favorableMovement ? 'good' : 'bad'}>{result.priceMovement > 0 ? '+' : ''}{price(result.priceMovement)} <small>USDT</small></strong></div><div><span>PRICE CHANGE</span><strong className={result.favorableMovement ? 'good' : 'bad'}>{result.priceMovementPercent > 0 ? '+' : ''}{result.priceMovementPercent.toFixed(3)}%</strong></div></div>
          <div className="breakdown-title">POSITION BREAKDOWN <span>USDT</span></div>
          <Rows rows={[
            ['Position size', price(result.positionSize)], ['BTC size', `${result.btcSize.toFixed(8)} BTC`], ['Gross PnL', usd(result.grossPnl)], ['Entry fee', `-${price(result.entryFee)}`], ['Exit fee', `-${price(result.exitFee)}`], ['Total fees', `-${price(result.totalFees)}`],
          ]} />
        </>}
      </section>
    </div>
    <section className="panel target-panel"><div className="target-intro"><span className="step">04</span><div><h3>Target profit</h3><p>Find the exit price for a desired net result.</p></div></div><div className="target-control"><label htmlFor="target">DESIRED NET PROFIT</label><div className="input-wrap"><input id="target" type="number" min="0" step="0.01" value={Number.isFinite(targetProfit) ? targetProfit : ''} onChange={e => setTargetProfit(e.target.value === '' ? Number.NaN : Number(e.target.value))} /><span className="suffix">USDT</span></div></div><div className="target-answer"><span>TARGET EXIT PRICE</span><strong>{target === null ? '—' : `${price(target)} USDT`}</strong></div></section>
    <footer><span>FUTURES PNL CALCULATOR</span><span>Calculations are estimates; exchange rules may vary.</span></footer>
  </main>
}

function Field({ label, value, suffix, onChange, step = 'any' }: { label: string; value: number; suffix: string; onChange: (value: string) => void; step?: string }) {
  return <div className="field"><label>{label}</label><div className="input-wrap"><input type="number" step={step} value={Number.isFinite(value) ? value : ''} onChange={e => onChange(e.target.value)} /><span className="suffix">{suffix}</span></div></div>
}
function Rows({ rows }: { rows: [string, string][] }) {
  return <div className="rows">{rows.map(([label, value]) => <div className="row" key={label}><span>{label}</span><b>{value}</b></div>)}</div>
}

export default App
