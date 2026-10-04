# Auditoría técnica

## 1. Resumen ejecutivo

El dashboard nuevo tiene una base técnica razonable en autenticación, RLS, RPC transaccionales, build y alcance por sede. No está listo para corregirse de forma aislada: la landing comparte el mismo Supabase pero implementa un modelo heredado incompatible. Además existe una exposición pública confirmada de datos personales por teléfono.

Riesgo general: **CRITICAL** hasta resolver `AUD-001` y `AUD-002`.

## 2. Arquitectura actual

Dos aplicaciones Next.js independientes, un wrapper npm raíz y un Supabase compartido. Dashboard usa cookie/anon client más service role en CRUD admin; landing usa service role para todo acceso público. SQL se instala manualmente.

## 3. Tecnologías detectadas

Next 16/React 19/Tailwind 4/Vitest/Playwright en dash; Next 14/React 18/Tailwind 3/Vercel Analytics/GA en landing; TypeScript, npm, Supabase Auth/Postgres/Storage/SSR, React Query y SweetAlert2.

## 4. Módulos detectados

Auth, control/KPI, sedes, equipo, clientes, servicios, productos/stock, reservas, contactos, caja, POS, ventas, rewards, producción, liquidaciones, finanzas, simulaciones, configuración y QA. Dispositivos/hotspots/deudas son placeholders. Landing aporta contenido, agenda, reserva, asistencias y reseñas.

## 5. Estado general

- Lint: ambas pasan; dash 5 warnings.
- Typecheck: ambas pasan.
- Build: ambos exit 0; landing registra fallos DNS y genera contenido degradado.
- Unit: 25/26, un fallo.
- E2E: no ejecutado para evitar escrituras remotas; suites históricas existen.
- Dependencias: 6 high en dash, 8 high en landing según npm audit 2026-08-13.

## 6-9. Hallazgos priorizados

Cada estado es `CONFIRMADO`, `PROBABLE` o `REQUIERE VALIDACIÓN`.

### AUD-001 — Dos esquemas incompatibles sobre la misma base

- Severidad/estado/módulo: **CRITICAL / CONFIRMADO / arquitectura-datos**.
- Archivos/ubicación: `dash/src/sql/000_production_bootstrap.sql`, `dash/src/sql/002_enums.sql`, `lbbs_Dash_v2/supabase/sql/**`, `landing/app/api/public/**`, `landing/src/lib/public/landing-data.ts`.
- Evidencia/actual: mismas credenciales de proyecto; diez tablas solapadas con columnas divergentes; roles/estados/fuentes incompatibles.
- Esperado/impacto: contrato único versionado. En base limpia landing falla; en híbrida puede escribir estados/columnas fuera del dominio canónico, comprometiendo reservas/clientes/auditoría.
- Causa/solución/dependencias/riesgo de arreglo: migración incompleta entre v1/v2. Congelar DDL, capturar esquema remoto, definir modelo objetivo y adaptar landing con migración de datos. Depende de todas las entidades compartidas; corregir sin backup/staging es de alto riesgo.

### AUD-002 — IDOR y exposición de PII por teléfono

- Severidad/estado/módulo: **CRITICAL / CONFIRMADO / landing-seguridad**.
- Archivo/ubicación: `landing/app/api/public/customer-visits/route.ts:15-85`.
- Evidencia/actual: cualquier caller presenta un teléfono y service role devuelve nombre, historial, fechas, sede, servicio y rewards.
- Esperado/impacto: verificación de propiedad y mínima respuesta. Permite enumeración de clientes y hábitos.
- Causa/solución/dependencias/riesgo: teléfono tratado como secreto. Deshabilitar o exigir OTP/token firmado y rate limit; preservar UX con flujo de verificación. Riesgo funcional medio, beneficio inmediato.

### AUD-003 — Escrituras públicas privilegiadas sin controles antiabuso/atomicidad

- **HIGH / CONFIRMADO / landing-reservas-reseñas**.
- `landing/app/api/public/reservations/route.ts`, `reviews/route.ts`, `availability/route.ts`.
- Service role crea clientes/reservas/reseñas sin rate limit, idempotency key, límites de texto ni transacción; disponibilidad es check-then-insert.
- Impacto: spam, duplicados y double booking bajo concurrencia. Mover a RPC de mínimo privilegio con lock/constraint, idempotencia, CAPTCHA/rate limit y límites. Riesgo de corrección medio por UX pública.

### AUD-004 — Auditoría incompatible e incompleta

