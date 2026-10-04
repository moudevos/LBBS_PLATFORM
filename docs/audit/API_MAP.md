# Mapa de APIs

Se encontraron 98 paths de route handler: 83 dashboard y 15 landing. Declaran 130 handlers HTTP: 63 GET, 49 POST, 16 PUT y 2 PATCH. No hay DELETE HTTP; las bajas son estado/cancelación o endpoints QA POST.

## Dashboard: matriz por grupo

| Grupo / endpoints | Métodos | Auth/roles | Datos/efectos | Riesgos |
| --- | --- | --- | --- | --- |
| `/api/auth/me`, `/password/*`, `/auth/confirm` | GET/POST | sesión salvo recovery/confirm | Auth, employees, audit_logs | recovery sin rate limit |
| `/api/admin/branches[/{id}]` | GET/POST/PUT | admin | branches | service role, sin auditoría before/after |
| `/api/admin/employees[/{id}]`, recovery | GET/POST/PUT | admin | employees + Auth + audit | cuenta/perfil no transaccional único |
| `/api/admin/customers`, `/{id}`, `/search` | GET/POST/PUT | write guard; search por RLS | customers | search sin guard explícito |
| `/api/customers/lookup-document` | POST | customer-write | API Perú, cache/log/customers | dependencia externa; payload manual |
| `/api/admin/services*`, categories, prices | GET/POST/PUT | admin | service tables/views | service role; DTO manual |
| `/api/admin/products*`, categories, units, prices | GET/POST/PUT | admin | product tables/views | service role; DTO manual |
| `/api/admin/stock-movements` | GET/POST | RLS/read; write owner/admin/reception | stock_movements/view | GET sin guard explícito; error DB filtrado en POST |
| `/api/admin/reservations*` | GET/POST/PUT | reservation/pos guards salvo notes | reservations/notes/sales/templates | notes depende de RLS; estados manuales |
| `/api/admin/pos/bootstrap` | GET | RPC role | catálogos, sesiones, reservas | no guard uniforme/cambio password |
| `/api/admin/pos/sessions*` | GET/POST | pos/reservation guard | RPC open/close/summary | sesión/branch críticos |
| `/api/admin/pos/checkout` | POST | pos guard | sales/items/payments/stock/rewards/reservation | 1236 líneas; preparación multitransacción |
| `/api/admin/pos/sales*`, `/api/admin/sales*` | GET/POST | pos guard | cancel RPC, ticket snapshot | status mapping/manual |
| `/api/admin/cash/*` | GET/POST | role RPC/cash guard | cash/POS/payment closure | bootstrap 455 líneas |
| `/api/admin/rewards/*` | GET/POST/PUT | admin config; operation guard/RPC | rules, benefits, ledger, entitlement | bootstrap sin guard uniforme |
| `/api/admin/production`, payroll | GET/POST | admin | production/periods/debts | RPC crítica |
| `/api/admin/settlements*` | GET/POST | admin | snapshots/debts/cash/finance | RPC transaccional; payload poco tipado |
| `/api/admin/employee-finance/{id}` | GET/POST | GET admin; POST pos guard + RPC | benefit/debt/supply/stock/cash | UI/permiso divergente |
| `/api/admin/finance*` | GET/POST | admin | manual ledger | cancelación vía POST |
| `/api/admin/settings` derivados | GET/POST/PUT | admin | methods/reasons/templates/rules | varias rutas service role |
| `/api/admin/control/kpis`, system health | GET | role/admin | agregados/host DB | health admin expone host del proyecto |
| `/api/admin/qa/*` | GET/POST/PATCH | owner + flags | QA y limpieza | destructivo si flags se habilitan |
| `/api/health` | GET | público | ready | correcto para healthcheck |

## Landing: todos los paths

| Endpoint | Método | Parámetros/body | Tablas | Riesgo |
| --- | --- | --- | --- | --- |
| `/api/public/agenda` | GET | branch_id,date | branches/schedules/reservations | service role, esquema legacy |
| `/api/public/availability` | GET | branchId,serviceId,employeeId,date | schedules/services/reservations | check concurrente no atómico |
| `/api/public/customer-visits` | GET | phone | customers/stats/rewards/reservations | IDOR/PII crítico |
| `/api/public/gallery` | GET | - | landing_assets/Storage | errores se convierten en vacío |
| `/api/public/landing/{branches,gallery,reviews,services,settings,team}` | GET | - | landing-data | seis wrappers duplican lecturas completas |
| `/api/public/reservation-options` | GET | - | branches/employees/services | roles/columnas legacy |
| `/api/public/reservations` | POST | sede, servicio, barbero, cliente, fecha/hora | customers/reservations/audit | service role, sin rate limit/idempotencia |
| `/api/public/reviews` | GET/POST | rating/comment/name/phone/branch | customer_reviews | sin límites de texto/rate limit |
| `/api/public/services` | GET | - | services | duplicado de landing/services |
| `/api/public/team` | GET | - | employees | duplicado de landing/team |

## Contratos y errores

No hay OpenAPI ni schemas runtime. Los cuerpos se interpretan con casts/`typeof` y varios handlers devuelven `error.message` de Supabase, especialmente landing, filtrando detalles internos. La paginación existe en historiales puntuales; listados maestros y algunos agregados no paginan. No se observaron límites de body/texto en rutas públicas.
