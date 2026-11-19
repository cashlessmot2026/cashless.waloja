import { LANGS, setLang, t, useLang } from '../lib/i18n'

export default function LanguageSelect({ className = '' }) {
  const lang = useLang()
  return (
    <label className={'langsel ' + className}>
      <span aria-hidden="true">🌐</span>
      <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('common.language')}>
        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
    </label>
  )
}
