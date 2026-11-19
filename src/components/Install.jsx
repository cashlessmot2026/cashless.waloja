import { useEffect, useState } from 'react'
import { Modal } from './ui'
import { t } from '../lib/i18n'

export const LOGO = import.meta.env.BASE_URL + 'logo.png'
export const WEBSITE = 'https://waloja.com.co/'
export const INSTAGRAM = 'https://www.instagram.com/walojapropertymanagement?fqnt=b3drc2M2bXc2bjIy&utm_source=qr'

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
const isIOS = /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isMacSafari = /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua) && !isIOS
const standalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.navigator.standalone === true)

let deferred = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; window.dispatchEvent(new Event('cl-install-ready')) })
  window.addEventListener('appinstalled', () => { deferred = null; window.dispatchEvent(new Event('cl-install-ready')) })
}

// Botón "Instalar app": Chrome/Edge (Android, Windows, Mac) usan el instalador nativo;
// iPhone/iPad (Safari) y Safari en Mac muestran las instrucciones de "Añadir a pantalla de inicio / al Dock".
export default function InstallButton({ className = 'btn ghost' }) {
  const [, tick] = useState(0)
  const [help, setHelp] = useState(false)
  useEffect(() => {
    const h = () => tick((n) => n + 1)
    window.addEventListener('cl-install-ready', h)
    return () => window.removeEventListener('cl-install-ready', h)
  }, [])

  if (standalone()) return null
  const canPrompt = !!deferred
  if (!canPrompt && !isIOS && !isMacSafari) return null

  const click = async () => {
    if (deferred) { deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; tick((n) => n + 1) }
    else setHelp(true)
  }
  return (
    <>
      <button type="button" className={className} onClick={click}>{t('install.btn')}</button>
      {help && (
        <Modal title={t('install.title')} onClose={() => setHelp(false)}>
          {isIOS ? (
            <ol className="legal">
              <li>{t('install.ios1')}</li>
              <li>{t('install.ios2')}</li>
              <li>{t('install.ios3')}</li>
            </ol>
          ) : (
            <ol className="legal">
              <li>{t('install.mac1')}</li>
              <li>{t('install.mac2')}</li>
            </ol>
          )}
          <button className="btn" onClick={() => setHelp(false)}>{t('common.understood')}</button>
        </Modal>
      )}
    </>
  )
}

export function WebLink({ className = 'btn ghost' }) {
  return (
    <a className={className + ' linkcard'} href={WEBSITE} target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
      </svg>
      {t('link.web')}
    </a>
  )
}

export function InstaLink({ className = 'btn ghost' }) {
  return (
    <a className={className + ' linkcard'} href={INSTAGRAM} target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </svg>
      {t('link.insta')}
    </a>
  )
}
