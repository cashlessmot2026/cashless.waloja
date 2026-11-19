import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export default function QrScanner({ onResult, onClose }) {
  const [err, setErr] = useState('')
  const done = useRef(false)
  useEffect(() => {
    const q = new Html5Qrcode('qr-reader')
    q.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } },
      (txt) => { if (done.current) return; done.current = true; onResult(txt) }, () => {})
      .catch(() => setErr('No se pudo abrir la cámara. Revisa los permisos (requiere HTTPS).'))
    return () => { q.isScanning ? q.stop().then(() => q.clear()).catch(() => {}) : q.clear() }
  }, [])
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Escanear QR</h3>
        <div id="qr-reader" className="qr-reader" />
        {err && <p className="err">{err}</p>}
        <button className="btn ghost" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  )
}
