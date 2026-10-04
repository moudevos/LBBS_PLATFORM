# Auditoría técnica y funcional financiera — LBBS

**Fecha:** 2026-09-02  
**Alcance:** lectura estática del repositorio `lbbs_Dash_v2/lbbs-v2`, incluyendo migraciones SQL, rutas API y módulos de POS, caja, producción, liquidaciones, deudas y finanzas. No se modificó código, base de datos ni configuración.

> **Límite de evidencia.** Este documento describe el comportamiento implementado en los SQL y la aplicación. No prueba que todas las migraciones hayan sido ejecutadas, en el orden correcto, en producción; tampoco contiene saldos reales. Antes de una intervención financiera se debe contrastar este mapa contra `information_schema`, políticas RLS efectivas y conciliaciones productivas.

## 1. Resumen ejecutivo

LBBS ya no es un POS simple: tiene cinco registros económicos parcialmente independientes: **ventas** (`sales`/`sale_payments`), **caja de sesión** (`pos_sessions`/`cash_movements`), **producción y comisión devengada** (`employee_service_production`/bonos), **cuentas por cobrar a empleados** (`employee_debts`) y **liquidaciones/pagos de personal** (`employee_settlements`). Además existe un libro de asientos manuales (`finance_manual_entries`).

La separación evita que el crédito interno entre a caja y permite comisiones aunque el cliente no pague. Sin embargo, no existe un libro contable único que enlace automáticamente todos esos hechos. Por ello “venta”, “cobro”, “efectivo esperado”, “deuda”, “gasto”, “comisión devengada” y “comisión pagada” pueden diferir correctamente, pero los reportes deben saber exactamente cuál usan.

Hallazgo dominante: las reglas de negocio críticas viven en varias redefiniciones sucesivas de funciones SQL (`complete_sale`, `checkout_pos_sale`, `generate_employee_production_for_sale`, `sync_pos_session_totals`, `review_employee_settlement`). El último archivo aplicado decide el comportamiento. Hay además nombres de SQL duplicados (`121_*`, `126_*`), lo que incrementa el riesgo de divergencia entre entornos si se ejecutan manualmente.

## 2. Arquitectura financiera actual

```text
UI POS
  -> POST /api/admin/pos/checkout
  -> public.checkout_pos_sale(payload) [operación atómica]
      -> sales (cabecera) -> sale_items -> sale_payments
      -> internal_pos_operations / employee_debts cuando aplica
      -> complete_sale
          -> stock_movements
          -> reservations
          -> rewards (solo customer)
          -> sync_pos_session_totals
          -> pos_session_events

Cierre POS
  -> close_pos_session + pos_session_payment_closures
  -> producción se genera/recalcula solo con sesión cerrada
  -> employee_service_production + employee_product_bonus_entries
  -> prepare/review/approve/pay employee_settlements
  -> employee_settlement_deductions + employee_debt_movements
  -> cash_movements cuando un pago de liquidación es efectivo

Finanzas administrativas (paralelo, manual)
  -> finance_manual_entries + finance_categories
```

### Definiciones que usa el sistema hoy

| Concepto | Representación actual | Observación |
|---|---|---|
| Venta | `sales.status='completed'`, con `subtotal`, descuentos, cortesías, `total` y `paid_total` | Puede ser comercial, beneficio o crédito; no equivale por sí sola a efectivo. |
| Cobro | `sale_payments.amount` por método | Puede ser efectivo, QR, tarjeta u `internal_credit`. |
| Caja esperada | Totales por método de sesión + movimientos de caja activos | `internal_credit` se excluye expresamente del resumen de cierre. |
| Ingreso manual | `finance_manual_entries.direction='income'` | No es automáticamente una venta ni una cobranza POS. |
| Egreso manual | `cash_movements` o `finance_manual_entries.direction='expense'` | Dos subsistemas: uno asociado obligatoriamente a sesión POS y otro con fecha financiera. |
| Comisión devengada | Producción/bonos por empleado | Se calcula por periodo y ahora exige sesión POS cerrada. |
| Comisión pagada | `employee_settlements.status='paid'`, método y eventual `cash_movement_id` | Está separada de la comisión generada. |
| Cuenta por cobrar | `employee_debts.outstanding_amount` | Para préstamos, adelantos, insumos, otros e `internal_credit`. |
| Cuenta por pagar | No existe una tabla genérica | La liquidación aprobada es la aproximación para obligación con personal. |

