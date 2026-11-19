import { useCallback, useEffect, useState } from 'react'
import { rpc, money, dt } from '../lib/supabase'
import { Shell, Modal, Field } from '../components/ui'
import ScanField from '../components/ScanField'
import { normUid } from '../lib/nfc'
import InstallButton from '../components/Install'
import { t } from '../lib/i18n'

const ID_TYPES = ['CC', 'CE', 'TI', 'Pasaporte', 'NIT', 'Otro']

export default function Admin({ onLogout }) {
  const [tab, setTab] = useState('guests')
  const [detail, setDetail] = useState(null) // id del cliente abierto
  const [ver, setVer] = useState(0)          // refresca listas al cerrar la ficha
  const tabs = [
    { id: 'guests', icon: '👥', label: 'Clientes' },
    { id: 'history', icon: '🧾', label: 'Historial' },
    { id: 'topup', icon: '＋', label: 'Recargar' },
    { id: 'staff', icon: '🧑‍🍳', label: 'Operarios' },
    { id: 'venues', icon: '🏨', label: 'Lugares' },
    { id: 'stock', icon: '📦', label: 'Inventario' },
    { id: 'acc', icon: '◉', label: 'Cuenta' },
  ]
  return (
    <Shell title="Administrador" subtitle="Panel de control" tabs={tabs} tab={tab} setTab={setTab} onLogout={onLogout}>
      {tab === 'guests' && <Guests onOpen={setDetail} ver={ver} />}
      {tab === 'history' && <History onOpen={setDetail} ver={ver} />}
      {tab === 'topup' && <Topup />}
      {tab === 'staff' && <Staff />}
      {tab === 'venues' && <Venues />}
      {tab === 'stock' && <Stock />}
      {tab === 'acc' && <AccountForm />}
      {detail && <GuestDetail id={detail} onClose={() => { setDetail(null); setVer((v) => v + 1) }} />}
    </Shell>
  )
}

const useList = (fn, args = {}) => {
  const [d, setD] = useState([])
  const key = JSON.stringify(args)
  const load = useCallback(() => rpc(fn, args).then(setD).catch(() => {}), [fn, key])
  useEffect(() => { load() }, [load])
  return [d, load]
}
const Msg = ({ m }) => m ? <div className={'alert small ' + (m.ok ? 'good' : 'bad')}>{m.t}</div> : null
const confirmDel = (what) => window.confirm(`¿Eliminar ${what}? Esta acción no se puede deshacer.`)

// saldo: si es negativo (saldo ilimitado) es lo que debe pagar en el checkout
const Bal = ({ v }) => Number(v) < 0
  ? <b className="neg">{money(-v)} <small>por pagar</small></b>
  : <b>{money(v)}</b>

const braceletText = (t) => t.bracelet_label || t.bracelet_uid
  ? `🔖 ${t.bracelet_label || ''}${t.bracelet_label && t.bracelet_uid ? ` (${t.bracelet_uid})` : t.bracelet_uid || ''}`
  : (t.type === 'charge' ? '▣ QR' : '')

function TxRow({ t: x, showGuest, onOpen }) {
  const charge = x.type === 'charge'
  const extra = [dt(x.created_at), x.venue, braceletText(x), x.staff && `por ${x.staff}`].filter(Boolean).join(' · ')
  return (
    <div className={'item' + (onOpen ? ' btnrow' : '')} onClick={onOpen} role={onOpen ? 'button' : undefined}>
      <div className={'avatar ' + x.type}>{charge ? '↘' : '↗'}</div>
      <div className="grow">
        <b>{showGuest && <>{x.guest} · </>}{x.description || (charge ? 'Consumo' : 'Recarga de saldo')}</b>
        <small>{extra}</small>
      </div>
      <div className="end">
        <b className={charge ? 'neg' : 'pos'}>{charge ? '-' : '+'}{money(x.amount)}</b>
        {x.balance_after != null && !showGuest && <small>saldo {money(x.balance_after)}</small>}
      </div>
    </div>
  )
}

