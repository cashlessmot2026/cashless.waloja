import { useState } from 'react'
import { Modal } from './ui'
import { t } from '../lib/i18n'

export const CONSENT_VERSION = 'v1'

export function ConsentText() {
  return (
    <div className="legal">
      <p><b>{t('c.title')}</b></p>
      <p>{t('c.p1')}</p>
      <ul>
        <li>{t('c.li1')}</li>
        <li>{t('c.li2')}</li>
      </ul>
      <p><b>{t('c.p2')}</b> {t('c.p2b')}</p>
      <p>{t('c.p3')}</p>
      <p className="muted">{t('c.version')} {CONSENT_VERSION}</p>
    </div>
  )
}

// Visor (login y perfil)
export function ConsentModal({ onClose }) {
  return (
    <Modal title={t('c.viewtitle')} onClose={onClose}>
      <ConsentText />
      <button className="btn" onClick={onClose}>{t('common.understood')}</button>
    </Modal>
  )
}

// Aceptación obligatoria en el primer ingreso del huésped
export function ConsentGate({ onAccept, onDecline }) {
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <div className="login">
      <div className="login-card" style={{ textAlign: 'start' }}>
        <h1>{t('c.gate')}</h1>
        <div className="legal-box"><ConsentText /></div>
        <label className="check">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span>{t('c.check')}</span>
        </label>
        <button className="btn" disabled={!ok || busy} onClick={async () => { setBusy(true); await onAccept(); setBusy(false) }}>{t('c.accept')}</button>
        <button className="btn ghost" onClick={onDecline}>{t('c.decline')}</button>
      </div>
    </div>
  )
}
