import { createClient } from '@supabase/supabase-js'

// La llave "publishable" es pública por diseño; los datos se protegen con RLS + funciones RPC.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://xetflthjncbypzigtsay.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_WRR4Z9Dz54xGjnwInkFsxQ_c2G7THDl'

export const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const safe = (fn, d = null) => { try { return fn() } catch { return d } }
export const session = {
  get token() { return safe(() => localStorage.getItem('cl_token')) },
  get role() { return safe(() => localStorage.getItem('cl_role')) },
  set(t, r) { safe(() => { localStorage.setItem('cl_token', t); localStorage.setItem('cl_role', r) }) },
  clear() { safe(() => { localStorage.removeItem('cl_token'); localStorage.removeItem('cl_role') }) },
}

const MSG = {
  SIN_SALDO: 'CLIENTE SIN SALDO',
  SESION_INVALIDA: 'Sesión expirada. Ingresa de nuevo.',
  SIN_PERMISO: 'No tienes permiso para esta acción.',
  CREDENCIALES_INVALIDAS: 'Datos incorrectos.',
  CUENTA_BLOQUEADA: 'Demasiados intentos. Espera 10 minutos.',
  CLIENTE_NO_ENCONTRADO: 'Cliente o pulsera no encontrada.',
  CLIENTE_INACTIVO: 'Cliente inactivo.',
  MONTO_INVALIDO: 'Monto inválido.',
  PIN_INVALIDO: 'La contraseña debe ser de 4 dígitos.',
  CLAVE_CORTA: 'La clave debe tener mínimo 6 caracteres.',
  DUPLICADO: 'Ya existe un registro con esa cédula, usuario o pulsera.',
  NO_AUTO_DESACTIVAR: 'No puedes eliminar/desactivar tu propia cuenta.',
  CODIGO_VACIO: 'Escanea o escribe un código.',
}
export const friendly = (m = '') => {
  const k = Object.keys(MSG).find((x) => m.includes(x))
  return k ? MSG[k] : 'Error: ' + m
}

export async function rpc(fn, args = {}, auth = true) {
  const { data, error } = await sb.rpc(fn, auth ? { p_token: session.token, ...args } : args)
  if (error) {
    if (error.message.includes('SESION_INVALIDA')) {
      session.clear(); window.dispatchEvent(new Event('cl-logout'))
    }
    const e = new Error(friendly(error.message)); e.code = error.message; throw e
  }
  return data
}

export const money = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n || 0))
export const dt = (s) => new Date(s).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