- **HIGH / CONFIRMADO / trazabilidad**.
- `dash/src/sql/003_core_tables.sql`, `landing/src/lib/audit.ts`, APIs admin.
- Landing escribe formato legacy; tabla canónica usa action/entity/metadata. Solo una ruta admin escribe audit directamente y no hay trigger genérico before/after.
- Impacto: eventos públicos pueden fallar y CRUD críticos carecen de before/after/motivo. Definir esquema único append-only y instrumentar RPC/trigger/handlers. Riesgo medio por volumen/PII.

### AUD-005 — Dependencias con vulnerabilidades high

- **HIGH / CONFIRMADO / dependencias**.
- `package-lock.json` y manifests. npm audit: dash 6 high, landing 8 high; incluye Next directo y toolchain/transitivas.
- Impacto depende de advisories/runtime. Actualizar primero patch compatibles, probar y planificar salto de landing. Riesgo medio por dos majors distintos.

### AUD-006 — Motivo de cortesía no es obligatorio

- **HIGH / CONFIRMADO / POS-dinero-auditoría**.
- `features/pos/courtesy-validation.ts`, checkout líneas 405/1073, test `courtesy-validation.test.ts:29`.
- Test falla: helper acepta sin motivo; backend sustituye “Cortesia de servicio”; DB permite null.
- Esperado: motivo explícito y regla consistente. Impacto: pérdida de trazabilidad sobre gratuidades. Corregir UI/API/constraint/RPC/test en conjunto. Riesgo medio.

### AUD-007 — Build landing oculta indisponibilidad de datos

- **HIGH / CONFIRMADO / disponibilidad**.
- `landing/src/lib/public/landing-data.ts`; build ejecutado.
- Consultas devuelven `[]` ante error y build sale 0 pese a múltiples `fetch failed`.
- Impacto: despliegue “verde” con home vacío. Diferenciar not-found/error, healthcheck predeploy y estrategia dinámica/cache. Riesgo bajo-medio.

### AUD-008 — Guards no uniformes y bloqueo de contraseña evadible

- **MEDIUM / CONFIRMADO / auth**.
- customers/search, reservations notes, POS/rewards bootstrap y stock GET usan RLS/RPC sin guard común.
- No implica bypass de filas si RLS está correcta, pero omite `must_change_password`, estandarización 401/403 y defensa en profundidad.
- Centralizar `requireSession(module, action, scope)`. Riesgo bajo si se prueba matriz de roles.

### AUD-009 — Recuperación sin rate limit

- **HIGH / CONFIRMADO / auth**.
- `api/auth/password/recovery-request/route.ts`.
- Mensaje genérico evita enumeración, pero llamadas ilimitadas pueden bombardear correos/costos. Añadir rate limit por IP/email hash y observabilidad. Riesgo bajo.

### AUD-010 — Checkout no es una única transacción

- **HIGH / PROBABLE / POS-integridad**.
- checkout líneas 978-1228; RPC `complete_sale`.
- Venta draft, items, reward y pagos se escriben en llamadas separadas; cleanup es best-effort. Puede quedar draft/redemption parcial ante fallo de red/permiso.
- Encapsular preparación+complete en una RPC idempotente. Validar fixtures existentes antes. Riesgo de corrección alto.

### AUD-011 — Código administrativo muerto en landing

- **MEDIUM / CONFIRMADO / legacy**.
- analytics-dashboard, reservation-board y utilidades asociadas; consumen `/api/control/*` inexistente y no tienen import desde páginas.
- Impacto: deuda, superficie confusa, tipos `any`. Confirmar con bundle/import graph y retirar o mover. Riesgo bajo.

### AUD-012 — Componentes/handlers monolíticos

- **MEDIUM / CONFIRMADO / mantenibilidad-performance**.
- checkout 1236 líneas; products panel 982; reservations 921; POS workspace 842; public form 612.
- Mezclan validación, queries, transformación y UI; elevan regresión/renders. Extraer por dominio después de estabilizar contratos. Riesgo medio-alto.

### AUD-013 — TypeScript sin contrato DB/API

- **MEDIUM / CONFIRMADO / tipos**.
- 58 apariciones de `any`, numerosos casts de payload; no hay tipos Supabase generados ni schemas runtime.
- Typecheck verde no valida respuestas ni DB. Generar tipos, schemas compartidos y DTOs. Riesgo gradual bajo.

### AUD-014 — Logs versionados y artefactos históricos

- **LOW / CONFIRMADO / repositorio**.
- 14 `.log` tracked aunque `*.log` está ignorado; no se detectaron tokens en scan.
- Ruido y riesgo futuro de secretos. Retirar del tracking en fase autorizada. Riesgo bajo.

