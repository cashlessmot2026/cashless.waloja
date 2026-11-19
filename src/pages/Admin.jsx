import { useCallback, useEffect, useState } from 'react'
import { rpc, money, dt } from '../lib/supabase'
import { Shell, Modal, Field } from '../components/ui'
import ScanField from '../components/ScanField'
import { normUid } from '../lib/nfc'
import InstallButton from '../components/Install'

const ID_TYPES = ['CC', 'CE', 'TI', 'Pasaporte', 'NIT', 'Otro']

export default function Admin({ onLogout }) {
  const [tab, setTab] = useState('guests')
  const tabs = [
    { id: 'guests', icon: '👥', label: 'Clientes' },
    { id: 'topup', icon: '＋', label: 'Recargar' },
    { id: 'staff', icon: '🧑‍🍳', label: 'Operarios' },
    { id: 'venues', icon: '🏨', label: 'Lugares' },
    { id: 'stock', icon: '📦', label: 'Inventario' },
    { id: 'acc', icon: '◉', label: 'Cuenta' },
  ]
  return (
    <Shell title="Administrador" subtitle="Panel de control" tabs={tabs} tab={tab} setTab={setTab} onLogout={onLogout}>
      {tab === 'guests' && <Guests />}
      {tab === 'topup' && <Topup />}
      {tab === 'staff' && <Staff />}
      {tab === 'venues' && <Venues />}
      {tab === 'stock' && <Stock />}
      {tab === 'acc' && <AccountForm />}
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

/* ---------------- CLIENTES ---------------- */
function Guests() {
  const [q, setQ] = useState('')
  const [list, load] = useList('admin_list_guests', { p_search: q || null })
  const [edit, setEdit] = useState(null) // {} nuevo | guest
  const del = async (g) => { if (confirmDel(g.full_name)) { await rpc('admin_delete_guest', { p_id: g.id }).catch((e) => alert(e.message)); load() } }
  const toggle = async (g) => { await rpc('admin_update_guest', { p_id: g.id, p_full_name: g.full_name, p_id_type: g.id_type, p_id_number: g.id_number, p_phone: g.phone, p_nfc_uid: g.nfc_uid, p_active: !g.active }); load() }
  return (
    <div className="stack">
      <div className="row">
        <input type="search" placeholder="Buscar por cédula, nombre o teléfono…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn small" onClick={() => setEdit({})}>＋ Nuevo</button>
      </div>
      <div className="list panel">
        {list.length === 0 && <p className="muted">Sin clientes.</p>}
        {list.map((g) => (
          <div key={g.id} className="item wrapm">
            <div className="grow"><b>{g.full_name} {!g.active && <em className="tag off">inactivo</em>}</b>
              <small>{g.id_type} {g.id_number} · {g.phone || 'sin tel.'} · NFC: {g.nfc_uid || '—'}</small></div>
            <b>{money(g.balance)}</b>
            <div className="acts">
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

function GuestForm({ g, onClose, onSaved }) {
  const isNew = !g.id
  const [f, setF] = useState({ full_name: g.full_name || '', id_type: g.id_type || 'CC', id_number: g.id_number || '', phone: g.phone || '', balance: '', nfc_uid: g.nfc_uid || '', pin: '', active: g.active ?? true })
  const [m, setM] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault(); setM(null)
    try {
      if (isNew) await rpc('admin_create_guest', { p_full_name: f.full_name, p_id_type: f.id_type, p_id_number: f.id_number, p_phone: f.phone, p_balance: Number(f.balance || 0), p_nfc_uid: f.nfc_uid, p_pin: f.pin })
      else await rpc('admin_update_guest', { p_id: g.id, p_full_name: f.full_name, p_id_type: f.id_type, p_id_number: f.id_number, p_phone: f.phone, p_nfc_uid: f.nfc_uid, p_active: f.active, p_pin: f.pin || null })
      onSaved()
    } catch (x) { setM({ ok: false, t: x.message }) }
  }
  return (
    <Modal title={isNew ? 'Nuevo cliente' : 'Editar cliente'} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <Field label="Nombre completo"><input value={f.full_name} onChange={set('full_name')} required /></Field>
        <div className="grid2">
          <Field label="Tipo de identificación"><select value={f.id_type} onChange={set('id_type')}>{ID_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Número"><input value={f.id_number} onChange={set('id_number')} required /></Field>
        </div>
        <Field label="Teléfono"><input type="tel" value={f.phone} onChange={set('phone')} /></Field>
        {isNew && <Field label="Saldo inicial"><input type="number" inputMode="decimal" min="0" step="any" value={f.balance} onChange={set('balance')} placeholder="0" /></Field>}
        <Field label="Pulsera NFC (escanea o escribe el UID)">
          <input value={f.nfc_uid} onChange={(e) => setF({ ...f, nfc_uid: normUid(e.target.value) })}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} placeholder="Enfoca aquí y escanea con el lector USB" />
        </Field>
        <ScanField compact qr={false} onScan={(u) => setF((s) => ({ ...s, nfc_uid: normUid(u) }))} />
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
          <div className="bal">{money(c.balance)}</div>
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
    try { await rpc('staff_change_password', { p_old: o, p_new: n }); setM({ ok: true, t: 'Contraseña actualizada.' }); setO(''); setN('') }
    catch (x) { setM({ ok: false, t: x.message }) }
  }
  return (
    <div className="stack narrow">
      {me && <div className="panel kv"><h3>Mi cuenta</h3><p><span>Nombre</span><b>{me.full_name}</b></p><p><span>Usuario</span><b>{me.username}</b></p><p><span>Lugar</span><b>{me.venue_name || '—'}</b></p></div>}
      <form className="panel stack" onSubmit={go}>
        <h3>Cambiar contraseña</h3>
        <Field label="Actual"><input type="password" value={o} onChange={(e) => setO(e.target.value)} required /></Field>
        <Field label="Nueva (mín. 6)"><input type="password" minLength={6} value={n} onChange={(e) => setN(e.target.value)} required /></Field>
        <Msg m={m} /><button className="btn">Guardar</button>
      </form>
      <InstallButton />
    </div>
  )
}
