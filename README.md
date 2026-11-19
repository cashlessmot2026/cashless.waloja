# Cashless Hotel (PWA)

Sistema cashless NFC para hotel. React + Vite + Supabase. Instalable como app en Android, iOS, Windows y Mac.

## Interfaces
- **Huésped**: ingresa con cédula + contraseña de 4 dígitos. Wallet con saldo, consumos (valor, producto, hora, lugar), pulsera NFC, QR único, detalles de la reserva, carta de productos y cambio de contraseña.
- **Operario**: cobra escaneando QR o pulsera NFC (solo digita el valor), consulta saldo. Si no hay saldo: alerta roja **CLIENTE SIN SALDO**.
- **Administrador**: clientes (crear/editar/activar/eliminar/buscar), asignar pulsera NFC, recargas, operarios y lugares, inventario por lugar.

## 1) Base de datos
1. Abre Supabase > SQL Editor y ejecuta `supabase/schema.sql`.
2. Usuario inicial: `admin` / `Admin2026*` → **cámbiala** en Cuenta al ingresar.

Las tablas tienen RLS sin políticas: la llave pública no puede leerlas. Todo pasa por funciones RPC que validan una sesión (contraseñas con bcrypt, bloqueo tras 5 intentos fallidos).

## 2) Ejecutar
```bash
npm install
npm run dev      # desarrollo
npm run build    # producción (dist/)
```
Variables opcionales en `.env` (ver `.env.example`).

## 3) Publicar (necesita HTTPS para cámara, NFC e instalación)
Súbelo a Vercel / Netlify / Cloudflare Pages (build: `npm run build`, salida: `dist`).

## Compatibilidad de escaneo
| Dispositivo | QR (cámara) | NFC integrado | Lector USB NFC |
|---|---|---|---|
| Android (Chrome) | ✅ | ✅ | — |
| iPhone / iPad | ✅ | ❌ (Safari no soporta Web NFC) | — |
| Windows / Mac | ✅ (webcam) | ❌ | ✅ (modo teclado/HID: enfoca el campo y pasa la pulsera) |

Instalar: Android/Windows/Mac (Chrome/Edge) → "Instalar app"; iPhone → Compartir → "Añadir a pantalla de inicio".
