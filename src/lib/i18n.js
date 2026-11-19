import { useSyncExternalStore } from 'react'
import es from './langs/es'
import en from './langs/en'
import pt from './langs/pt'
import de from './langs/de'
import ar from './langs/ar'
import zh from './langs/zh'
import ru from './langs/ru'
import ko from './langs/ko'
import ja from './langs/ja'

export const LANGS = [
  { code: 'es', name: 'Español', locale: 'es-CO' },
  { code: 'en', name: 'English', locale: 'en-US' },
  { code: 'pt', name: 'Português', locale: 'pt-BR' },
  { code: 'de', name: 'Deutsch', locale: 'de-DE' },
  { code: 'ar', name: 'العربية (الإمارات)', locale: 'ar-AE', rtl: true },
  { code: 'zh', name: '中文（普通话）', locale: 'zh-CN' },
  { code: 'ru', name: 'Русский', locale: 'ru-RU' },
  { code: 'ko', name: '한국어', locale: 'ko-KR' },
  { code: 'ja', name: '日本語', locale: 'ja-JP' },
]
const dict = { es, en, pt, de, ar, zh, ru, ko, ja }
const KEY = 'cl_lang'

function detect() {
  try { const s = localStorage.getItem(KEY); if (s && dict[s]) return s } catch { /* sin storage */ }
  const n = (typeof navigator !== 'undefined' ? navigator.language || 'es' : 'es').toLowerCase().slice(0, 2)
  return dict[n] ? n : 'es'
}

let lang = detect()
const subs = new Set()

function apply() {
  if (typeof document === 'undefined') return
  const l = LANGS.find((x) => x.code === lang)
  document.documentElement.lang = l.locale
  document.documentElement.dir = l.rtl ? 'rtl' : 'ltr'
}
apply()

export const getLang = () => lang
export const locale = () => LANGS.find((x) => x.code === lang).locale
export function setLang(code) {
  if (!dict[code] || code === lang) return
  lang = code
  try { localStorage.setItem(KEY, code) } catch { /* sin storage */ }
  apply()
  subs.forEach((f) => f())
}
export const useLang = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, getLang)

export function t(key, vars) {
  let s = dict[lang][key] ?? es[key] ?? key
  if (vars) for (const k of Object.keys(vars)) s = s.replaceAll('{' + k + '}', vars[k])
  return s
}
