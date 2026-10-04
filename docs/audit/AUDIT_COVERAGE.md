# Cobertura de auditoría

Fecha de corte: 2026-08-13. Raíz auditada: `LBBS_PLATFORM`.

## Alcance y método

Se identificaron 667 archivos fuera de directorios generados al iniciar la segunda pasada. Todos quedaron clasificados por las reglas deterministas de este documento. La lectura directa se concentró en entrypoints, autenticación, rutas API, SQL canónico, flujos críticos, configuración y tests; el resto del código fuente fue revisado indirectamente mediante inventario, grafo de imports/consumidores, búsquedas de Supabase, RPC, variables, patrones inseguros, tamaños y compilación.

No se afirma que se haya validado el comportamiento remoto: el proyecto Supabase no fue modificando ni interrogado con credenciales administrativas. Durante el build de landing el DNS de Supabase no resolvió.

| Estado | Regla de clasificación | Cantidad | Nota |
| --- | --- | ---: | --- |
| Revisado directamente | entrypoints/config, auth, API crítica, SQL de esquema/RLS/RPC, tests y archivos citados | 214 | lectura de contenido y contraste entre capas |
| Revisado indirectamente | componentes, tipos, utilidades y seis archivos legacy de nivel exterior cubiertos por scans, imports, lint, typecheck o build | 389 | clasificados; no ejecutados individualmente |
| Generado/no relevante | logs de desarrollo, imágenes, lockfiles, `tsbuildinfo`, `.env.local` (solo nombres) | 64 | valores secretos no copiados |
| Sospechoso/legado | SQL exterior y bloques administrativos huérfanos de landing | 55 | se solapa con las categorías anteriores |
| Pendiente | comportamiento E2E actual y esquema remoto real | 0 archivos | pendiente externo, no archivo sin clasificar |
| No accesible | base Supabase/Vercel/CI remotos | N/A | fuera del filesystem |

## Inventario estructurado

Cada patrón incluye todos sus archivos, sin excepciones silenciosas.

| Módulo/patrón | Archivos | Estado |
| --- | ---: | --- |
| `package.json` raíz | 1 | revisado |
| `lbbs_Dash_v2/lbbs-v2/src/app/**` | 121 | revisado directo (rutas/páginas) e indirecto (layouts simples) |
| `lbbs_Dash_v2/lbbs-v2/src/features/**` | 133 | revisado directo por módulo e indirecto por imports/lint/typecheck |
| `lbbs_Dash_v2/lbbs-v2/src/components/**` | 21 | revisado indirectamente |
| `lbbs_Dash_v2/lbbs-v2/src/lib/**` | 27 | revisado; auth/Supabase directo |
| `lbbs_Dash_v2/lbbs-v2/src/sql/**` | 72 | revisado estructuralmente; scripts críticos/RLS/RPC directos |
| `lbbs_Dash_v2/lbbs-v2/tests/**` | 20 | revisado; 6 unitarios ejecutados |
| `lbbs_Dash_v2/lbbs-v2/docs/**` | 28 | revisado indirecto y documentos QA clave directos |
| configs/scripts/assets/logs del dashboard | 46 | config/scripts revisados; assets/logs no relevantes |
| `lbbs_Dash_v2/supabase/sql/**` | 49 | legado, revisado estructuralmente y por divergencias |
| utilidades exteriores de `lbbs_Dash_v2` | 6 | legado/sospechoso |
| `lbbs_landing_v2/app/**` | 31 | revisado directamente |
| `lbbs_landing_v2/src/**` | 77 | revisado directo/indirecto; 18 archivos huérfanos probables |
| `lbbs_landing_v2/public/**` | 18 | assets/no relevante, READMEs revisados |
| config raíz de landing | 13 | revisado; `.env.local` solo por nombres |

## Entry points inventariados

- Dashboard: 27 páginas, 83 rutas API/route handlers, `proxy.ts`, 133 archivos feature, 63 tablas canónicas.
- Landing: 5 páginas, 15 rutas API, 77 archivos `src`, 40 tablas del linaje heredado como contrato implícito.
- Tests: 6 archivos unitarios (26 casos en runtime) y 10 specs E2E (37 declaraciones).
- SQL: 71 archivos SQL canónicos/QA más un documento de orden; 49 SQL heredados.

## Excluidos

| Directorio | Motivo |
| --- | --- |
| `**/node_modules/**` | dependencias instaladas; auditadas por manifests y `npm audit` |
| `**/.next/**` | artefactos generados por Next.js |
| `**/.git/**` | metadatos Git |
| `**/test-results/**`, `playwright-report`, `coverage` | evidencia/coverage generados |
| `dist`, `build`, caches | artefactos compilados |

## Archivos sospechosos o posiblemente no utilizados

- Alta: `landing/src/components/analytics/analytics-dashboard.tsx`, `landing/src/components/reservations/reservation-board.tsx` y sus dependencias llaman `/api/control/*`, inexistentes en landing, y no tienen import entrante desde páginas.
- Alta: controles administrativos de landing (`data-table`, `schedule-editor`, `control-combobox`, `role-badge`, `money-input`) sin consumidores.
- Media: `landing/src/lib/analytics/**`, `customers/import.ts`, `customer-product-discount.ts`, `storage/upload-image.ts`, `supabase/middleware.ts` no participan en rutas actuales.
- Alta: `dash` expone páginas placeholder para dispositivos, hotspots y deudas; deudas reales viven dentro de Equipo.
- Alta: 14 logs de desarrollo están versionados aunque `*.log` está ignorado actualmente.
- Legado confirmado: `lbbs_Dash_v2/supabase/sql/**` modela la aplicación previa y no el bootstrap canónico de dashboard.

## Verificación de segunda pasada

Se reconciliaron: 27+5 páginas, 83+15 rutas API, 63+40 tablas declaradas, 430 archivos TS/TSX, 120 SQL, 20 archivos de test y todas las variables de entorno referenciadas. Los cuatro archivos inicialmente fuera de grupos resultaron metadatos/archivos de nivel intermedio y quedaron como generado/no relevante. No queda archivo fuente relevante sin regla de clasificación.
