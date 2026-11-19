import { useState } from 'react'
import { nfcSupported, useNfc } from '../lib/nfc'
import QrScanner from './QrScanner'
import { t } from '../lib/i18n'

// Unifica: lector USB (modo teclado), NFC del celular (Android) y QR por cámara.
export default function ScanField({ onScan, compact = false, placeholder = t('scan.ph'), qr = true }) {
  const [txt, setTxt] = useState('')
  const [cam, setCam] = useState(false)
  const nfc = useNfc((uid) => onScan(uid))
  const submit = () => { const v = txt.trim(); if (v) { onScan(v); setTxt('') } }
  return (
    <div className="scanfield">
      {!compact && (
        <div className="row">
          <input value={txt} placeholder={placeholder} autoCapitalize="off" autoComplete="off" autoCorrect="off"
            onChange={(e) => setTxt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }} />
          <button type="button" className="btn small" onClick={submit}>OK</button>
        </div>
      )}
      <div className="row wrap">
        {qr && <button type="button" className="btn ghost small" onClick={() => setCam(true)}>{t('scan.qr')}</button>}
        <button type="button" className={'btn ghost small' + (nfc.active ? ' on' : '')}
          onClick={nfc.active ? nfc.stop : nfc.start}>
          {nfc.active ? t('scan.nfcon') : t('scan.nfc')}
        </button>
      </div>
      {!nfcSupported && <p className="hint">{t('scan.hint')}</p>}
      {nfc.error && <p className="err">{nfc.error}</p>}
      {cam && <QrScanner onClose={() => setCam(false)} onResult={(t) => { setCam(false); onScan(t) }} />}
    </div>
  )
}
