import { useEffect, useMemo, useRef, useState } from 'react'
import { estimateAllPositions, normalizeBitunixPayload, sumPositionEstimates } from '../lib/bitunixEstimator'
import type { PositionEstimate } from '../types/bitunix'

type ConnectionState = 'idle' | 'loading' | 'connected' | 'error'

const DEFAULT_PROXY_URL = import.meta.env.VITE_BITUNIX_PROXY_URL ?? ''
const money = (value: number) => `${value < 0 ? '−' : value > 0 ? '+' : ''}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const amount = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 8 })
const marketPrice = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })
const clock = (value: number | null) => value === null ? '—' : new Date(value).toLocaleTimeString()

function validateProxyUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return 'Usa una URL HTTP o HTTPS.'
    if (url.username || url.password) return 'No incluyas credenciales en la URL del proxy.'
    if ([...url.searchParams.keys()].some(key => /(key|secret|token|auth|sign)/i.test(key))) return 'No incluyas credenciales en query params; usa el campo temporal de acceso al proxy.'
    return null
  } catch {
    return 'Introduce la URL del endpoint seguro del proxy.'
  }
}

export default function BitunixPanel() {
  const [proxyUrl, setProxyUrl] = useState(DEFAULT_PROXY_URL)
  const [connected, setConnected] = useState(false)
  const [proxyAccessToken, setProxyAccessToken] = useState('')
  const [state, setState] = useState<ConnectionState>('idle')
  const [positions, setPositions] = useState<ReturnType<typeof normalizeBitunixPayload>['positions']>([])
  const [closingFeePercent, setClosingFeePercent] = useState('0.060')
  const [pollSeconds, setPollSeconds] = useState(2)
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
  const endpointError = validateProxyUrl(proxyUrl.trim())

  useEffect(() => {
    if (!connected) return
    const validationError = validateProxyUrl(proxyUrl.trim())
    if (validationError) {
      setState('error')
      setError(validationError)
      return
    }

    let active = true
    let controller: AbortController | null = null
    const load = async () => {
      if (busy.current) return
      busy.current = true
      controller = new AbortController()
      const started = performance.now()
      if (lastQuery === null) setState('loading')
      try {
        const response = await fetch(proxyUrl.trim(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(proxyAccessToken.trim() ? { Authorization: `Bearer ${proxyAccessToken.trim()}` } : {}),
          },
          cache: 'no-store',
          credentials: 'omit',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`El proxy respondió HTTP ${response.status}.`)
        const payload = normalizeBitunixPayload(await response.json())
        if (!active) return
        setPositions(payload.positions)
        setProxyTimestamp(payload.fetchedAt)
        setLatency(Math.round(performance.now() - started))
        setLastQuery(Date.now())
        setError('')
        setState('connected')
      } catch (cause) {
        if (!active || (cause instanceof DOMException && cause.name === 'AbortError')) return
        setError(cause instanceof Error ? cause.message : 'No se pudo consultar el proxy.')
        setState('error')
      } finally {
        busy.current = false
      }
    }

    void load()
    const timer = window.setInterval(() => void load(), pollSeconds * 1000)
    return () => {
      active = false
      window.clearInterval(timer)
      controller?.abort()
      busy.current = false
    }
  // refreshToken deliberately triggers one immediate refresh by recreating the poll effect.
  }, [connected, proxyUrl, pollSeconds, proxyAccessToken, refreshToken])

  function disconnect() {
    setConnected(false)
    setProxyAccessToken('')
    setState('idle')
    setPositions([])
    setLastQuery(null)
    setProxyTimestamp(null)
    setLatency(null)
    setError('')
  }

  return <section className="bitunix-view">
    <div className="bitunix-heading">
      <div><p className="eyebrow">READ-ONLY ACCOUNT MONITOR</p><h2>Bitunix <em>en vivo.</em></h2><p>Estimación individual de cada posición abierta al precio de marca más reciente.</p></div>
      <div className={`connection-badge ${state}`}><i />{state === 'connected' ? 'CONECTADO' : state === 'loading' ? 'CONECTANDO' : state === 'error' ? 'ERROR DE CONEXIÓN' : 'SIN CONEXIÓN'}</div>
    </div>

    <div className="security-note"><strong>Solo lectura · nunca pegues aquí tu API key ni su secret.</strong><span>El sitio estático no puede proteger claves de Bitunix. Si tu proxy exige autenticación, puedes proporcionar su token independiente y de solo lectura: vive solo en memoria y se envía únicamente a la URL configurada.</span></div>

    <section className="panel bitunix-controls">
      <div className="bitunix-control-grid">
        <label className="field proxy-field"><span>URL DE TU PROXY SEGURO</span><input aria-label="URL del proxy seguro" type="url" value={proxyUrl} onChange={event => setProxyUrl(event.target.value)} placeholder="https://tu-proxy.example/api/bitunix/positions" disabled={connected} /></label>
        <label className="field proxy-token-field"><span>TOKEN DEL PROXY · OPCIONAL</span><input aria-label="Token independiente del proxy" type="password" autoComplete="off" value={proxyAccessToken} onChange={event => setProxyAccessToken(event.target.value)} placeholder="No es la API key de Bitunix" disabled={connected} /></label>
        <label className="field"><span>FEE TAKER DE CIERRE</span><div className="input-wrap"><input aria-label="Fee taker de cierre" type="number" min="0" step="0.001" value={closingFeePercent} onChange={event => setClosingFeePercent(event.target.value)} /><span className="suffix">%</span></div></label>
        <label className="field"><span>ACTUALIZAR CADA</span><select value={pollSeconds} onChange={event => setPollSeconds(Number(event.target.value))}><option value={2}>2 segundos</option><option value={5}>5 segundos</option><option value={10}>10 segundos</option><option value={30}>30 segundos</option></select></label>
        <div className="connect-actions">{connected ? <><button className="connect-button secondary" onClick={() => setRefreshToken(value => value + 1)}>↻ Actualizar ahora</button><button className="connect-button disconnect" onClick={disconnect}>Desconectar</button></> : <button className="connect-button" disabled={Boolean(endpointError) || !feeValid} onClick={() => { setConnected(true); setError('') }}>Conectar en modo lectura</button>}</div>
      </div>
      {endpointError && !connected && <p className="inline-error">{endpointError}</p>}
      {!feeValid && <p className="inline-error">El fee de cierre debe ser un porcentaje válido no negativo.</p>}
      <div className="poll-meta"><span>ÚLTIMA CONSULTA <b>{clock(lastQuery)}</b></span><span>LATENCIA <b>{latency === null ? '—' : `${latency} ms`}</b></span><span>DATOS DEL PROXY <b>{proxyTimestamp ? new Date(proxyTimestamp).toLocaleTimeString() : '—'}</b></span><span>INTERVALO <b>{pollSeconds}s</b></span></div>
    </section>

    {error && <div className="error-box bitunix-error"><strong>No se pudo actualizar</strong><p>{error}</p><small>Revisa que el proxy esté activo, permita CORS para esta web y devuelva el contrato descrito en README.</small></div>}

    {state === 'connected' && <>
      <section className="aggregate-card"><div><span>TOTAL ESTIMADO NETO SI CIERRAS TODAS</span><p>Suma de los netos individuales que aparecen abajo.</p></div><strong className={total === null ? '' : total >= 0 ? 'good' : 'bad'}>{total === null ? '—' : money(total)} <small>USDT</small></strong></section>
      {!feeValid ? <div className="error-box"><strong>Fee de cierre inválido</strong><p>Introduce un porcentaje válido no negativo para estimar las posiciones.</p></div> : positions.length === 0 ? <div className="empty-positions"><span>—</span><strong>No hay posiciones abiertas</strong><p>Cuando el proxy devuelva posiciones activas, aparecerán aquí.</p></div> : <div className="position-list">{estimates.map(position => <PositionCard key={position.positionId} position={position} />)}</div>}
    </>}

    {state !== 'connected' && !error && <div className="empty-positions setup-empty"><span>◉</span><strong>Conecta tu proxy para ver las posiciones</strong><p>La API key permanece en tu proxy; esta aplicación solo recibe datos de posición y mercado.</p></div>}

    <p className="estimate-disclaimer">ESTIMACIÓN: se calcula con mark price y fee de cierre editable. El resultado real puede variar por tarifa efectiva, slippage y precio de ejecución.</p>
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
    <div className="position-foot"><span>Nocional de cierre: {position.closingNotional.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</span><span>Cálculo neto: {position.realizedPnlMode === 'gross' ? 'realizado − fees − funding' : 'realizado neto'} + flotante − fee de cierre</span></div>
  </article>
}

function Metric({ label, value, signed = false }: { label: string; value: string; signed?: boolean }) {
  const negative = value.startsWith('−')
  return <div className="position-metric"><span>{label}</span><strong className={signed ? negative ? 'bad' : 'good' : ''}>{value}</strong></div>
}