## 3. Tablas y relaciones relevantes

| Tabla | Propósito / valores monetarios / relaciones |
|---|---|
| `payment_methods` | Catálogo. Evoluciona a `payment_kind`, `allows_change`, `counts_as_cash`; `employee_credit` no cuenta como efectivo. |
| `pos_sessions` | Caja por sede/día: apertura, esperado, contado, diferencia, totales por medios, ventas/cancelaciones; FK a sede y operadores. |
| `sales` | Cabecera: subtotal, `discount_total`, `courtesy_total`, total, pagado, vuelto; FKs a sesión, sede, cliente, reserva y barbero. `operation_kind`: customer, employee_benefit, employee_credit, internal_complimentary. |
| `sale_items` | Línea de servicio/producto; precio/costo snapshot, descuento, total, barbero, cortesía y desde 100: regla, original, monto cortesía y línea calificadora. |
| `sale_payments` | Cobros por venta y método. Es la fuente de composición de pago; triggers recalculan totales. |
| `pos_session_events` | Bitácora de apertura/cierre/venta/reapertura. Metadata JSONB. |
| `cash_movements` | Entradas/salidas/ajustes manuales por **sesión** con categoría, evidencia, estado/cancelación y actor. |
| `cash_movement_categories` | Dirección income/expense/adjustment. |
| `stock_movements` | Inventario por venta/cortesía; no es asiento financiero. |
| `employee_service_production` | Devengo por línea de servicio, precios originales, descuentos separados, cobrado, aporte operativo, base y fija; único por `sale_item_id`. |
| `employee_product_bonus_entries` | Bonos por producto/servicio, estado active/pending_review/reversed; único por línea. |
| `employee_debts` | Saldo por empleado/sede, monto original/restante, estado pending/partial/paid/written_off/cancelled, descripción y actores. |
| `employee_debt_movements` | Cargo, pago inmediato/manual, descuento de liquidación, ajuste, castigo o cancelación; enlaza opcionalmente caja, método y liquidación. |
| `employee_supply_deliveries` | Entrega de insumo a empleado; conserva costo/markup/cargo y puede enlazar stock, caja o deuda. |
| `employee_settlements` | Liquidación por periodo/empleado: base, porcentual, fijas, bonos, deducciones, neto y ciclo draft/review/approved/paid/cancelled. |
| `employee_settlement_*_lines` | Snapshots de servicios, bonos, descuentos y ajustes que soportan la liquidación. |
| `employee_customer_links` | Vínculo 1:1 ficha cliente-empleado; habilita crédito interno. |
| `employee_benefit_rules` + objetivos | Beneficio configurable: alcance, tipo/precio, vigencia, límite, sede/rol, pago fijo, aporte y modo de producción. |
| `internal_pos_operations` | Auditoría de venta interna; conserva precio retail, descuento, crédito, regla, deuda y autorizador. |
| `courtesy_rules` + `courtesy_rule_benefits` | Política de cortesías por servicio, sede, precio, vigencia, cantidad/topes y productos/servicios elegibles. |
| `finance_categories` / `finance_manual_entries` | Libro manual por fecha y sede. Desde 146 clasifica grupo financiero y efecto sobre utilidad. |
| Rewards (`reward_*`, `reward_redemptions`) | Fidelización de clientes; exclusiones especiales para clientes vinculados a empleados. |

### Relaciones monetarias principales

