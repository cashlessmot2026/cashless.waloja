import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from './i18n'

// Web NFC: solo Chrome en Android (HTTPS). iOS/Safari y escritorio NO lo soportan:
// en esos casos se usa lector USB (modo teclado) o el QR por cámara.
export const nfcSupported = typeof window !== 'undefined' && 'NDEFReader' in window
export const normUid = (s = '') => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

export function useNfc(onTag) {
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')
  const ctrl = useRef(null)
  const cb = useRef(onTag)
  cb.current = onTag

  const stop = useCallback(() => { ctrl.current?.abort(); ctrl.current = null; setActive(false) }, [])
  const start = useCallback(async () => {
    setError('')
    if (!nfcSupported) { setError(t('scan.unsupported')); return }
    try {
      const reader = new window.NDEFReader()
      ctrl.current = new AbortController()
      await reader.scan({ signal: ctrl.current.signal })
      setActive(true)
      reader.onreading = (e) => { cb.current(normUid(e.serialNumber)); stop() }
      reader.onreadingerror = () => setError(t('scan.read'))
    } catch (e) {
      setActive(false)
      setError(e.name === 'NotAllowedError' ? t('scan.denied') : t('scan.start') + e.message)
    }
  }, [stop])
  useEffect(() => stop, [stop])
  return { active, error, start, stop }
}
