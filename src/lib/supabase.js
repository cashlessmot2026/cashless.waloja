import { createClient } from '@supabase/supabase-js'
import { t, locale } from './i18n'

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

const CODES = ['SIN_SALDO', 'SESION_INVALIDA', 'SIN_PERMISO', 'CREDENCIALES_INVALIDAS', 'CUENTA_BLOQUEADA',
  'CLIENTE_NO_ENCONTRADO', 'CLIENTE_INACTIVO', 'MONTO_INVALIDO', 'PIN_INVALIDO', 'CLAVE_CORTA', 'DUPLICADO',
  'NO_AUTO_DESACTIVAR', 'CODIGO_VACIO', 'SALDO_PENDIENTE', 'PULSERAS_INVALIDAS']
export const friendly = (m = '') => {
  const k = CODES.find((x) => m.includes(x))
  return k ? t('err.' + k) : t('err.generic') + m
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
  new Intl.NumberFormat(locale(), { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n || 0))
export const dt = (s) => new Date(s).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' })
