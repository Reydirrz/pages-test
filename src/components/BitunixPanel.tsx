import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { estimateAllPositions, normalizeBitunixPayload, sumPositionEstimates } from '../lib/bitunixEstimator'
import type { PositionEstimate } from '../types/bitunix'

type ConnectionState = 'idle' | 'loading' | 'connected' | 'error'
const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
const money = (value: number) => `${value < 0 ? '−' : value > 0 ? '+' : ''}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const amount = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 8 })
const marketPrice = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })
const clock = (value: number | null) => value === null ? '—' : new Date(value).toLocaleTimeString()

export default function BitunixPanel() {
  const [connected, setConnected] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [state, setState] = useState<ConnectionState>('idle')
  const [positions, setPositions] = useState<ReturnType<typeof normalizeBitunixPayload>['positions']>([])
  const [closingFeePercent, setClosingFeePercent] = useState('0.060')
  const [lastQuery, setLastQuery] = useState<number | null>(null)
  const [proxyTimestamp, setProxyTimestamp] = useState<string | null>(null)
  const [latency, setLatency] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const busy = useRef(false)
  const feeRate = closingFeePercent.trim() === '' ? Number.NaN : Number(closingFeePercent)
  const feeValid = Number.isFinite(feeRate) && feeRate >= 0
  const estimates = useMemo(() => feeValid ? estimateAllPositions(positions, feeRate) : [], [positions, feeRate, feeValid])
  const total = feeValid ? sumPositionEstimates(estimates) : null

  useEffect(() => {
    if (!isLocal) return
    let active = true
    void fetch('/api/status', { cache: 'no-store' })
      .then(response => response.json())
      .then(result => { if (active && result.connected) setConnected(true) })
      .catch(() => { if (active) setError('Inicia el servicio con Docker Compose para conectar Bitunix.') })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!connected || !isLocal) return
    let active = true
    let controller: AbortController | null = null
    const load = async () => {
      if (busy.current) return
      busy.current = true
      controller = new AbortController()
      const started = performance.now()
      if (lastQuery === null) setState('loading')
      try {
        const response = await fetch('/api/positions', { cache: 'no-store', signal: controller.signal })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || `Servicio local: HTTP ${response.status}.`)
        const payload = normalizeBitunixPayload(body)
        if (!active) return
        setPositions(payload.positions)
        setProxyTimestamp(payload.fetchedAt)
        setLatency(Math.round(performance.now() - started))
        setLastQuery(Date.now())
        setError('')
        setState('connected')
      } catch (cause) {
        if (!active || (cause instanceof DOMException && cause.name === 'AbortError')) return
        setError(cause instanceof Error ? cause.message : 'No se pudo consultar Bitunix.')
        setState('error')
      } finally { busy.current = false }
    }
    void load()
    const timer = window.setInterval(() => void load(), 2000)
    return () => { active = false; window.clearInterval(timer); controller?.abort(); busy.current = false }
  }, [connected, refreshToken])

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isLocal || !apiKey.trim() || !apiSecret.trim()) return
    setState('loading')
    setError('')
    try {
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'No se pudo autenticar con Bitunix.')
      setApiKey('')
      setApiSecret('')
      setConnected(true)
      setLastQuery(null)
      setState('loading')
    } catch (cause) {
      setState('error')
      setError(cause instanceof Error ? cause.message : 'No se pudo conectar.')
    }
  }

  async function disconnect() {
    await fetch('/api/disconnect', { method: 'POST', cache: 'no-store' }).catch(() => undefined)
    setConnected(false)
    setApiKey('')
    setApiSecret('')
    setState('idle')
    setPositions([])
    setLastQuery(null)
    setProxyTimestamp(null)
    setLatency(null)
    setError('')
  }

  return <section className="bitunix-view">
    <div className="bitunix-heading">
      <div><p className="eyebrow">MONITOR DE CUENTA · SOLO LECTURA</p><h2>Bitunix <em>en vivo.</em></h2><p>Posiciones abiertas y estimado neto si cierras ahora.</p></div>
      <div className={`connection-badge ${state}`}><i />{state === 'connected' ? 'CONECTADO' : state === 'loading' ? 'CONECTANDO' : state === 'error' ? 'ERROR' : 'SIN CONEXIÓN'}</div>
    </div>

    <div className="security-note"><strong>Las claves se guardan solo en la memoria del servicio Docker local.</strong><span>No se guardan en el navegador ni se envían a GitHub Pages. Se borran al desconectar o al detener/reiniciar el contenedor. Usa una API key con permiso de lectura únicamente.</span></div>

    {!isLocal ? <div className="panel local-only"><strong>Conexión Bitunix disponible en la app local</strong><p>Por seguridad, GitHub Pages no solicita ni recibe tus claves. Para conectar tu cuenta, inicia Docker en tu equipo y abre <code>http://localhost:5173</code>.</p><code>docker compose up</code></div> : <>
      {!connected && <form className="panel bitunix-controls credential-form" onSubmit={connect}>
        <label className="field"><span>API KEY · SOLO LECTURA</span><input aria-label="Bitunix API key" type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={event => setApiKey(event.target.value)} required /></label>
        <label className="field"><span>API SECRET</span><input aria-label="Bitunix API secret" type="password" autoComplete="new-password" value={apiSecret} onChange={event => setApiSecret(event.target.value)} required /></label>
        <label className="field"><span>FEE TAKER DE CIERRE</span><div className="input-wrap"><input aria-label="Fee taker de cierre" type="number" min="0" step="0.001" value={closingFeePercent} onChange={event => setClosingFeePercent(event.target.value)} /><span className="suffix">%</span></div></label>
        <button className="connect-button" type="submit" disabled={!feeValid || state === 'loading'}>Conectar en modo lectura</button>
        {!feeValid && <p className="inline-error">El fee debe ser un porcentaje válido no negativo.</p>}
      </form>}
      {connected && <section className="panel bitunix-controls connected-controls">
        <div className="field"><span>FEE TAKER DE CIERRE</span><div className="input-wrap"><input aria-label="Fee taker de cierre" type="number" min="0" step="0.001" value={closingFeePercent} onChange={event => setClosingFeePercent(event.target.value)} /><span className="suffix">%</span></div></div>
        <div className="connect-actions"><button className="connect-button secondary" onClick={() => setRefreshToken(value => value + 1)}>↻ Actualizar ahora</button><button className="connect-button disconnect" onClick={disconnect}>Desconectar y borrar claves</button></div>
        {!feeValid && <p className="inline-error">El fee debe ser un porcentaje válido no negativo.</p>}
        <div className="poll-meta"><span>ÚLTIMA CONSULTA <b>{clock(lastQuery)}</b></span><span>LATENCIA <b>{latency === null ? '—' : `${latency} ms`}</b></span><span>DATOS DE BITUNIX <b>{proxyTimestamp ? new Date(proxyTimestamp).toLocaleTimeString() : '—'}</b></span><span>ACTUALIZACIÓN <b>2s</b></span></div>
      </section>}
    </>}

    {error && isLocal && <div className="error-box bitunix-error"><strong>No se pudo actualizar</strong><p>{error}</p></div>}
    {state === 'connected' && isLocal && <>
      <section className="aggregate-card"><div><span>TOTAL NETO ESTIMADO SI CIERRAS TODAS</span><p>Suma de las estimaciones individuales.</p></div><strong className={total === null ? '' : total >= 0 ? 'good' : 'bad'}>{total === null ? '—' : money(total)} <small>USDT</small></strong></section>
      {!feeValid ? <div className="error-box"><strong>Fee de cierre inválido</strong><p>Introduce un porcentaje válido no negativo.</p></div> : positions.length === 0 ? <div className="empty-positions"><span>—</span><strong>No hay posiciones abiertas</strong><p>Bitunix no devolvió posiciones activas.</p></div> : <div className="position-list">{estimates.map(position => <PositionCard key={position.positionId} position={position} />)}</div>}
    </>}
    {isLocal && !connected && !error && <div className="empty-positions setup-empty"><span>◉</span><strong>Conecta tu cuenta para ver tus posiciones</strong><p>La API key se valida con Bitunix; no se guarda en el navegador.</p></div>}
    <p className="estimate-disclaimer">Estimación con mark price y fee de cierre editable. El resultado real puede variar por tarifa efectiva, funding posterior, slippage y precio de ejecución.</p>
  </section>
}

function PositionCard({ position }: { position: PositionEstimate }) {
  return <article className="position-card panel">
    <div className="position-card-head"><div><strong>{position.symbol}</strong><span className={`side-tag ${position.side.toLowerCase()}`}>{position.side}</span></div><span className="position-id">ID {position.positionId}</span></div>
    <div className={`position-net ${position.estimatedNetIfClosedNow >= 0 ? 'positive' : 'negative'}`}><span>ESTIMADO NETO SI CIERRAS AHORA</span><strong>{money(position.estimatedNetIfClosedNow)} <small>USDT</small></strong></div>
    <div className="position-metrics">
      <Metric label="CANTIDAD" value={`${amount(position.qty)} ${position.symbol}`} />
      <Metric label="PRECIO ENTRADA" value={marketPrice(position.avgOpenPrice)} />
      <Metric label="MARK PRICE" value={marketPrice(position.markPrice)} />
      <Metric label="PNL FLOTANTE" value={money(position.unrealizedPnl)} signed />
      <Metric label="PNL REALIZADO" value={money(position.realizedPnl)} signed />
      <Metric label="FEES ACUMULADOS" value={money(position.fee)} />
      <Metric label="FUNDING ACUMULADO" value={money(position.funding)} signed />
      <Metric label="FEE DE CIERRE ESTIMADO" value={`−${position.estimatedClosingFee.toFixed(2)}`} />
    </div>
    <div className="position-foot"><span>Nocional de cierre: {position.closingNotional.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</span><span>Cálculo neto: realizado − fees − funding + flotante − fee de cierre</span></div>
  </article>
}

function Metric({ label, value, signed = false }: { label: string; value: string; signed?: boolean }) {
  const negative = value.startsWith('−')
  return <div className="position-metric"><span>{label}</span><strong className={signed ? negative ? 'bad' : 'good' : ''}>{value}</strong></div>
}
