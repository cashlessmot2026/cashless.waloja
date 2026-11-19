import { useState } from 'react'
import { rpc, session, friendly } from '../lib/supabase'
import { ConsentModal } from '../components/Consent'
import InstallButton, { InstaLink, WebLink, LOGO } from '../components/Install'
import { t } from '../lib/i18n'
import LanguageSelect from '../components/Lang'

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('guest')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [legal, setLegal] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const r = mode === 'guest'
        ? await rpc('app_login_guest', { p_id_number: user, p_pin: pass }, false)
        : await rpc('app_login_staff', { p_username: user, p_password: pass }, false)
      if (r.error) throw new Error(friendly(r.error))
      session.set(r.token, r.role)
      onLogin(r.role)
    } catch (e2) { setErr(e2.message) }
    setBusy(false)
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <LanguageSelect className="login-lang" />
        <img className="logo-img" src={LOGO} alt="Logo" />
        <h1>Waloja</h1>
        <p className="muted">{t('app.tagline')}</p>
        <div className="seg">
          <button type="button" className={mode === 'guest' ? 'on' : ''} onClick={() => { setMode('guest'); setErr('') }}>{t('login.guest')}</button>
          <button type="button" className={mode === 'staff' ? 'on' : ''} onClick={() => { setMode('staff'); setErr('') }}>{t('login.staff')}</button>
        </div>
        <input value={user} onChange={(e) => setUser(e.target.value)} required autoCapitalize="off" autoCorrect="off"
          placeholder={mode === 'guest' ? t('login.id') : t('login.user')}
          inputMode={mode === 'guest' ? 'text' : 'text'} />
        <input value={pass} onChange={(e) => setPass(e.target.value)} required type="password"
          placeholder={mode === 'guest' ? t('login.pin') : t('login.pass')}
          inputMode={mode === 'guest' ? 'numeric' : 'text'} maxLength={mode === 'guest' ? 4 : 64} autoComplete="current-password" />
        {err && <div className="alert bad small">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? t('login.busy') : t('login.btn')}</button>
        <small>{t('login.privacy')} <button type="button" className="linkbtn" onClick={() => setLegal(true)}>{t('login.policy')}</button></small>
        <InstallButton />
        <WebLink />
        <InstaLink />
      </form>
      {legal && <ConsentModal onClose={() => setLegal(false)} />}
    </div>
  )
}
