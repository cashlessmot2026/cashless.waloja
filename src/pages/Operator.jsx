import { useState } from 'react'
import { useEffect } from 'react'
import { rpc, money } from '../lib/supabase'
import { Shell, Field } from '../components/ui'
import ScanField from '../components/ScanField'
import { AccountForm } from './Admin'

export default function Operator({ onLogout }) {
  const [tab, setTab] = useState('charge')
  const [me, setMe] = useState(null)
  useEffect(() => { rpc('staff_me').then(setMe).catch(() => {}) }, [])
  const tabs = [
    { id: 'charge', icon: '💳', label: 'Cobrar' },
    { id: 'balance', icon: '👁', label: 'Saldo' },
    { id: 'acc', icon: '◉', label: 'Cuenta' },
  ]
  return (
    <Shell title="Operario" subtitle={me ? `${me.full_name} · ${me.venue_name || 'Sin lugar asignado'}` : ''}
      tabs={tabs} tab={tab} setTab={setTab} onLogout={onLogout}>
      {tab === 'charge' && <Charge noVenue={me && !me.venue_id} />}
      {tab === 'balance' && <Balance />}
      {tab === 'acc' && <AccountForm />}
    </Shell>
  )
}

function Charge({ noVenue }) {
  const [code, setCode] = useState('')
  const [client, setClient] = useState(null)
  const [amount, setAmount] = useState('')
  const [res, setRes] = useState(null) // {ok,msg}
  const [busy, setBusy] = useState(false)

  const reset = () => { setCode(''); setClient(null); setAmount(''); setRes(null) }
  const scan = async (c) => {
    setRes(null); setAmount('')
    try { const r = await rpc('staff_lookup', { p_code: c }); setCode(c); setClient(r) }
    catch (e) { setClient(null); setRes({ ok: false, msg: e.message }) }
  }
  const charge = async (e) => {
    e.preventDefault()
    setBusy(true); setRes(null)
    try {
      const r = await rpc('operator_charge', { p_code: code, p_amount: Number(amount) })
      setRes({ ok: true, msg: `Cobro exitoso: ${money(r.charged)}. Saldo restante: ${money(r.balance)}` })
      setClient({ ...client, balance: r.balance }); setAmount('')
    } catch (x) { setRes({ ok: false, msg: x.message }); if (x.code?.includes('SIN_SALDO')) setClient((c) => c && { ...c, balance: Math.min(c.balance, 0) }) }
    setBusy(false)
  }
  const noBal = client && Number(client.balance) <= 0
  const insuff = client && amount && Number(amount) > Number(client.balance)

  return (
    <div className="stack narrow">
      {noVenue && <div className="alert warn">Tu usuario no tiene lugar asignado. Pide al administrador que te asigne Bar/Restaurante.</div>}
      <div className="panel"><h3>Escanear cliente</h3><ScanField onScan={scan} placeholder="Lector USB + Enter (QR / pulsera)" /></div>

      {res && !client && <div className="alert bad">{res.msg}</div>}

      {client && (
        <div className="panel">
          <div className="between"><h3>{client.full_name}</h3><button className="btn ghost small" onClick={reset}>Nuevo</button></div>
          <p className="muted">CC {client.id_number}</p>
          <div className="bal">{money(client.balance)}</div>
          {!client.active && <div className="alert bad">CLIENTE INACTIVO</div>}
          {noBal && client.active && <div className="alert bad big">⚠ CLIENTE SIN SALDO</div>}
          {!noBal && client.active && (
            <form onSubmit={charge} className="stack">
              <Field label="Valor a cobrar">
                <input type="number" inputMode="decimal" min="1" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus placeholder="0" />
              </Field>
              {insuff && <div className="alert bad">Saldo insuficiente para este valor</div>}
              <button className="btn" disabled={busy || insuff || !amount}>{busy ? 'Cobrando…' : 'Cobrar'}</button>
            </form>
          )}
          {res && <div className={'alert ' + (res.ok ? 'good' : 'bad big')}>{res.ok ? '✔ ' : '⚠ '}{res.msg}</div>}
        </div>
      )}
    </div>
  )
}

function Balance() {
  const [c, setC] = useState(null)
  const [err, setErr] = useState('')
  const scan = async (code) => {
    setErr('')
    try { setC(await rpc('staff_lookup', { p_code: code })) } catch (e) { setC(null); setErr(e.message) }
  }
  return (
    <div className="stack narrow">
      <div className="panel"><h3>Consultar saldo</h3><ScanField onScan={scan} placeholder="Lector USB + Enter (QR / pulsera)" /></div>
      {err && <div className="alert bad">{err}</div>}
      {c && (
        <div className="panel center">
          <h3>{c.full_name}</h3>
          <p className="muted">CC {c.id_number}</p>
          <div className="bal">{money(c.balance)}</div>
          {Number(c.balance) <= 0 && <div className="alert bad big">⚠ CLIENTE SIN SALDO</div>}
        </div>
      )}
    </div>
  )
}