```text
pos_sessions 1--N sales 1--N sale_items
sales 1--N sale_payments -> payment_methods
sales 1--0..1 internal_pos_operations -> employee_debts
sales 1--N production/bonus -> payroll_periods -> employee_settlements
employee_settlements 1--N settlement_deductions -> employee_debts
employee_debts 1--N employee_debt_movements -> cash_movements (opcional)
pos_sessions 1--N cash_movements
finance_manual_entries --(no FK automático)-- sales/cash/debts/settlements
```

## 4. Flujo POS y caja

1. El workspace arma carrito, cliente, barbero, pagos, cortesías y operación interna (`src/features/pos/*`, en especial `PosSessionWorkspace.tsx`, `PosPaymentModal.tsx`, `PosInternalOperationModal.tsx`).
2. `POST /api/admin/pos/checkout` valida sesión/rol y llama `checkout_pos_sale` (`src/app/api/admin/pos/checkout/route.ts`, ~1051).
3. La RPC inserta venta draft y líneas, recalcula descuento/cortesía, crea pago normal o deuda `internal_credit`, registra `internal_pos_operations`, aplica reward cuando corresponde y completa la venta (`128_*`, función desde ~308; versiones posteriores 133/135).
4. `complete_sale` comprueba sesión abierta, total pagado, barbero en servicios y stock; descuenta inventario, completa reserva, procesa Rewards para `operation_kind='customer'`, sincroniza sesión y escribe evento (`128_*`, ~434; redefiniciones posteriores prevalecen).
5. `sync_pos_session_totals` actualiza métricas de sesión. `get_pos_session_closure_summary` filtra `payment_kind='internal_credit'`, por tanto crédito no debe elevar caja esperada (`128_*`, ~402).
6. El cierre obtiene resumen por método y persiste conteos/diferencias mediante `close_pos_session`; los movimientos manuales de caja participan a través de `cash_movements` (`050_*`, ~755; `070_*`, ~194/282; rutas `api/admin/cash/*` y `pos/sessions/[id]/close`).

**Qué entra a caja:** pagos de métodos configurados como `counts_as_cash` y movimientos activos de sesión. QR/tarjeta se concilian por método, pero no son efectivo físico. Crédito interno está marcado para excluirse. Cortesía reduce el total cobrado pero conserva precio/original/costo como evidencia de consumo.

## 5. Beneficios, gratuitos y cortesías

### Beneficio interno

Las reglas no están hardcodeadas: están en `employee_benefit_rules`, se editan desde `/api/admin/internal-pos-config` y se filtran para el POS por `get_pos_internal_options` / `PosInternalOperationModal`. Tienen alcance (service/product/all y categorías), beneficio (free/fixed_price/discount_percent), periodo/límite, rol/sede, vigencia, objetivos explícitos, aporte operativo, pago fijo y `production_mode` (migración 130).

La aplicación valida la regla dentro de `checkout_pos_sale`, no solo en navegador: cliente debe estar enlazado, empleado activo, rol/sede/vigencia/cupo deben coincidir. Una operación gratuita interna requiere autorización owner/PIN según 131 y 135. Hay una tensión histórica: 128 exige `authorization_reason` para `internal_complimentary`; 135 introduce PIN. Debe verificarse la definición efectiva de la función/constraint en producción para confirmar si aún se exige razón además de PIN.

### Cortesía

`courtesy_rules` es independiente de beneficio de empleado. Solo califica servicios; admite por defecto/regla productos o servicios, cantidad, topes unitarios/totales, precio mínimo, vigencia/sede/prioridad. La venta conserva la regla y precio original en las líneas. Validaciones posteriores (`133`, `140`, `142`) endurecen checkout y fallback de productos. No se confunde con beneficio interno, aunque ambas reducen cobro y pueden afectar producción.

### Partner/influencer

