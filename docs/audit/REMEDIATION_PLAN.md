# Plan de corrección

No se implementó ninguna corrección en esta fase.

## Fase 0 — Contención

1. `AUD-002`: deshabilitar/proteger customer-visits. Archivos landing API/UI; pruebas de anon, enumeración, rate limit y OTP. Riesgo funcional medio, seguridad crítica.
2. `AUD-009`/`AUD-003`: rate limit global para recovery, reserva y reseña; límites de body/texto. Probar abuso, proxies y UX.
3. Rotar service-role solo si la investigación confirma exposición; no hay evidencia local de fuga.

## Fase 1 — Contrato compartido

1. Export read-only del esquema remoto y backup.
2. Elegir esquema canónico v2; mapear cada columna/estado legacy.
3. Diseñar migración landing para branches/employees/services/customers/reservations/audit/settings.
4. Añadir contract tests que ejecuten ambas apps contra una DB efímera.
5. Retirar service role de lecturas públicas mediante RPC/policies mínimas.

Archivos: ambos SQL, `landing/app/api/public/**`, landing loaders, tipos compartidos. Riesgo alto; requiere staging y rollback.

## Fase 2 — Integridad y dinero

1. `AUD-006`: motivo de cortesía obligatorio en UI/API/DB y reconciliar product-only vs service courtesy.
2. `AUD-010`: RPC única idempotente para checkout completo; detectar/limpiar drafts huérfanos.
3. Reserva pública atómica con lock/constraint de solapamiento e idempotency key.
4. Verificar cancelación de venta, stock, rewards, caja y producción con concurrencia.

Pruebas: pagos mixtos, vuelto, último stock, retry/concurrency, reward, cortesía, reserva y rollback.

## Fase 3 — Auth, auditoría y APIs

1. Guard central con módulo/acción/scope y bloqueo de password en todos los handlers.
2. Contrato único de audit log con actor, before/after, motivo, entidad, IP/sesión cuando aplique.
3. Schemas runtime y límites; respuestas de error sin `error.message` interno.
4. Revisar Origin/CSRF y políticas de cookie.

## Fase 4 — Dependencias

Actualizar patches de Next/Supabase/toolchain primero; ejecutar lint/typecheck/unit/build/E2E. Plan separado para migrar landing Next 14/React 18 a una versión soportada compatible con dash. No mezclar con migración de datos.

## Fase 5 — Testing y observabilidad

- Supabase local/staging desechable, seeds no destructivos y suite API/integration.
- Tests landing para reserva, asistencia, reseña, loaders y XSS JSON-LD.
- Matriz roles/sedes/IDOR para cada CRUD/RPC.
- CI obligatorio: audit, lint, typecheck, unit, contract, build y smoke sin depender de producción.
- Build landing debe fallar si datos esenciales no están disponibles o usar fallback explícito observable.

## Fase 6 — Arquitectura y UX funcional

Dividir checkout/panels grandes; generar tipos DB; centralizar fetch/query keys; eliminar duplicados landing; hacer guard de `/pos`; resolver acción reception para beneficios/insumos; ocultar placeholders.

## Fase 7 — Limpieza

Confirmar y retirar SQL legacy/código huérfano/logs tracked; unificar Git/monorepo y runbook SQL. Cada eliminación necesita búsqueda de referencias, build y regresión cross-app.

## Criterio de salida

No desplegar correcciones core hasta: cero CRITICAL/HIGH abiertos sin aceptación, 100% contract tests cross-app, unitarios verdes, matriz RLS real en staging, backup/rollback probado y build landing sin errores silenciados.
