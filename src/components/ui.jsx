import { Fragment, useEffect } from 'react'
import InstallButton, { LOGO } from './Install'
import { t } from '../lib/i18n'
import LanguageSelect from './Lang'

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal" onClick={onClose}>
      <div className={'sheet' + (wide ? ' wide' : '')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><h3>{title}</h3><button className="x" onClick={onClose} aria-label={t('common.close')}>✕</button></div>
        {children}
      </div>
    </div>
  )
}

export const Field = ({ label, children }) => (<label className="field"><span>{label}</span>{children}</label>)

export function Shell({ title, subtitle, tabs, tab, setTab, onLogout, fab, children }) {
  const mid = Math.floor(tabs.length / 2)
  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand"><img src={LOGO} alt="" />Waloja</div>
        {tabs.map((t) => (
          <button key={t.id} className={'rail-item' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
        {fab && <button className="rail-item" onClick={fab.onClick}><span>▣</span>{fab.label}</button>}
        <div style={{ marginTop: "auto" }}><LanguageSelect className="in-rail" /><InstallButton className="rail-item" /></div>
        <button className="rail-item" onClick={onLogout}><span>⎋</span>{t('common.logout')}</button>
      </aside>
      <main className="main">
        <header className="top">
          <div><h1>{title}</h1>{subtitle && <small>{subtitle}</small>}</div>
          <div className="top-actions"><LanguageSelect className="mob-only" /><button className="icon-btn mob-only" onClick={onLogout} aria-label={t('common.logout')}>⎋</button></div>
        </header>
        <div className="content">{children}</div>
      </main>
      <nav className="tabbar">
        {tabs.map((t, i) => (
          <Fragment key={t.id}>
            {fab && i === mid && <div className="fab-slot"><button className="fab" onClick={fab.onClick} aria-label={fab.label}>▣</button></div>}
            <button className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
              <span>{t.icon}</span><small>{t.label}</small>
            </button>
          </Fragment>
        ))}
      </nav>
    </div>
  )
}
