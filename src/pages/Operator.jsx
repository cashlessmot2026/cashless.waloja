import { useState } from 'react'
import { useEffect } from 'react'
import { rpc, money } from '../lib/supabase'
import { Shell, Field } from '../components/ui'
import ScanField from '../components/ScanField'
import { AccountForm } from './Admin'
import { t } from '../lib/i18n'

export default function Operator({ onLogout }) {
  const [tab, setTab] = useState('charge')
  const [me, setMe] = useState(null)
  useEffect(() => { rpc('staff_me').then(setMe).catch(() => {}) }, [])
  const tabs = [
    { id: 'charge', icon: '💳', label: t('tab.charge') },
    { id: 'balance', icon: '👁', label: t('tab.balance') },
    { id: 'acc', icon: '◉', label: t('tab.acc') },
  ]
  return (
    <Shell title={t('op.title')} subtitle={me ? `${me.full_name} · ${me.venue_name || t('op.novenue')}` : ''}
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
      setRes({ ok: true, msg: t('op.ok', { a: money(r.charged), b: money(r.balance) }) })
      setClient({ ...client, balance: r.balance }); setAmount('')
    } catch (x) { setRes({ ok: false, msg: x.message }); if (x.code?.includes('SIN_SALDO')) setClient((c) => c && { ...c, balance: Math.min(c.balance, 0) }) }
    setBusy(false)
  }
  const noBal = client && !client.unlimited && Number(client.balance) <= 0
  const insuff = client && !client.unlimited && amount && Number(amount) > Number(client.balance)

  return (
    <div className="stack narrow">
      {noVenue && <div className="alert warn">{t('op.warn')}</div>}
      <div className="panel"><h3>{t('op.scan')}</h3><ScanField onScan={scan} placeholder={t('op.ph')} /></div>

      {res && !client && <div className="alert bad">{res.msg}</div>}

      {client && (
        <div className="panel">
          <div className="between"><h3>{client.full_name}</h3><button className="btn ghost small" onClick={reset}>{t('common.new')}</button></div>
          <p className="muted">{t('op.cc')} {client.id_number}{client.bracelet_uid ? <> · 🔖 {t('op.bracelet')}: <b>{client.bracelet_label || client.bracelet_uid}</b></> : ''}</p>
          {Number(client.balance) < 0 && <small>{t('op.owed')}</small>}
          <div className="bal">{money(Math.abs(client.balance))}</div>
          {client.unlimited && <div className="alert good">{t('op.unlimited')}</div>}
          {!client.active && <div className="alert bad">{t('op.inactive')}</div>}
          {noBal && client.active && <div className="alert bad big">{t('op.nobal')}</div>}
          {!noBal && client.active && (
            <form onSubmit={charge} className="stack">
              <Field label={t('op.amount')}>
                <input type="number" inputMode="decimal" min="1" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus placeholder="0" />
              </Field>
              {insuff && <div className="alert bad">{t('op.insuff')}</div>}
              <button className="btn" disabled={busy || insuff || !amount}>{busy ? t('op.charging') : t('op.charge')}</button>
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
      <div className="panel"><h3>{t('op.check')}</h3><ScanField onScan={scan} placeholder={t('op.ph')} /></div>
      {err && <div className="alert bad">{err}</div>}
      {c && (
        <div className="panel center">
          <h3>{c.full_name}</h3>
          <p className="muted">{t('op.cc')} {c.id_number}{c.bracelet_uid ? <> · 🔖 {t('op.bracelet')}: <b>{c.bracelet_label || c.bracelet_uid}</b></> : ''}</p>
          {Number(c.balance) < 0 && <small>{t('op.owed')}</small>}
          <div className="bal">{money(Math.abs(c.balance))}</div>
          {c.unlimited && <div className="alert good">{t('op.unlimited')}</div>}
          {!c.unlimited && Number(c.balance) <= 0 && <div className="alert bad big">{t('op.nobal')}</div>}
        </div>
      )}
    </div>
  )
}
