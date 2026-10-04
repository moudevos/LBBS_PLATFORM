# Autenticación, autorización y seguridad

## Autenticación

Supabase Auth con email/password, cookies SSR, `getUser()` en servidor, callback PKCE/token hash, recuperación y cambio de contraseña. `proxy.ts` refresca sesión para `/login` y `/control`; el layout vuelve a validar. La política local exige 8 caracteres, mayúscula, minúscula, número y símbolo. Los flujos de cambio usan service role en servidor para sesiones/auditoría.

## Autorización

Cadena prevista: rol DB -> `getModuleAccess` -> `require*Session` -> RLS/RPC. El rol no se acepta desde frontend. Owner/admin son globales; reception opera en su sede; barber tiene reservas asignadas; viewer consulta control. `module-permissions.ts` gobierna navegación, pero no es una frontera de seguridad.

## Matriz resumida

| Rol | UI principal | Escritura server |
| --- | --- | --- |
| owner/admin | todo | administración global y operaciones críticas |
| reception | control, caja, POS, rewards, ventas, clientes, contactos, reservas | operaciones de sede, stock, beneficio/insumo de empleado |
| barber | control/reservas | notas/reservas asignadas según RLS |
| viewer | control | principalmente lectura |
| anon | landing | APIs públicas ejecutan con service role |

## Hallazgos OWASP

- `AUD-002` CRITICAL: IDOR/PII por teléfono en `/api/public/customer-visits`; entrega nombre, historial, sede, servicio y rewards sin demostrar propiedad.
- `AUD-003` HIGH: endpoints públicos usan service role, carecen de rate limiting/idempotencia y aceptan creación de clientes/reservas/reseñas.
- `AUD-008` MEDIUM: búsqueda de clientes y notas no llaman guard explícito; RLS protege filas, pero omiten bloqueo `must_change_password` y generan contratos inconsistentes.
- `AUD-009` HIGH: recovery público sin rate limit permite abuso de correo; respuesta genérica sí evita enumeración directa.
- `AUD-019` MEDIUM/PROBABLE: JSON-LD usa `dangerouslySetInnerHTML(JSON.stringify(...))` sin escapar `<`; una reseña aprobada con cierre de `script` puede producir XSS almacenado.
- No se encontró SQL injection directa: Supabase parametriza filtros. Los `.or()` construidos con input requieren fuzzing, pero se reemplazan comas.
- No se encontró path traversal/SSRF en rutas activas; API Perú usa base URL de entorno y endpoint fijo.
- CSRF: SameSite de Supabase reduce riesgo, pero los handlers mutantes no validan Origin/CSRF. Debe confirmarse configuración de cookies.
- Secretos: `.env.local` y `.qa` están ignorados; no se copiaron valores. Hay logs ya versionados, sin patrones de token detectados.

## Service role

Landing la usa en todas las consultas públicas, anulando RLS. Dashboard la usa después de `requireAdminSession` en muchos CRUD para evitar policies. Esto amplía el impacto de cualquier guard defectuoso; cada ruta debe mantener autorización y scope completos antes de crear el cliente admin.

## Recomendación de diseño

Landing debe operar con funciones/RPC públicas de mínimo privilegio y policies explícitas; no con service role general. Para customer visits se requiere OTP/magic link o token de reserva. Centralizar guards, rate limiting, schemas y auditoría server-side.
