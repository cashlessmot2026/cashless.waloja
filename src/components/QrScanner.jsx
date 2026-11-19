import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { t } from '../lib/i18n'

export default function QrScanner({ onResult, onClose }) {
  const [err, setErr] = useState('')
  const done = useRef(false)
  useEffect(() => {
    const q = new Html5Qrcode('qr-reader')
    q.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } },
      (txt) => { if (done.current) return; done.current = true; onResult(txt) }, () => {})
      .catch(() => setErr(t('qr.cam')))
    return () => { q.isScanning ? q.stop().then(() => q.clear()).catch(() => {}) : q.clear() }
  }, [])
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>{t('qr.title')}</h3>
        <div id="qr-reader" className="qr-reader" />
        {err && <p className="err">{err}</p>}
        <button className="btn ghost" onClick={onClose}>{t('common.close')}</button>
      </div>
    </div>
  )
}
