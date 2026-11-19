import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { rpc, money, dt } from '../lib/supabase'
import { Shell, Modal, Field } from '../components/ui'
import InstallButton, { InstaLink } from '../components/Install'
import { ConsentGate, ConsentModal, CONSENT_VERSION } from '../components/Consent'

const COLORS = ['#4f6bff', '#d9a56e', '#e58a8a', '#a06bff', '#4fd1c5']

function Donut({ data, total, balance, hide }) {
  const R = 84, C = 2 * Math.PI * R
  let off = 0
  const sum = data.reduce((a, b) => a + Number(b.total), 0) || 1
  return (
    <div className="donut">
      <svg viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
        {data.map((d, i) => {
          const len = (Number(d.total) / sum) * C
          const el = <circle key={i} cx="100" cy="100" r={R} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="10"
            strokeLinecap="round" strokeDasharray={`${Math.max(len - 4, 1)} ${C}`} strokeDashoffset={-off}
            transform="rotate(-90 100 100)" />
          off += len
          return el
        })}
      </svg>
      <div className="donut-in"><small>Saldo disponible</small><strong>{hide ? '••••' : money(balance)}</strong></div>
    </div>
  )
}

export default function Guest({ onLogout }) {
  const [tab, setTab] = useState('home')
  const [me, setMe] = useState(null)
  const [tx, setTx] = useState([])
  const [by, setBy] = useState([])
  const [menu, setMenu] = useState([])
  const [hide, setHide] = useState(false)
  const [qr, setQr] = useState(false)
  const [pinOpen, setPinOpen] = useState(false)
  const [legal, setLegal] = useState(false)

  const load = useCallback(async () => {
    try {
      const [m, t, b, mn] = await Promise.all([rpc('guest_me'), rpc('guest_transactions'), rpc('guest_spending_by_venue'), rpc('guest_menu')])
      setMe(m); setTx(t); setBy(b); setMenu(mn)
    } catch { /* manejado en rpc */ }
  }, [])
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i) }, [load])

  if (!me) return <div className="splash">Cargando…</div>
  if (!me.consent_at) return <ConsentGate onDecline={onLogout} onAccept={async () => { await rpc('guest_accept_consent', { p_version: CONSENT_VERSION }); await load() }} />
  const tabs = [
    { id: 'home', icon: '⌂', label: 'Inicio' },
    { id: 'menu', icon: '🍽', label: 'Carta' },
    { id: 'tx', icon: '☰', label: 'Consumos' },
    { id: 'me', icon: '◉', label: 'Perfil' },
  ]
  const qrVal = 'CL:' + me.qr_code

  return (
    <Shell title={me.full_name} subtitle="Bienvenido" tabs={tabs} tab={tab} setTab={setTab} onLogout={onLogout}
      fab={{ onClick: () => setQr(true), label: 'Mi QR' }}>
      {tab === 'home' && (
        <div className="stack">
          <div className="card-wallet">
            <div className="between"><span>Saldo disponible</span><button className="eye" onClick={() => setHide(!hide)}>{hide ? '🙈' : '👁'}</button></div>
            <div className="big">{hide ? '••••••' : money(me.balance)}</div>
            <div className="between small">
              <span>Pulsera NFC<br /><b>{me.nfc_uid || 'Sin asignar'}</b></span>
              <span style={{ textAlign: 'right' }}>Cédula<br /><b>{me.id_number}</b></span>
            </div>
          </div>
          <div className="grid2">
            <div className="chip in"><span>↗</span><div><small>Recargas</small><b>{money(me.total_topup)}</b></div></div>
            <div className="chip out"><span>↘</span><div><small>Consumos</small><b>{money(me.total_spent)}</b></div></div>
          </div>
          <div className="panel">
            <h3>Gastos por lugar</h3>
            {by.length === 0 ? <p className="muted">Aún no tienes consumos.</p> : (
              <>
                <Donut data={by} balance={me.balance} hide={hide} />
                <div className="legend">{by.map((d, i) => (
                  <div key={i} className="lg"><i style={{ background: COLORS[i % COLORS.length] }} />{d.venue}<b>{money(d.total)}</b></div>))}</div>
              </>
            )}
          </div>
          <div className="panel">
            <h3>Actividad reciente</h3>
            <TxList items={tx.slice(0, 5)} />
          </div>
          <button className="btn" onClick={() => setQr(true)}>▣ Mostrar mi código QR</button>
          <InstaLink />
        </div>
      )}
      {tab === 'tx' && <div className="panel"><h3>Todos mis consumos</h3><TxList items={tx} /></div>}
      {tab === 'menu' && <Menu items={menu} />}
      {tab === 'me' && (
        <div className="stack">
          <div className="panel kv">
            <h3>Detalles de la reserva</h3>
            <p><span>Nombre</span><b>{me.full_name}</b></p>
            <p><span>{me.id_type}</span><b>{me.id_number}</b></p>
            <p><span>Teléfono</span><b>{me.phone || '—'}</b></p>
            <p><span>Inicio de reserva</span><b>{dt(me.check_in)}</b></p>
            <p><span>Pulsera NFC</span><b>{me.nfc_uid || 'Sin asignar'}</b></p>
          </div>
          <button className="btn ghost" onClick={() => setPinOpen(true)}>🔑 Cambiar mi contraseña (4 dígitos)</button>
          <InstaLink />
          <InstallButton />
          <button className="btn ghost" onClick={() => setLegal(true)}>📄 Política de datos personales</button>
          <button className="btn danger" onClick={onLogout}>Cerrar sesión</button>
        </div>
      )}
      {qr && (
        <Modal title="Mi código QR" onClose={() => setQr(false)}>
          <div className="qrbox"><QRCodeSVG value={qrVal} size={240} bgColor="#ffffff" fgColor="#0b0f2a" level="M" marginSize={2} /></div>
          <p className="muted center">Muéstralo al operario para pagar.<br />Pulsera: <b>{me.nfc_uid || 'sin asignar'}</b></p>
        </Modal>
      )}
      {pinOpen && <PinForm onClose={() => setPinOpen(false)} />}
      {legal && <ConsentModal onClose={() => setLegal(false)} />}
    </Shell>
  )
}

