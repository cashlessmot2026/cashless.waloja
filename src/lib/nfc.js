import { useCallback, useEffect, useRef, useState } from 'react'

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
    if (!nfcSupported) { setError('Este dispositivo no soporta NFC en el navegador. Usa lector USB o QR.'); return }
    try {
      const reader = new window.NDEFReader()
      ctrl.current = new AbortController()
      await reader.scan({ signal: ctrl.current.signal })
      setActive(true)
      reader.onreading = (e) => { cb.current(normUid(e.serialNumber)); stop() }
      reader.onreadingerror = () => setError('No se pudo leer la pulsera. Intenta de nuevo.')
    } catch (e) {
      setActive(false)
      setError(e.name === 'NotAllowedError' ? 'Permiso NFC denegado.' : 'No se pudo iniciar NFC: ' + e.message)
    }
  }, [stop])
  useEffect(() => stop, [stop])
  return { active, error, start, stop }
}