No se encontró entidad `partner` ni tipo de operación/rol dedicado. Puede modelarse parcialmente como cliente vinculado a un empleado + regla `internal_complimentary`/`employee_benefit`, pero semánticamente lo registra como empleado y no como tercero. El ejemplo S/0, fija S/20 y aporte S/2 es parcialmente expresable con regla de beneficio (`fixed_barber_payout`, `operational_contribution`, `production_mode='fixed'`), pero falta una identidad, autorización y reporte diferenciados de partner.

## 6. Producción, comisiones y pagos de personal

La producción se persiste, no solo se calcula al vuelo. `generate_employee_production_for_sale` separa bruto, descuento comercial, reward, cortesía, cobrado, aporte, base comisionable y fija. Para beneficio, la migración 130 ajusta base/fija según `production_mode`. Cancelación marca líneas de producción/bonos como `reversed`.

Desde 144/145 la generación está protegida por sesión POS cerrada: evita liquidar una venta de caja aún abierta, pero la comisión no se muestra como producción liquidable hasta el cierre. El endpoint de liquidaciones llama `generate_production_for_period` antes de preparar (`api/admin/settlements/route.ts`, ~77).

`prepare_employee_settlement` genera snapshots y no permite deducciones mayores a lo devengado. El ciclo posterior (114, 117, 118, 143, 153) separa revisión, aprobación y pago. Se encontró distinción clara entre **comisión generada** (producción/settlement draft) y **pagada** (`status='paid'`, `paid_at`, método, evidencia, eventual movimiento de caja).

## 7. Deudas y cuentas por cobrar

Tipos detectados: `loan`, `advance`, `supply`, `internal_credit`, `other`; cambios posteriores añaden penalidad/descuento según UI/migraciones relacionadas a 138/143, por confirmar en catálogo efectivo. Una deuda nace por registro administrativo, entrega de insumo, préstamo/adelanto o crédito interno desde POS (`create_pos_internal_credit_debt`). Los movimientos registran cargo y pagos/ajustes; el saldo se conserva en `outstanding_amount` y los estados permiten parcial, pagada, castigo o cancelación.

Los descuentos de liquidación se guardan en `employee_settlement_deductions` y deben reflejarse en `employee_debt_movements`. Un pago directo puede enlazar método y `cash_movement_id`. La venta de crédito crea cuenta por cobrar, pero no ingreso/caja. El trigger de 135 revierte/anula la deuda de crédito si se cancela la venta: es una protección específica, no prueba de rollback uniforme para préstamos, adelantos o insumos.

No existe cuenta por pagar genérica para proveedor/partner: solo obligación laboral materializada como liquidación y egresos manuales/caja.

## 8. Finanzas y reportes

El libro `finance_manual_entries` captura ingresos/egresos administrativos por fecha, sede, categoría/método/evidencia. `146_finance_classification_and_analysis.sql` agrega grupos: ingreso operativo, gasto operativo, costo personal, activos, cuentas por cobrar y financiación. Esto mejora análisis, pero el libro sigue siendo **manual** y no tiene FK automática a venta, sesión, deuda o liquidación.

Reportes consultan diferentes definiciones: POS/sesión usa ventas completadas y pagos; producción usa entradas activas de periodos y sesiones cerradas; liquidaciones usan snapshots; finanzas combina ventas/cortesías/aportes/manuales en `api/admin/finance/analysis`. Las rutas relevantes son `api/admin/sales`, `pos/sessions`, `production`, `settlements`, `employee-debts`, `finance` y `finance/analysis`.

## 9. Auditoría, RLS y seguridad

Cobertura **buena**: ventas (actores y fechas de cierre/cancelación), sesión/eventos, movimientos de caja (anulación con razón), producción (reverso), liquidación (review/approve/pay/cancel) y operaciones internas (regla/deuda/autorización).

Cobertura **parcial**: reglas de beneficio/cortesía conservan actor/fechas, pero no hay versionado inmutable; actualizar regla puede alterar elegibilidad futura mientras operaciones anteriores solo preservan parte de snapshots. Finanzas manuales guardan cancelación/actor pero no historial de cambios de monto/categoría.

