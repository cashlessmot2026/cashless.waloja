import { useState } from 'react'
import { Modal } from './ui'

export const CONSENT_VERSION = 'v1'

export function ConsentText() {
  return (
    <div className="legal">
      <p><b>Autorización para el tratamiento de datos personales</b></p>
      <p>
        En cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013 (Habeas Data), el hotel, como
        responsable del tratamiento, informa que los datos personales que usted suministra (nombre,
        tipo y número de identificación, teléfono, identificador de la pulsera NFC, saldo y movimientos de
        consumo) serán tratados <b>únicamente</b> para:
      </p>
      <ul>
        <li>Permitirle el acceso e ingreso a esta plataforma.</li>
        <li>Operar el sistema de pagos cashless del hotel (cobros, recargas, consulta de saldo y consumos).</li>
      </ul>
      <p>
        <b>Sus datos no serán vendidos, cedidos, compartidos con terceros ni utilizados para fines
        comerciales, publicitarios o distintos</b> al uso exclusivo descrito. Se almacenan en una base de
        datos protegida, con contraseñas cifradas y acceso restringido por roles.
      </p>
      <p>
        Usted tiene derecho a conocer, actualizar, rectificar y solicitar la supresión de sus datos, así como a
        revocar esta autorización, dirigiéndose a la administración del hotel. Al finalizar su estadía y
        liquidar su saldo, podrá solicitar la eliminación de su cuenta.
      </p>
      <p className="muted">Versión {CONSENT_VERSION}</p>
    </div>
  )
}

// Visor (login y perfil)
export function ConsentModal({ onClose }) {
  return (
    <Modal title="Política de datos personales" onClose={onClose}>
      <ConsentText />
      <button className="btn" onClick={onClose}>Entendido</button>
    </Modal>
  )
}

// Aceptación obligatoria en el primer ingreso del huésped
export function ConsentGate({ onAccept, onDecline }) {
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <div className="login">
      <div className="login-card" style={{ textAlign: 'left' }}>
        <h1>Antes de continuar</h1>
        <div className="legal-box"><ConsentText /></div>
        <label className="check">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span>He leído y autorizo el tratamiento de mis datos personales para este fin exclusivo.</span>
        </label>
        <button className="btn" disabled={!ok || busy} onClick={async () => { setBusy(true); await onAccept(); setBusy(false) }}>Aceptar y continuar</button>
        <button className="btn ghost" onClick={onDecline}>No acepto (salir)</button>
      </div>
    </div>
  )
}