function TxList({ items }) {
  if (!items.length) return <p className="muted">Sin movimientos.</p>
  return (
    <div className="list">
      {items.map((t) => (
        <div key={t.id} className="item">
          <div className={'avatar ' + t.type}>{t.type === 'charge' ? '↘' : '↗'}</div>
          <div className="grow">
            <b>{t.type === 'charge' ? (t.description || 'Consumo') : 'Recarga de saldo'}</b>
            <small>{t.venue ? t.venue + ' · ' : ''}{dt(t.created_at)}</small>
          </div>
          <b className={t.type === 'charge' ? 'neg' : 'pos'}>{t.type === 'charge' ? '-' : '+'}{money(t.amount)}</b>
        </div>
      ))}
    </div>
  )
}

function Menu({ items }) {
  const groups = items.reduce((a, p) => ((a[p.venue] ||= []).push(p), a), {})
  const keys = Object.keys(groups)
  if (!keys.length) return <div className="panel"><p className="muted">La carta aún no está disponible.</p></div>
  return (
    <div className="stack">
      {keys.map((v) => (
        <div key={v} className="panel">
          <h3>{v}</h3>
          <div className="list">{groups[v].map((p) => (
            <div key={p.id} className="item"><div className="grow"><b>{p.name}</b><small>{p.category || ''}</small></div><b>{money(p.price)}</b></div>))}</div>
        </div>
      ))}
    </div>
  )
}

function PinForm({ onClose }) {
  const [o, setO] = useState(''); const [n, setN] = useState(''); const [msg, setMsg] = useState(null)
  const go = async (e) => {
    e.preventDefault()
    try { await rpc('guest_change_pin', { p_old: o, p_new: n }); setMsg({ ok: true, t: 'Contraseña actualizada.' }); setO(''); setN('') }
    catch (x) { setMsg({ ok: false, t: x.message }) }
  }
  return (
    <Modal title="Cambiar contraseña" onClose={onClose}>
      <form onSubmit={go} className="stack">
        <Field label="Contraseña actual"><input type="password" inputMode="numeric" maxLength={4} value={o} onChange={(e) => setO(e.target.value)} required /></Field>
        <Field label="Nueva contraseña (4 dígitos)"><input type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={n} onChange={(e) => setN(e.target.value)} required /></Field>
        {msg && <div className={'alert small ' + (msg.ok ? 'good' : 'bad')}>{msg.t}</div>}
        <button className="btn">Guardar</button>
      </form>
    </Modal>
  )
}