Cobertura **inexistente o limitada**: no se observó ledger universal con before/after para todas las entidades financieras ni cuenta por pagar genérica.

RLS está habilitado en las tablas principales. POS usa `can_view_pos_branch` / `can_manage_pos_branch`; caja usa scope de sucursal; finanzas manuales inicialmente owner/admin; reglas de beneficios escritura admin y lectura de equipo. Las RPC `security definer` son el límite de confianza real y deben revisarse en la base desplegada. Riesgo operativo: las rutas API actúan mediante cliente autenticado más RPC, por lo que una política o función heredada distinta en producción cambia la seguridad efectiva.

## 10. Problemas y riesgos

| Severidad | Hallazgo y evidencia |
|---|---|
| **CRÍTICO** | **Posible deriva de esquema/funciones por ejecución manual.** Hay redefiniciones encadenadas de funciones centrales y archivos con prefijos duplicados (`121_purge...`/`121_reception...`, `126_pos_atomic...`/`126_service_bonus...`). Evidencia: `src/sql/050`, `070`, `126`, `128`, `133`, `135`, `144`, `145`, `152`, `153`. Sin un historial de migración verificado no puede afirmarse qué lógica financiera rige producción. |
| **CRÍTICO** | **No hay libro financiero único.** Venta, caja, deuda, liquidación y asiento manual se registran en tablas distintas sin referencia contable común. Evidencia: esquemas 050, 070, 089, 091, 104 y análisis 146. Riesgo: totales correctos localmente pero inconsistentes al consolidar. |
| **ALTO** | **“Venta”, “cobro”, “ingreso” y “caja” pueden mezclarse en reportes.** `sales.total`, `paid_total`, `sale_payments`, `cash_movements` y `finance_manual_entries` representan hechos distintos. Evidencia: 050/070/104/128/146 y endpoints de reportes. |
| **ALTO** | **Partner no tiene modelo propio.** Reutilizar empleado vinculado distorsiona elegibilidad, deudas y reportes de personal. Evidencia: 128 define solo employee/customer links y operation kinds. |
| **ALTO** | **Riesgo de doble contabilización manual.** Un cobro de deuda o pago de personal puede figurar como movimiento de caja y además ser ingresado manualmente en finanzas. No se observó constraint/FK de exclusividad entre ambos libros. Evidencia: 070, 089, 091, 104, 117, 146. |
| **ALTO** | **Reglas financieras no son versionadas.** Las operaciones guardan ciertos snapshots, pero no una versión completa de regla/aporte/autoridad. Evidencia: 100, 128, 130 y columnas de snapshots limitadas. |
| **MEDIO** | **Producción diferida a cierre POS.** Es una protección correcta, pero genera diferencia temporal frente a ventas y caja; reporte debe comunicar estado “pendiente de cierre”. Evidencia: 144/145, `generate_production_for_period`. |
| **MEDIO** | **Dos circuitos de egreso.** Caja manual obliga sesión; finanzas manual opera por fecha. No hay reconciliación automática entre ambos. Evidencia: 070 vs 104. |
| **MEDIO** | **Autorización gratis tuvo evolución incompatible.** PIN, owner y razón aparecen en distintas capas; verificar constraint/RPC final. Evidencia: 128, 131, 135, `internal-authorization` route. |
| **BAJO** | **Cobertura de auditoría de modificaciones de catálogo es parcial.** Hay `updated_at/by`, no bitácora before/after. Evidencia: 100, 104, 128. |

## 11. Escenarios actuales