### AUD-015 — Cobertura de tests desequilibrada

- **HIGH / CONFIRMADO / testing**.
- Landing: cero tests. Dash: 26 unitarios y 37 E2E declarados; unit actual falla; E2E depende de credenciales/remote writes.
- No hay integración aislada DB/API ni fixtures locales reproducibles. Crear staging/local Supabase y contratos cross-app. Riesgo medio.

### AUD-016 — Límites Git/repo ambiguos

- **MEDIUM / CONFIRMADO / entrega**.
- raíz y landing no son repo Git; dashboard interno sí, además existe `.git` exterior inválido/vacío.
- Cambios cross-app no tienen historial atómico. Unificar monorepo o documentar repos/deploys. Riesgo organizativo.

### AUD-017 — `/pos` no tiene guard de página

- **LOW / CONFIRMADO / UX-auth**.
- `(pos)/layout.tsx` solo visual y proxy no matchea `/pos`; APIs sí están protegidas.
- Un anon puede cargar shell vacío/error, no datos. Añadir guard server para consistencia. Riesgo bajo.

### AUD-018 — APIs landing duplicadas/N+1 lógico

- **MEDIUM / CONFIRMADO / performance**.
- seis `/api/public/landing/*` llaman `getLandingData()` completo aunque devuelven una sección; además existen `/services`, `/team`, `/reviews`.
- Multiplica consultas/service-role y contratos. Consolidar endpoint/cache o loaders específicos. Riesgo bajo.

### AUD-019 — XSS posible en JSON-LD

- **MEDIUM / PROBABLE / landing**.
- `landing-json-ld.tsx:56` inserta JSON con reseñas mediante `dangerouslySetInnerHTML` sin escapar `<`.
- Una reseña aprobada maliciosa podría cerrar el script. Escapar `<` como `\u003c` y probar payload. Riesgo bajo.

### AUD-020 — Documentación operativa contradictoria

- **LOW / CONFIRMADO / despliegue**.
- README enumera ejecución histórica hasta 107; `SQL_PRODUCTION_INSTALL` exige solo bootstrap; existen parches hasta 126.
- Puede provocar doble aplicación/orden incorrecto. Mantener un único runbook generado. Riesgo bajo.

### AUD-021 — Módulos visibles sin función

- **LOW / CONFIRMADO / UX**.
- dispositivos/hotspots/deudas muestran placeholders; deudas reales están en Equipo.
- Navegación promete capacidades inexistentes. Ocultar/etiquetar beta o implementar. Riesgo bajo.

### AUD-022 — Warnings y estado React

- **LOW / CONFIRMADO / calidad**.
- tres símbolos muertos en ventas; dependency warning de `useEffect` en CompensationRulesPanel; 99 client components en features.
- Puede producir datos stale y renders excesivos. Corregir tras core. Riesgo bajo.

## 10-23. Evaluación transversal

- Seguridad: dos bloqueadores; RLS canónico es fuerte, pero service role de landing lo anula.
- DB/integridad: buen diseño canónico, pésima coexistencia de linajes.
- APIs: 98 paths, validación manual, pocos límites/paginación desigual.
- Auth: separación conceptual correcta; guards inconsistentes.
- Reglas: bien trasladadas a RPC en dinero/nómina, contradicción en cortesías/reservas públicas.
- Performance: loaders landing redundantes, componentes grandes, fetches repetidos; optimizar después del contrato.
- UX: feedback con SweetAlert y loading en core; placeholders, acciones API sin UI y shell POS sin guard.
- Código: modular por features pero handlers/UI críticos monolíticos.
- Testing: dash tiene inversión E2E histórica; no es reproducible sin remoto y landing no tiene cobertura.
- Legacy: 49 SQL y al menos 18 TS/TSX landing probablemente huérfanos.
- Regresión: máximo en tablas compartidas, POS, stock, caja, rewards y settlement.

## 24. Recomendaciones

No iniciar refactors. Primero contener PII, capturar esquema remoto, definir contrato único y construir pruebas cross-app. Después atomizar checkout, cerrar auditoría/cortesías y actualizar dependencias.

## 25. Orden recomendado

`AUD-002` como hotfix inmediato; en paralelo diagnóstico/migración de `AUD-001`. Luego `AUD-003`, `AUD-009`, `AUD-006`, `AUD-010`, `AUD-004`, `AUD-005`, `AUD-015` y mantenibilidad.
