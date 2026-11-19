# Waloja · Luxury Homes (PWA)

Sistema cashless NFC para hotel. React + Vite + Supabase. Instalable como app en Android, iOS, Windows y Mac.

## Interfaces
- **Huésped**: ingresa con cédula + contraseña de 4 dígitos. Wallet con saldo, consumos (valor, producto, hora, lugar), pulsera NFC, QR único, detalles de la reserva, carta de productos y cambio de contraseña.
- **Operario**: cobra escaneando QR o pulsera NFC (solo digita el valor), consulta saldo. Si no hay saldo: alerta roja **CLIENTE SIN SALDO**.
- **Administrador**: clientes (crear/editar/activar/eliminar/buscar), asignar pulsera NFC, recargas, operarios y lugares, inventario por lugar.

## 1) Base de datos
1. Abre Supabase > SQL Editor y ejecuta `supabase/schema.sql` (se puede volver a ejecutar sin riesgo para actualizar).
2. Crea **tu administrador** con tu propia clave (cambia los valores y ejecútalo en el SQL Editor):
```sql
insert into staff (username, full_name, pass_hash, role)
values ('TU_USUARIO', 'Tu Nombre', extensions.crypt('TU_CLAVE_LARGA', extensions.gen_salt('bf')), 'admin');
```
El esquema **no trae ningún usuario ni clave por defecto**.

## Seguridad
- RLS activo y **sin permisos** para la llave pública: no puede leer ni escribir tablas ni funciones internas. Todo pasa por funciones RPC con token de sesión (12 h).
- Contraseñas con bcrypt. Bloqueo de 10 min tras 5 intentos fallidos.
- Los saldos solo cambian mediante `operator_charge` (con bloqueo de fila anti doble cobro, valida saldo y tope) y `admin_topup` (solo admin). Cada movimiento queda en `transactions`; las acciones sensibles del admin en `audit_log`.
- El cobro exige QR o pulsera (nunca solo la cédula). El admin puede regenerar el QR de un cliente.
- CSP restrictivo, sin `innerHTML`, dependencias sin vulnerabilidades conocidas (`npm audit`).
- Consentimiento de datos personales (Ley 1581/2012): el huésped debe aceptarlo en su primer ingreso; se guarda fecha y versión.
- Recomendado: en Supabase activa *Auth > Attack protection*, mantén el proyecto con respaldos y no compartas la *service_role key*.

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