function Filter({ value, onChange, counts }) {
  return (
    <div className="seg seg3">
      {[['all', 'Todos'], ['charge', 'Consumos'], ['topup', 'Recargas']].map(([k, l]) => (
        <button key={k} type="button" className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}{counts ? ` (${counts[k]})` : ''}</button>
      ))}
    </div>
  )
}
const countBy = (rows) => ({ all: rows.length, charge: rows.filter((r) => r.type === 'charge').length, topup: rows.filter((r) => r.type === 'topup').length })

/* ---------------- CLIENTES ---------------- */
function Guests({ onOpen, ver }) {
  const [q, setQ] = useState('')
  const [list, load] = useList('admin_list_guests', { p_search: q || null })
  useEffect(() => { if (ver) load() }, [ver])
  const [edit, setEdit] = useState(null) // {} nuevo | guest
  const del = async (g) => { if (confirmDel(g.full_name)) { await rpc('admin_delete_guest', { p_id: g.id }).catch((e) => alert(e.message)); load() } }
  const toggle = async (g) => { await rpc('admin_update_guest', { p_id: g.id, p_full_name: g.full_name, p_id_type: g.id_type, p_id_number: g.id_number, p_phone: g.phone, p_bracelets: null, p_active: !g.active }).catch((e) => alert(e.message)); load() }
  return (
    <div className="stack">
      <div className="row">
        <input type="search" placeholder="Buscar por cédula, nombre o teléfono…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn small" onClick={() => setEdit({})}>＋ Nuevo</button>
      </div>
      <p className="hint">Toca un cliente para ver su ficha, su historial de transacciones y activar el saldo ilimitado.</p>
      <div className="list panel">
        {list.length === 0 && <p className="muted">Sin clientes.</p>}
        {list.map((g) => (
          <div key={g.id} className="item wrapm">
            <button type="button" className="grow linkrow" onClick={() => onOpen(g.id)}>
              <b>{g.full_name} {!g.active && <em className="tag off">inactivo</em>}{g.unlimited && <em className="tag inf">∞ ilimitado</em>}</b>
              <small>{g.id_type} {g.id_number} · {g.phone || 'sin tel.'} · 🔖 {g.bracelets.length ? g.bracelets.map((b) => b.label || b.uid).join(', ') : 'sin pulsera'}</small>
            </button>
            <Bal v={g.balance} />
            <div className="acts">
              <button className="btn small" onClick={() => onOpen(g.id)}>Ver historial</button>
              <button className="btn ghost small" onClick={() => setEdit(g)}>Editar</button>
              <button className="btn ghost small" onClick={() => toggle(g)}>{g.active ? 'Desactivar' : 'Activar'}</button>
              <button className="btn danger small" onClick={() => del(g)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
      {edit && <GuestForm g={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </div>
  )
}

/* ---------------- FICHA DEL CLIENTE + HISTORIAL ---------------- */
function GuestDetail({ id, onClose }) {
  const [d, setD] = useState(null)
  const [m, setM] = useState(null)
  const [filter, setFilter] = useState('all')
  const [edit, setEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => rpc('admin_guest_detail', { p_id: id }).then(setD).catch((e) => setM({ ok: false, t: e.message })), [id])
  useEffect(() => { load() }, [load])

  const setUnlimited = async (v) => {
    if (!v || window.confirm('El cliente podrá consumir aunque no tenga saldo. Lo consumido se acumula y se paga en el checkout. ¿Activar?')) {
      setBusy(true); setM(null)
      try {
        await rpc('admin_set_unlimited', { p_id: id, p_value: v }); await load()
        setM({ ok: true, t: v ? 'Saldo ilimitado activado: los consumos se pagan en el checkout.' : 'Saldo ilimitado desactivado.' })
      } catch (x) { setM({ ok: false, t: x.message }) }
      setBusy(false)
    }
  }
  const rows = d ? d.transactions.filter((x) => filter === 'all' || x.type === filter) : []
  const owed = d && Number(d.balance) < 0

  return (
    <Modal title={d ? d.full_name : 'Cliente'} onClose={onClose} wide>
      {!d ? (m ? <Msg m={m} /> : <p className="muted">Cargando…</p>) : (
        <div className="stack">
          <div className="card-wallet">
            <div className="between"><span>{owed ? 'Por pagar en el checkout' : 'Saldo disponible'}</span>{!d.active && <em className="tag off">inactivo</em>}</div>
            <div className="big">{money(Math.abs(d.balance))}</div>
            <div className="between small">
              <span>{d.id_type} {d.id_number}<br />{d.phone || 'sin teléfono'}</span>
              <span style={{ textAlign: 'end' }}>Inicio de reserva<br /><b>{dt(d.check_in)}</b></span>
            </div>
          </div>

          <label className={'switch' + (d.unlimited ? ' on' : '')}>
            <input type="checkbox" checked={d.unlimited} disabled={busy} onChange={(e) => setUnlimited(e.target.checked)} />
            <span className="knob" aria-hidden="true" />
            <span><b>Saldo ilimitado</b> — paga en el checkout<br /><small>{d.unlimited ? 'Activo: puede consumir sin saldo; lo consumido se acumula como deuda.' : 'Inactivo: solo puede consumir hasta su saldo.'}</small></span>
          </label>
          {owed && <div className="alert warn small">Debe {money(-d.balance)}. Para liquidar en el checkout, ve a <b>Recargar</b> y carga ese valor; luego podrás desactivar el saldo ilimitado.</div>}
          <Msg m={m} />

          <div className="grid2">
            <div className="chip in"><span>↗</span><div><small>Recargas</small><b>{money(d.total_topup)}</b></div></div>
            <div className="chip out"><span>↘</span><div><small>Consumos</small><b>{money(d.total_spent)}</b></div></div>
          </div>

          <div className="panel">
            <h3>Pulseras ({d.bracelets.length})</h3>
            {d.bracelets.length === 0 ? <p className="muted">Sin pulseras asignadas.</p> : (
              <div className="list">{d.bracelets.map((b) => (
                <div key={b.uid} className="item"><div className="grow"><b>🔖 {b.label || 'Sin nombre'}</b><small>UID {b.uid}</small></div>
                  <small>{d.transactions.filter((x) => x.bracelet_uid === b.uid && x.type === 'charge').length} cobros</small></div>))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="between"><h3>Historial de transacciones</h3></div>
            <Filter value={filter} onChange={setFilter} counts={countBy(d.transactions)} />
            {rows.length === 0 ? <p className="muted">Sin movimientos.</p> : <div className="list">{rows.map((x) => <TxRow key={x.id} t={x} />)}</div>}
          </div>

          <button className="btn ghost" onClick={() => setEdit(true)}>✎ Editar cliente / pulseras</button>
        </div>
      )}
      {edit && d && <GuestForm g={d} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); load() }} />}
    </Modal>
  )
}

/* ---------------- HISTORIAL GENERAL ---------------- */
function History({ onOpen, ver }) {
  const [list, load] = useList('admin_recent_transactions')
  useEffect(() => { if (ver) load() }, [ver])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const term = q.trim().toLowerCase()
  const byText = list.filter((x) => !term || [x.guest, x.id_number, x.bracelet_label, x.bracelet_uid, x.venue, x.staff, x.description].join(' ').toLowerCase().includes(term))
  const rows = byText.filter((x) => filter === 'all' || x.type === filter)
  const sum = (type) => byText.filter((x) => x.type === type).reduce((a, x) => a + Number(x.amount), 0)
  return (
    <div className="stack">
      <div className="row">
        <input type="search" placeholder="Filtrar por cliente, cédula, pulsera, lugar u operario…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn ghost small" onClick={load}>↻</button>
      </div>
      <div className="grid2">
        <div className="chip in"><span>↗</span><div><small>Recargas</small><b>{money(sum('topup'))}</b></div></div>
        <div className="chip out"><span>↘</span><div><small>Consumos</small><b>{money(sum('charge'))}</b></div></div>
      </div>
      <Filter value={filter} onChange={setFilter} counts={countBy(byText)} />
      <div className="list panel">
        {rows.length === 0 && <p className="muted">Sin movimientos.</p>}
        {rows.map((x) => <TxRow key={x.id} t={x} showGuest onOpen={() => onOpen(x.guest_id)} />)}
      </div>
      <p className="hint">Se muestran los últimos 300 movimientos. Toca uno para abrir la ficha completa del cliente.</p>
    </div>
  )
}

/* ---------------- FORMULARIO DE CLIENTE (varias pulseras) ---------------- */
function GuestForm({ g, onClose, onSaved }) {
  const isNew = !g.id
  const [f, setF] = useState({ full_name: g.full_name || '', id_type: g.id_type || 'CC', id_number: g.id_number || '', phone: g.phone || '', balance: '', pin: '', active: g.active ?? true, unlimited: false })
  const [br, setBr] = useState(g.bracelets?.length ? g.bracelets.map((b) => ({ uid: b.uid, label: b.label || '' })) : [{ uid: '', label: '' }])
  const [m, setM] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const upd = (i, patch) => setBr((list) => list.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  const remove = (i) => setBr((list) => (list.length === 1 ? [{ uid: '', label: '' }] : list.filter((_, j) => j !== i)))
  const addScanned = (uid) => setBr((list) => {
    if (!uid || list.some((b) => b.uid === uid)) return list
    const i = list.findIndex((b) => !b.uid)
    return i >= 0 ? list.map((b, j) => (j === i ? { ...b, uid } : b)) : [...list, { uid, label: '' }]
  })

  const save = async (e) => {
    e.preventDefault(); setM(null)
    const list = br.filter((b) => b.uid).map((b) => ({ uid: normUid(b.uid), label: b.label.trim() }))
    if (new Set(list.map((b) => b.uid)).size !== list.length) { setM({ ok: false, t: 'Hay una pulsera repetida en la lista.' }); return }
    try {
      if (isNew) await rpc('admin_create_guest', { p_full_name: f.full_name, p_id_type: f.id_type, p_id_number: f.id_number, p_phone: f.phone, p_balance: Number(f.balance || 0), p_bracelets: list, p_pin: f.pin, p_unlimited: f.unlimited })
      else await rpc('admin_update_guest', { p_id: g.id, p_full_name: f.full_name, p_id_type: f.id_type, p_id_number: f.id_number, p_phone: f.phone, p_bracelets: list, p_active: f.active, p_pin: f.pin || null })
      onSaved()
    } catch (x) { setM({ ok: false, t: x.message }) }
  }
  return (
    <Modal title={isNew ? 'Nuevo cliente' : 'Editar cliente'} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <Field label="Nombre completo"><input value={f.full_name} onChange={set('full_name')} required /></Field>
        <div className="grid2">
          <Field label="Tipo de identificación"><select value={f.id_type} onChange={set('id_type')}>{ID_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Número"><input value={f.id_number} onChange={set('id_number')} required /></Field>
        </div>
        <Field label="Teléfono"><input type="tel" value={f.phone} onChange={set('phone')} /></Field>
        {isNew && <Field label="Saldo inicial"><input type="number" inputMode="decimal" min="0" step="any" value={f.balance} onChange={set('balance')} placeholder="0" /></Field>}
        {isNew && (
          <label className="check"><input type="checkbox" checked={f.unlimited} onChange={(e) => setF({ ...f, unlimited: e.target.checked })} />
            <span><b>Saldo ilimitado</b> (paga en el checkout)</span></label>
        )}

        <div className="field">
          <span>Pulseras NFC — todos los cobros se cargan a este cliente</span>
          {br.map((b, i) => (
            <div key={i} className="brow">
              <input className="uid" value={b.uid} placeholder="UID (enfoca y escanea)" autoCapitalize="characters"
                onChange={(e) => upd(i, { uid: normUid(e.target.value) })} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} />
              <input value={b.label} maxLength={60} placeholder="Nombre de quien la usa" onChange={(e) => upd(i, { label: e.target.value })} />
              <button type="button" className="x" onClick={() => remove(i)} aria-label="Quitar pulsera">✕</button>
            </div>
          ))}
          <button type="button" className="btn ghost small" onClick={() => setBr((list) => [...list, { uid: '', label: '' }])}>＋ Agregar otra pulsera</button>
        </div>
        <ScanField compact qr={false} onScan={(u) => addScanned(normUid(u))} />

        <Field label={isNew ? 'Contraseña del cliente (4 dígitos)' : 'Nueva contraseña (vacío = no cambiar)'}>
          <input inputMode="numeric" maxLength={4} pattern={isNew ? '[0-9]{4}' : '([0-9]{4})?'} value={f.pin} onChange={set('pin')} required={isNew} />
        </Field>
        {!isNew && <button type="button" className="btn danger small" onClick={async () => { if (window.confirm('Se invalidará el QR actual del cliente y se generará uno nuevo. ¿Continuar?')) { try { await rpc('admin_regen_qr', { p_id: g.id }); setM({ ok: true, t: 'QR regenerado. El cliente verá el nuevo al abrir la app.' }) } catch (x) { setM({ ok: false, t: x.message }) } } }}>Regenerar QR (pérdida/robo)</button>}
        <small>El cliente debe aceptar la política de tratamiento de datos en su primer ingreso. Sus datos se usan solo para esta plataforma.</small>
        <Msg m={m} />
        <button className="btn">Guardar</button>
      </form>
    </Modal>
  )
}

/* ---------------- RECARGAR ---------------- */
function Topup() {
  const [c, setC] = useState(null)
  const [amt, setAmt] = useState('')
  const [m, setM] = useState(null)
  const [q, setQ] = useState('')
  const [found, ] = useList('admin_list_guests', { p_search: q || null })
  const pick = async (code) => { setM(null); try { setC(await rpc('staff_lookup', { p_code: code })) } catch (e) { setC(null); setM({ ok: false, t: e.message }) } }
  const go = async (e) => {
    e.preventDefault(); setM(null)
    try {
      const r = await rpc('admin_topup', { p_code: c.id_number, p_amount: Number(amt) })
      setM({ ok: true, t: `Recarga de ${money(r.added)} a ${r.full_name}. Nuevo saldo: ${money(r.balance)}` })
      setC({ ...c, balance: r.balance }); setAmt('')
    } catch (x) { setM({ ok: false, t: x.message }) }
  }
  return (
    <div className="stack narrow">
      <div className="panel"><h3>1. Identificar cliente</h3><ScanField onScan={pick} />
        <input type="search" placeholder="…o buscar por cédula / nombre" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <div className="list">{found.slice(0, 6).map((g) => (
          <button key={g.id} className="item btnrow" onClick={() => { pick(g.id_number); setQ('') }}>
            <div className="grow"><b>{g.full_name}</b><small>{g.id_number}</small></div><b>{money(g.balance)}</b></button>))}</div>}
      </div>
      {c && (
        <form className="panel stack" onSubmit={go}>
          <h3>2. Recargar a {c.full_name}</h3>
          {Number(c.balance) < 0 && <small className="neg">Por pagar en el checkout (la recarga salda la deuda)</small>}
          <div className="bal">{money(c.balance)}</div>
          {c.unlimited && <div className="alert good small">∞ Saldo ilimitado · paga en el checkout</div>}
          <Field label="Valor a cargar"><input type="number" inputMode="decimal" min="1" step="any" value={amt} onChange={(e) => setAmt(e.target.value)} required autoFocus /></Field>
          <button className="btn">Recargar</button>
        </form>
      )}
      <Msg m={m} />
    </div>
  )
}

/* ---------------- OPERARIOS ---------------- */
function Staff() {
  const [list, load] = useList('admin_list_staff')
  const [venues] = useList('admin_list_venues')
  const [edit, setEdit] = useState(null)
  const del = async (s) => { if (confirmDel(s.full_name)) { await rpc('admin_delete_staff', { p_id: s.id }).catch((e) => alert(e.message)); load() } }
  const toggle = async (s) => { await rpc('admin_save_staff', { p_id: s.id, p_username: s.username, p_full_name: s.full_name, p_password: null, p_role: s.role, p_venue_id: s.venue_id, p_active: !s.active }).catch((e) => alert(e.message)); load() }
  return (
    <div className="stack">
      <div className="between"><h3>Operarios y administradores</h3><button className="btn small" onClick={() => setEdit({})}>＋ Nuevo</button></div>
      <div className="list panel">
        {list.map((s) => (
          <div key={s.id} className="item wrapm">
            <div className="grow"><b>{s.full_name} {!s.active && <em className="tag off">inactivo</em>}</b>
              <small>@{s.username} · {s.role === 'admin' ? 'Administrador' : 'Operario'} · {s.venue_name || 'sin lugar'}</small></div>
            <div className="acts">
              <button className="btn ghost small" onClick={() => setEdit(s)}>Editar</button>
              <button className="btn ghost small" onClick={() => toggle(s)}>{s.active ? 'Desactivar' : 'Activar'}</button>
              <button className="btn danger small" onClick={() => del(s)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
      {edit && <StaffForm s={edit} venues={venues.filter((v) => v.active)} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </div>
  )
}

function StaffForm({ s, venues, onClose, onSaved }) {
  const isNew = !s.id
  const [f, setF] = useState({ username: s.username || '', full_name: s.full_name || '', password: '', role: s.role || 'operator', venue_id: s.venue_id || '', active: s.active ?? true })
  const [m, setM] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault()
    try {
      await rpc('admin_save_staff', { p_id: s.id || null, p_username: f.username, p_full_name: f.full_name, p_password: f.password || null, p_role: f.role, p_venue_id: f.venue_id || null, p_active: f.active })
      onSaved()
    } catch (x) { setM({ ok: false, t: x.message }) }
  }
  return (
    <Modal title={isNew ? 'Nuevo usuario' : 'Editar usuario'} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <Field label="Nombre"><input value={f.full_name} onChange={set('full_name')} required /></Field>
        <Field label="Usuario"><input value={f.username} onChange={set('username')} required autoCapitalize="off" /></Field>
        <Field label={isNew ? 'Contraseña (mín. 6)' : 'Nueva contraseña (vacío = no cambiar)'}><input type="password" value={f.password} onChange={set('password')} required={isNew} minLength={f.password ? 6 : 0} /></Field>
        <Field label="Rol"><select value={f.role} onChange={set('role')}><option value="operator">Operario</option><option value="admin">Administrador</option></select></Field>
        <Field label="Lugar de escaneo"><select value={f.venue_id} onChange={set('venue_id')}><option value="">— Sin lugar —</option>{venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
        <Msg m={m} />
        <button className="btn">Guardar</button>
      </form>
    </Modal>
  )
}

/* ---------------- LUGARES ---------------- */
function Venues() {
  const [list, load] = useList('admin_list_venues')
  const [edit, setEdit] = useState(null)
  const del = async (v) => { if (confirmDel(v.name + ' (se borra su inventario)')) { await rpc('admin_delete_venue', { p_id: v.id }).catch((e) => alert(e.message)); load() } }
  const toggle = async (v) => { await rpc('admin_save_venue', { p_id: v.id, p_name: v.name, p_kind: v.kind, p_active: !v.active }); load() }
  return (
    <div className="stack">
      <div className="between"><h3>Lugares (Bar, Restaurante…)</h3><button className="btn small" onClick={() => setEdit({})}>＋ Nuevo</button></div>
      <div className="list panel">
        {list.map((v) => (
          <div key={v.id} className="item wrapm">
            <div className="grow"><b>{v.name} {!v.active && <em className="tag off">inactivo</em>}</b><small>{v.kind}</small></div>
            <div className="acts">
              <button className="btn ghost small" onClick={() => setEdit(v)}>Editar</button>
              <button className="btn ghost small" onClick={() => toggle(v)}>{v.active ? 'Desactivar' : 'Activar'}</button>
              <button className="btn danger small" onClick={() => del(v)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
      {edit && <VenueForm v={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </div>
  )
}
function VenueForm({ v, onClose, onSaved }) {
  const [name, setName] = useState(v.name || ''); const [kind, setKind] = useState(v.kind || 'bar'); const [m, setM] = useState(null)
  const save = async (e) => { e.preventDefault(); try { await rpc('admin_save_venue', { p_id: v.id || null, p_name: name, p_kind: kind, p_active: v.active ?? true }); onSaved() } catch (x) { setM({ ok: false, t: x.message }) } }
  return (
    <Modal title={v.id ? 'Editar lugar' : 'Nuevo lugar'} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Tipo"><select value={kind} onChange={(e) => setKind(e.target.value)}><option value="bar">Bar</option><option value="restaurante">Restaurante</option><option value="otro">Otro</option></select></Field>
        <Msg m={m} /><button className="btn">Guardar</button>
      </form>
    </Modal>
  )
}

/* ---------------- INVENTARIO ---------------- */
function Stock() {
  const [venues] = useList('admin_list_venues')
  const [vid, setVid] = useState('')
  const [list, load] = useList('admin_list_products', { p_venue_id: vid || null })
  const [edit, setEdit] = useState(null)
  const del = async (p) => { if (confirmDel(p.name)) { await rpc('admin_delete_product', { p_id: p.id }).catch((e) => alert(e.message)); load() } }
  return (
    <div className="stack">
      <div className="row">
        <select value={vid} onChange={(e) => setVid(e.target.value)}><option value="">Todos los lugares</option>{venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
        <button className="btn small" onClick={() => setEdit({ venue_id: vid })}>＋ Producto</button>
      </div>
      <div className="list panel">
        {list.length === 0 && <p className="muted">Sin productos.</p>}
        {list.map((p) => (
          <div key={p.id} className="item wrapm">
            <div className="grow"><b>{p.name} {!p.active && <em className="tag off">oculto</em>}</b><small>{p.venue} · {p.category || 'sin categoría'} · stock {p.stock}</small></div>
            <b>{money(p.price)}</b>
            <div className="acts">
              <button className="btn ghost small" onClick={() => setEdit(p)}>Editar</button>
              <button className="btn danger small" onClick={() => del(p)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
      {edit && <ProductForm p={edit} venues={venues} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </div>
  )
}
function ProductForm({ p, venues, onClose, onSaved }) {
  const [f, setF] = useState({ venue_id: p.venue_id || venues[0]?.id || '', name: p.name || '', category: p.category || '', price: p.price ?? '', stock: p.stock ?? 0, active: p.active ?? true })
  const [m, setM] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault()
    try { await rpc('admin_save_product', { p_id: p.id || null, p_venue_id: f.venue_id, p_name: f.name, p_category: f.category, p_price: Number(f.price), p_stock: Number(f.stock), p_active: f.active }); onSaved() }
    catch (x) { setM({ ok: false, t: x.message }) }
  }
  return (
    <Modal title={p.id ? 'Editar producto' : 'Nuevo producto'} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <Field label="Lugar"><select value={f.venue_id} onChange={set('venue_id')} required>{venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
        <Field label="Producto"><input value={f.name} onChange={set('name')} required /></Field>
        <Field label="Categoría"><input value={f.category} onChange={set('category')} placeholder="Bebidas, Platos fuertes…" /></Field>
        <div className="grid2">
          <Field label="Precio"><input type="number" inputMode="decimal" min="0" step="any" value={f.price} onChange={set('price')} required /></Field>
          <Field label="Stock"><input type="number" inputMode="numeric" min="0" value={f.stock} onChange={set('stock')} required /></Field>
        </div>
        <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Visible en la carta</label>
        <Msg m={m} /><button className="btn">Guardar</button>
      </form>
    </Modal>
  )
}

/* ---------------- MI CUENTA (admin y operario) ---------------- */
export function AccountForm() {
  const [me, setMe] = useState(null)
  const [o, setO] = useState(''); const [n, setN] = useState(''); const [m, setM] = useState(null)
  useEffect(() => { rpc('staff_me').then(setMe).catch(() => {}) }, [])
  const go = async (e) => {
    e.preventDefault()
    try { await rpc('staff_change_password', { p_old: o, p_new: n }); setM({ ok: true, t: t('acc.ok') }); setO(''); setN('') }
    catch (x) { setM({ ok: false, t: x.message }) }
  }
  return (
    <div className="stack narrow">
      {me && <div className="panel kv"><h3>{t('acc.title')}</h3><p><span>{t('acc.name')}</span><b>{me.full_name}</b></p><p><span>{t('acc.user')}</span><b>{me.username}</b></p><p><span>{t('acc.venue')}</span><b>{me.venue_name || '—'}</b></p></div>}
      <form className="panel stack" onSubmit={go}>
        <h3>{t('acc.change')}</h3>
        <Field label={t('acc.cur')}><input type="password" value={o} onChange={(e) => setO(e.target.value)} required /></Field>
        <Field label={t('acc.new')}><input type="password" minLength={6} value={n} onChange={(e) => setN(e.target.value)} required /></Field>
        <Msg m={m} /><button className="btn">Guardar</button>
      </form>
      <InstallButton />
    </div>
  )
}
