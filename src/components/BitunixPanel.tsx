import { memo, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { fetchBitunixPositionsInBrowser } from '../lib/bitunixBrowserConnection'
import { decryptCredentials, encryptCredentials } from '../lib/credentialVault'
import { calculateLegacyLiveTotals, estimateAllPositions, normalizeBitunixPayload, unrealizedPnlPercent } from '../lib/bitunixEstimator'
import type { BitunixCredentials } from '../lib/credentialVault'
import type { OpenPosition, PositionEstimate } from '../types/bitunix'

type ConnectionState = 'idle' | 'loading' | 'connected' | 'error'
const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
const VAULT_KEY = 'bitunix-credential-vault-v1'
function hasCredentialVault() {
  try { return Boolean(window.localStorage.getItem(VAULT_KEY)) } catch { return false }
}
const money = (value: number) => `${value < 0 ? '−' : value > 0 ? '+' : ''}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
const amount = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 8 })
const marketPrice = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const clock = (value: number | null) => value === null ? '—' : new Date(value).toLocaleTimeString()

export default function BitunixPanel() {
  const [connected, setConnected] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [vaultPassword, setVaultPassword] = useState('')
  const [vaultAvailable, setVaultAvailable] = useState(() => !isLocal && hasCredentialVault())
  const [unlockedCredentials, setUnlockedCredentials] = useState<BitunixCredentials | null>(null)
  const [state, setState] = useState<ConnectionState>('idle')
  const [, setPositionVersion] = useState(0)
  const positionsRef = useRef<OpenPosition[]>([])
  const positionsShape = useRef('')
  const [closingFeePercent, setClosingFeePercent] = useState('0.060')
  const [lastQuery, setLastQuery] = useState<number | null>(null)
  const [proxyTimestamp, setProxyTimestamp] = useState<string | null>(null)
  const [latency, setLatency] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [pipError, setPipError] = useState('')
  const [pipOpen, setPipOpen] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const busy = useRef(false)
  const hasReceivedData = useRef(false)
  const feeRateRef = useRef(Number(closingFeePercent))
  const feeRate = closingFeePercent.trim() === '' ? Number.NaN : Number(closingFeePercent)
  feeRateRef.current = feeRate
  const feeValid = Number.isFinite(feeRate) && feeRate >= 0
  const pipWindow = useRef<Window | null>(null)
  const pipRoot = useRef<ReturnType<typeof createRoot> | null>(null)
  const positions = positionsRef.current
  const estimates = feeValid ? estimateAllPositions(positions, feeRate) : []
  const totals = feeValid ? calculateLegacyLiveTotals(positions, feeRate) : null
  const total = totals?.estimatedClosePnl ?? null
  const baseTotal = totals?.netPnl ?? 0
  const unrealizedTotal = totals?.unrealizedPnl ?? 0

  function receivePositions(next: OpenPosition[]) {
    const nextShape = next.map(position => position.positionId).join('\u0000')
    positionsRef.current = next
    updatePip(next, feeRateRef.current)
    if (positionsShape.current !== nextShape) {
      positionsShape.current = nextShape
      setPositionVersion(version => version + 1)
    } else {
      patchLiveDashboard(next, feeRateRef.current)
    }
  }

  function updatePip(nextPositions: OpenPosition[], nextFeeRate: number) {
    if (!pipRoot.current || !Number.isFinite(nextFeeRate) || nextFeeRate < 0) return
    pipRoot.current.render(<PictureInPictureDashboard
      positions={estimateAllPositions(nextPositions, nextFeeRate)}
      totals={calculateLegacyLiveTotals(nextPositions, nextFeeRate)}
      updatedAt={Date.now()}
    />)
  }

  async function togglePictureInPicture() {
    if (pipWindow.current && !pipWindow.current.closed) {
      pipWindow.current.close()
      return
    }

    const pipApi = (window as Window & {
      documentPictureInPicture?: { requestWindow: (options: { width: number; height: number }) => Promise<Window> }
    }).documentPictureInPicture
    if (!pipApi) {
      setPipError('La ventana flotante requiere una versión reciente de Chrome o Edge.')
      return
    }

    try {
      setPipError('')
      const pip = await pipApi.requestWindow({ width: 390, height: 300 })
      pipWindow.current = pip
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(style => {
        pip.document.head.appendChild(style.cloneNode(true))
      })
      pip.document.title = 'Bitunix · operación en vivo'
      pip.document.body.classList.add('pip-window')
      const root = createRoot(pip.document.body)
      pipRoot.current = root
      pip.addEventListener('pagehide', () => {
        root.unmount()
        if (pipWindow.current === pip) {
          pipWindow.current = null
          pipRoot.current = null
          setPipOpen(false)
        }
      }, { once: true })
      updatePip(positionsRef.current, feeRateRef.current)
      setPipOpen(true)
    } catch {
      setPipError('No se pudo abrir la ventana flotante. Vuelve a intentarlo.')
    }
  }

  useEffect(() => () => {
    pipRoot.current?.unmount()
    pipWindow.current?.close()
  }, [])

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
    let timer = 0
    const load = async () => {
      if (busy.current) return
      busy.current = true
      controller = new AbortController()
      const started = performance.now()
      if (!hasReceivedData.current) setState('loading')
      try {
        const response = await fetch('/api/positions', { cache: 'no-store', signal: controller.signal })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || `Servicio local: HTTP ${response.status}.`)
        const payload = normalizeBitunixPayload(body)
        if (!active) return
        receivePositions(payload.positions)
        hasReceivedData.current = true
        const queryLatency = Math.round(performance.now() - started)
        const queriedAt = Date.now()
        if (isLocal) {
          patchMeta('last-query', clock(queriedAt))
          patchMeta('latency', `${queryLatency} ms`)
          patchMeta('data-time', payload.fetchedAt ? new Date(payload.fetchedAt).toLocaleTimeString() : '—')
        } else {
          setProxyTimestamp(payload.fetchedAt)
          setLatency(queryLatency)
          setLastQuery(queriedAt)
        }
        setError('')
        setState(current => current === 'connected' ? current : 'connected')
      } catch (cause) {
        if (!active || (cause instanceof DOMException && cause.name === 'AbortError')) return
        setError(cause instanceof Error ? cause.message : 'No se pudo consultar Bitunix.')
        if (!hasReceivedData.current) setState('error')
      } finally {
        busy.current = false
        if (active) timer = window.setTimeout(() => void load(), 2000)
      }
    }
    void load()
    return () => { active = false; window.clearTimeout(timer); controller?.abort(); busy.current = false }
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
      hasReceivedData.current = false
      setLastQuery(null)
      setState('loading')
    } catch (cause) {
      setState('error')
      setError(cause instanceof Error ? cause.message : 'No se pudo conectar.')
    }
  }

  async function saveUnlockAndTryPages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('loading')
    setError('')
    try {
      let credentials: BitunixCredentials
      if (vaultAvailable) {
        const vault = window.localStorage.getItem(VAULT_KEY)
        if (!vault) throw new Error('No se encontró la bóveda cifrada en este navegador.')
        credentials = await decryptCredentials(vault, vaultPassword)
      } else {
        credentials = { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }
        const vault = await encryptCredentials(credentials, vaultPassword)
        window.localStorage.setItem(VAULT_KEY, vault)
        setVaultAvailable(true)
        setApiKey('')
        setApiSecret('')
      }
      setVaultPassword('')
      setUnlockedCredentials(credentials)
      const payload = normalizeBitunixPayload(await fetchBitunixPositionsInBrowser(credentials))
      receivePositions(payload.positions)
      setProxyTimestamp(payload.fetchedAt)
      setLastQuery(Date.now())
      setState('connected')
    } catch (cause) {
      setState('error')
      setError(cause instanceof TypeError
        ? 'Bitunix bloqueó la consulta directa desde GitHub Pages (CORS). Las claves quedaron cifradas en este navegador; el navegador no envió la consulta firmada.'
        : cause instanceof Error ? cause.message : 'No se pudo conectar con Bitunix.')
    }
  }

  async function retryPagesConnection() {
    if (!unlockedCredentials) return
    setState('loading')
    setError('')
    try {
      const payload = normalizeBitunixPayload(await fetchBitunixPositionsInBrowser(unlockedCredentials))
      receivePositions(payload.positions)
      setProxyTimestamp(payload.fetchedAt)
      setLastQuery(Date.now())
      setState('connected')
    } catch (cause) {
      setState('error')
      setError(cause instanceof TypeError
        ? 'Bitunix bloqueó la consulta directa desde GitHub Pages (CORS). Las claves cifradas siguen en este navegador.'
        : cause instanceof Error ? cause.message : 'No se pudo conectar con Bitunix.')
    }
  }

  function erasePagesVault() {
    window.localStorage.removeItem(VAULT_KEY)
    setVaultAvailable(false)
    setUnlockedCredentials(null)
    setApiKey('')
    setApiSecret('')
    setVaultPassword('')
    positionsRef.current = []
    positionsShape.current = ''
    setPositionVersion(version => version + 1)
    setState('idle')
    setError('')
  }

  async function disconnect() {
    if (pipWindow.current && !pipWindow.current.closed) pipWindow.current.close()
    await fetch('/api/disconnect', { method: 'POST', cache: 'no-store' }).catch(() => undefined)
    setConnected(false)
    hasReceivedData.current = false
    setApiKey('')
    setApiSecret('')
    setState('idle')
    positionsRef.current = []
    positionsShape.current = ''
    setPositionVersion(version => version + 1)
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

    <div className="security-note"><strong>{isLocal ? 'Las claves viven solo en la memoria del helper Docker.' : 'Las credenciales guardadas quedan cifradas en este navegador.'}</strong><span>{isLocal ? 'Se borran al desconectar o al parar el contenedor.' : 'Cifrado AES-GCM con una contraseña que solo tú conoces. La contraseña no se guarda; la necesitarás después de cada refresco.'} Usa una API key con permiso de lectura únicamente.</span></div>

    {!isLocal ? <>
      <form className="panel bitunix-controls credential-form pages-credential-form" onSubmit={saveUnlockAndTryPages}>
        {!vaultAvailable && <>
          <label className="field"><span>BITUNIX API KEY</span><input aria-label="Bitunix API key" type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={event => setApiKey(event.target.value)} required /></label>
          <label className="field"><span>BITUNIX API SECRET</span><input aria-label="Bitunix API secret" type="password" autoComplete="new-password" value={apiSecret} onChange={event => setApiSecret(event.target.value)} required /></label>
        </>}
        <label className="field"><span>{vaultAvailable ? 'CONTRASEÑA PARA DESBLOQUEAR' : 'CONTRASEÑA PARA CIFRAR'}</span><input aria-label="Contraseña de cifrado" type="password" autoComplete="new-password" minLength={vaultAvailable ? undefined : 12} value={vaultPassword} onChange={event => setVaultPassword(event.target.value)} required /></label>
        <button className="connect-button" type="submit" disabled={state === 'loading'}>{vaultAvailable ? 'Desbloquear y probar' : 'Guardar cifradas y probar'}</button>
        {!vaultAvailable && <small className="vault-help">Contraseña de 12 caracteres o más. Si la olvidas, tendrás que borrar la bóveda y guardar las claves otra vez.</small>}
      </form>
      <div className="error-box pages-cors-note"><strong>Conexión desde Pages bloqueada por Bitunix</strong><p>La bóveda sí se guarda cifrada. Al probar, el navegador bloquea la consulta firmada porque Bitunix no autoriza CORS para GitHub Pages.</p></div>
      {vaultAvailable && <div className="vault-actions"><button className="connect-button disconnect" onClick={erasePagesVault}>Borrar credenciales cifradas</button></div>}
    </> : <>
      {!connected && <form className="panel bitunix-controls credential-form" onSubmit={connect}>
        <label className="field"><span>API KEY · SOLO LECTURA</span><input aria-label="Bitunix API key" type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={event => setApiKey(event.target.value)} required /></label>
        <label className="field"><span>API SECRET</span><input aria-label="Bitunix API secret" type="password" autoComplete="new-password" value={apiSecret} onChange={event => setApiSecret(event.target.value)} required /></label>
        <label className="field"><span>FEE TAKER DE CIERRE</span><div className="input-wrap"><input aria-label="Fee taker de cierre" type="number" min="0" max="2" step="0.001" value={closingFeePercent} onChange={event => setClosingFeePercent(event.target.value)} /><span className="suffix">%</span></div></label>
        <button className="connect-button" type="submit" disabled={!feeValid || state === 'loading'}>Conectar en modo lectura</button>
        {!feeValid && <p className="inline-error">El fee debe ser un porcentaje válido no negativo.</p>}
      </form>}
      {connected && <section className="panel bitunix-controls connected-controls">
        <div className="connect-actions"><button className="connect-button secondary" onClick={() => setRefreshToken(value => value + 1)}>↻ Actualizar ahora</button><button className="connect-button secondary" onClick={() => void togglePictureInPicture()}>{pipOpen ? 'Cerrar ventana flotante' : '↗ Ventana flotante'}</button><button className="connect-button disconnect" onClick={disconnect}>Desconectar y borrar claves</button></div>
        {pipError && <p className="pip-error" role="status">{pipError}</p>}
        {!feeValid && <p className="inline-error">El fee debe ser un porcentaje válido no negativo.</p>}
        <div className="poll-meta"><span>ÚLTIMA CONSULTA <b data-live-meta="last-query">{clock(lastQuery)}</b></span><span>LATENCIA <b data-live-meta="latency">{latency === null ? '—' : `${latency} ms`}</b></span><span>DATOS DE BITUNIX <b data-live-meta="data-time">{proxyTimestamp ? new Date(proxyTimestamp).toLocaleTimeString() : '—'}</b></span><span>ACTUALIZACIÓN <b>2s</b></span></div>
      </section>}
    </>}

    {error && <div className="error-box bitunix-error"><strong>No se pudo actualizar</strong><p>{error}</p></div>}
    {state === 'connected' && <>
      <section className="aggregate-grid">
        <div className="aggregate-card"><div><span>PNL NETO DE POSICIONES</span></div><strong data-live-total="net" className={baseTotal >= 0 ? 'good' : 'bad'}>{money(baseTotal)} <small>USDT</small></strong></div>
        <div className="aggregate-card"><div><span>PNL FLOTANTE</span></div><strong data-live-total="unrealized" className={unrealizedTotal >= 0 ? 'good' : 'bad'}>{money(unrealizedTotal)} <small>USDT</small></strong></div>
        <div className="aggregate-card close-summary"><div><span>ESTIMADO NETO SI CIERRAS AHORA</span><strong data-live-total="close" className={total === null ? '' : total >= 0 ? 'good' : 'bad'}>{total === null ? '—' : money(total)} <small>USDT</small></strong></div><label>Fee taker %<input aria-label="Fee taker de cierre" type="number" min="0" max="2" step="0.001" value={closingFeePercent} onChange={event => { const nextFee = event.target.value; feeRateRef.current = nextFee.trim() === '' ? Number.NaN : Number(nextFee); setClosingFeePercent(nextFee); updatePip(positionsRef.current, feeRateRef.current) }} /></label></div>
      </section>
      {!feeValid ? <div className="error-box"><strong>Fee de cierre inválido</strong><p>Introduce un porcentaje válido no negativo.</p></div> : positions.length === 0 ? <div className="empty-positions"><span>—</span><strong>No hay posiciones abiertas</strong><p>Bitunix no devolvió posiciones activas.</p></div> : <section className="position-table panel">
        <div className="position-table-header"><span>Posición</span><span>Entrada → marca</span><span>Diferencia de precio<br /><small>Marca − entrada</small></span><span>Flotante</span><span>Realizado</span><span>Te quedaría al cerrar</span><span>Break-even</span><span>Movimiento BE</span></div>
        <div className="position-list">{estimates.map(position => <PositionRow key={position.positionId} position={position} />)}</div>
      </section>}
      {!isLocal && <div className="connected-controls"><button className="connect-button secondary" onClick={() => void retryPagesConnection()}>↻ Actualizar ahora</button><button className="connect-button disconnect" onClick={erasePagesVault}>Desconectar y borrar claves</button><span>Consulta {clock(lastQuery)}</span></div>}
    </>}
    {isLocal && !connected && !error && <div className="empty-positions setup-empty"><span>◉</span><strong>Conecta tu cuenta para ver tus posiciones</strong><p>La API key se valida con Bitunix; no se guarda en el navegador.</p></div>}
    <p className="estimate-disclaimer">Estimación con mark price y fee de cierre editable. El resultado real puede variar por tarifa efectiva, funding posterior, slippage y precio de ejecución.</p>
  </section>
}

const PositionRow = memo(function PositionRow({ position }: { position: PositionEstimate }) {
  const long = position.side === 'LONG'
  return <div className="position-row" data-live-position={position.positionId}>
    <div className="position-cell position-name"><strong><span data-live="side" className={`side-tag ${long ? 'long' : 'short'}`}>{long ? 'BUY' : 'SELL'}</span> <span data-live="symbol">{position.symbol}</span></strong><small><span data-live="qty">{amount(position.qty)}</span> · <span data-live="leverage">{position.leverage ? amount(position.leverage) : '—'}</span>×</small></div>
    <div className="position-cell position-prices"><span data-live="entry">{marketPrice(position.avgOpenPrice)}</span> → <span data-live="mark">{marketPrice(position.markPrice)}</span></div>
    <div className="position-cell position-difference"><strong data-live="price-diff">{priceDifference(position.avgOpenPrice, position.markPrice)}</strong></div>
    <div className="position-cell"><strong data-live="unrealized" className={position.unrealizedPnl >= 0 ? 'good' : 'bad'}>{money(position.unrealizedPnl)}</strong></div>
    <div className="position-cell"><strong data-live="realized" className={position.realizedPnl >= 0 ? 'good' : 'bad'}>{money(position.realizedPnl)}</strong></div>
    <div className="position-cell"><strong data-live="close-pnl" className={position.estimatedNetIfClosedNow >= 0 ? 'good' : 'bad'}>{money(position.estimatedNetIfClosedNow)}</strong></div>
    <div className="position-cell"><strong data-live="break-even">{marketPrice(position.breakEvenPrice)}</strong></div>
    <div className="position-cell"><strong data-live="break-even-move" className={position.breakEvenMovePercent <= 0 ? 'good' : 'bad'}>{position.breakEvenMovePercent > 0 ? '+' : ''}{position.breakEvenMovePercent.toFixed(2)}%</strong></div>
  </div>
}, (previous, next) => previous.position === next.position)

function PictureInPictureDashboard({ positions, totals, updatedAt }: {
  positions: PositionEstimate[]
  totals: ReturnType<typeof calculateLegacyLiveTotals>
  updatedAt: number
}) {
  return <main className="pip-dashboard">
    <header><strong>BITUNIX <em>· EN VIVO</em></strong><span>ACTUALIZADO {clock(updatedAt)}</span></header>
    <section className="pip-total"><span>ESTIMADO NETO SI CIERRAS AHORA</span><strong className={totals.estimatedClosePnl >= 0 ? 'good' : 'bad'}>{money(totals.estimatedClosePnl)} <small>USDT</small></strong></section>
    <div className="pip-summaries"><span>PNL NETO <b className={totals.netPnl >= 0 ? 'good' : 'bad'}>{money(totals.netPnl)}</b></span><span>FLOTANTE <b className={totals.unrealizedPnl >= 0 ? 'good' : 'bad'}>{money(totals.unrealizedPnl)}</b></span></div>
    <section className="pip-positions">{positions.length === 0 ? <p>No hay posiciones abiertas.</p> : positions.map(position => <article key={position.positionId}>
      <div className="pip-position-heading"><strong><i className={position.side === 'LONG' ? 'long' : 'short'}>{position.side === 'LONG' ? 'BUY' : 'SELL'}</i> {position.symbol}</strong><span>{amount(position.qty)} · {position.leverage ? amount(position.leverage) : '—'}×</span></div>
      <div className="pip-price">{marketPrice(position.avgOpenPrice)} → {marketPrice(position.markPrice)}</div>
      <div className="pip-position-footer"><span>PNL FLOTANTE <b className={position.unrealizedPnl >= 0 ? 'good' : 'bad'}>{money(position.unrealizedPnl)}{unrealizedPercentLabel(position)}</b></span><span>BREAK-EVEN <b>{marketPrice(position.breakEvenPrice)}</b></span><span>MOV. BE <b className={position.breakEvenMovePercent <= 0 ? 'good' : 'bad'}>{position.breakEvenMovePercent > 0 ? '+' : ''}{position.breakEvenMovePercent.toFixed(2)}%</b></span></div>
    </article>)}</section>
  </main>
}

function patchMeta(name: string, value: string) {
  const element = document.querySelector<HTMLElement>(`[data-live-meta="${name}"]`)
  if (element && element.textContent !== value) element.textContent = value
}

function patchLiveDashboard(positions: OpenPosition[], closingFeePercent: number) {
  if (typeof document === 'undefined' || !Number.isFinite(closingFeePercent) || closingFeePercent < 0) return
  const estimates = estimateAllPositions(positions, closingFeePercent)
  const totals = calculateLegacyLiveTotals(positions, closingFeePercent)
  patchTotal('net', totals.netPnl)
  patchTotal('unrealized', totals.unrealizedPnl)
  patchTotal('close', totals.estimatedClosePnl)

  const estimatesById = new Map(estimates.map(estimate => [estimate.positionId, estimate]))
  document.querySelectorAll<HTMLElement>('[data-live-position]').forEach(card => {
    const estimate = estimatesById.get(card.dataset.livePosition ?? '')
    if (!estimate) return
    const symbol = card.querySelector<HTMLElement>('[data-live="symbol"]')
    if (symbol && symbol.textContent !== estimate.symbol) symbol.textContent = estimate.symbol
    const sideTag = card.querySelector<HTMLElement>('[data-live="side"]')
    if (sideTag) {
      const sideText = estimate.side === 'LONG' ? 'BUY' : 'SELL'
      if (sideTag.textContent !== sideText) sideTag.textContent = sideText
      sideTag.classList.toggle('long', estimate.side === 'LONG')
      sideTag.classList.toggle('short', estimate.side === 'SHORT')
    }
    setLiveText(card, 'close-pnl', money(estimate.estimatedNetIfClosedNow))
    setLiveTone(card, 'close-pnl', estimate.estimatedNetIfClosedNow)
    setLiveText(card, 'qty', amount(estimate.qty))
    setLiveText(card, 'leverage', estimate.leverage ? amount(estimate.leverage) : '—')
    setLiveText(card, 'entry', marketPrice(estimate.avgOpenPrice))
    setLiveText(card, 'mark', marketPrice(estimate.markPrice))
    setLiveText(card, 'price-diff', priceDifference(estimate.avgOpenPrice, estimate.markPrice))
    setLiveText(card, 'break-even', `${marketPrice(estimate.breakEvenPrice)} USDT`)
    const breakEvenMove = `${estimate.breakEvenMovePercent > 0 ? '+' : ''}${estimate.breakEvenMovePercent.toFixed(2)}%`
    setLiveText(card, 'break-even-move', breakEvenMove)
    setLiveTone(card, 'break-even-move', estimate.breakEvenMovePercent, true)
    setLiveText(card, 'unrealized', money(estimate.unrealizedPnl))
    setLiveTone(card, 'unrealized', estimate.unrealizedPnl)
    setLiveText(card, 'realized', money(estimate.realizedPnl))
    setLiveTone(card, 'realized', estimate.realizedPnl)
  })
}

function patchTotal(name: string, value: number) {
  const element = document.querySelector<HTMLElement>(`[data-live-total="${name}"]`)
  if (!element) return
  const amountText = money(value)
  const amountNode = element.firstChild
  if (amountNode && amountNode.textContent !== amountText) amountNode.textContent = amountText
  setTone(element, value)
}

function setLiveText(card: HTMLElement, field: string, value: string) {
  const element = card.querySelector<HTMLElement>(`[data-live="${field}"]`)
  if (element && element.textContent !== value) element.textContent = value
}

function setLiveTone(card: HTMLElement, field: string, value: number, favorNegative = false) {
  const element = card.querySelector<HTMLElement>(`[data-live="${field}"]`)
  if (element) setTone(element, favorNegative ? -value : value)
}

function setTone(element: HTMLElement, value: number) {
  element.classList.toggle('good', value >= 0)
  element.classList.toggle('bad', value < 0)
}

function priceDifference(entry: number, mark: number) {
  const delta = mark - entry
  const sign = delta > 0 ? '+' : ''
  const percent = delta / entry * 100
  return `${sign}${delta.toLocaleString('en-US', { maximumSignificantDigits: 8 })} USDT · ${sign}${percent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

function unrealizedPercentLabel(position: PositionEstimate) {
  const percent = unrealizedPnlPercent(position)
  if (percent === null) return ''
  return ` (${percent > 0 ? '+' : ''}${percent.toFixed(2)}%)`
}