1. **Corte S/40, efectivo:** venta completed, pago cash, sesión incrementa efectivo esperado, producción normal con aporte/base; al cierre queda liquidable.
2. **Corte S/40, QR:** venta y producción iguales; pago se clasifica como QR, no como efectivo físico, pero se concilia en cierre por método.
3. **Beneficio empleado S/0:** operación interna con regla free; venta conserva retail/descuento, no debe producir caja; producción puede crear paga fija/base según regla. Requiere cliente-empleado enlazado y regla vigente.
4. **Barbero beneficio paga S/20:** operación `employee_benefit` con regla fixed_price; el S/20 entra por pago normal; producción usa modo configurado. No es deuda salvo seleccionar crédito.
5. **Barbero no paga:** solo está soportado para productos mediante `employee_credit`; crea `employee_debt` y pago interno que no entra a caja. Crédito de servicios está expresamente restringido en 128.
6. **Partner gratis, fija 20/aporte 2/neto 18:** no existe partner nativo. Con regla interna de empleado puede registrar S/0 y producción fija/aporte, pero el resultado exacto depende del modo y no queda etiquetado partner.
7. **Deuda S/100, paga S/30:** debe crear movimiento de pago, bajar outstanding a 70 y estado partial; si pago directo afecta caja depende de su integración con `cash_movement`.
8. **Pagar comisión pendiente:** liquidación revisada/aprobada pasa a paid, conserva método/evidencia/actor; puede generar movimiento de caja/ledger según funciones 117/143.
9. **Cancelar atención comisionada:** venta cancelada, stock/rewards/producción deben revertirse; producción marca reversed. Deuda de crédito tiene trigger específico de rollback.
10. **Cerrar caja después:** resumen usa pagos y movimientos activos de la sesión; crédito interno se excluye. Producción no altera esperado de caja.

## 12. Datos no representables completamente hoy

- Partner/influencer como tercero con cuenta, beneficio, autorización, costo y reporte propios.
- Cuenta por pagar genérica a proveedores/partners separada de liquidación laboral.
- Una trazabilidad contable única que conecte evento origen, cuenta/categoría, cobro/pago, caja y reverso.
- Versionado inmutable completo de política de beneficio/cortesía aplicado en una operación.
- Conciliación automática de finanzas manuales contra caja POS y pagos de deuda/personal.

## 13. Mapa de archivos consultados

Migraciones principales: `050_pos_sales.sql`, `070_cash_operations.sql`, `080/081_rewards*.sql`, `085`, `087–093`, `100–105`, `108/109`, `114–119`, `126`, `128–146`, `152`, `153`, y QA de conciliación.  
Aplicación: `src/app/api/admin/pos/**`, `cash/**`, `finance/**`, `production/**`, `settlements/**`, `employee-debts/**`, `sales/**`; `src/features/pos/**`, `cash/**`, `production/**`, `settlements/**`, `employees/**`, `finance/**`, `rewards/**`.

## 14. Recomendaciones preliminares (sin diseño de implementación)

1. Verificar primero el estado efectivo de la base de producción y el orden/historial de SQL antes de cambiar reglas financieras.
2. Establecer un glosario de métricas obligatorio: precio lista, venta neta, cobrado, efectivo, cuenta por cobrar, costo, comisión devengada y pagada.
3. Definir una fuente de verdad financiera y reglas explícitas de enlace/reverso entre ventas, caja, deudas, liquidaciones y libro manual.
4. Decidir si partner es entidad/rol propio antes de reutilizar beneficios de empleado.
5. Hacer que todo reporte indique fecha, criterio de sesión y estado de devengo para evitar comparar venta abierta con producción cerrada.
6. Auditoría previa de RLS y `security definer` desplegados antes de ampliar permisos operativos.

## 15. Preguntas abiertas

- ¿Qué migraciones están realmente aplicadas en producción y en qué orden?
- ¿Cuál es la definición vigente de `sync_pos_session_totals`, `checkout_pos_sale`, `complete_sale` y `review_employee_settlement` en producción?
- ¿Qué reporte se considera oficialmente fuente de verdad para utilidad y cierre diario?
- ¿Un pago directo de deuda siempre crea caja, solo a veces, o puede quedar fuera de ambos registros?
- ¿La razón de autorización gratuita sigue siendo obligatoria además del PIN?
- ¿Cómo se desea distinguir jurídicamente partner, influencer, empleado y barbero?

