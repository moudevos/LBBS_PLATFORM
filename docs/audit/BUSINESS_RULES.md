# Reglas de negocio extraídas

| Regla | Procedencia |
| --- | --- |
| Una reserva no es una venta ni descuenta stock/genera rewards | README; reservation handlers; checkout |
| Roles válidos canónicos: owner/admin/reception/barber/viewer | `src/sql/002_enums.sql`, `module-permissions.ts` |
| Reception opera entidades transaccionales de su sede; clientes son globales | RLS helpers/policies, SQL 113, QA contract test |
| Barber solo ve reservas asignadas; viewer consulta sede | `030_reservations.sql` |
| Cambio obligatorio bloquea control y guards de escritura comunes | control layout, `route-auth.ts` |
| Venta requiere sesión POS abierta de misma sede y al menos un ítem | checkout, `complete_sale` RPC |
| Venta con servicio requiere barbero | checkout, `complete_sale` |
| Solo productos pueden marcarse cortesía en checkout actual | checkout POST (contradice helper que permite cortesía de servicio manual) |
| Venta solo de cortesías no se completa como monetaria | checkout POST |
| Precios, descuentos, pagos y stock se recalculan en servidor/DB | checkout, triggers/RPC |
| Pago no efectivo no puede exceder saldo; vuelto solo en efectivo | checkout, SQL 108 |
| Checkout debe portar idempotency key única por sesión | checkout, SQL 109 |
| Cliente genérico no participa en rewards | checkout/reward guards, landing reward server |
| Una reserva solo puede tener una venta completed | índice `sales_one_completed_reservation_idx` |
| Stock manual: cantidad != 0; costo >= 0; signo depende del tipo | stock route |
| Un empleado tiene un beneficio de corte por mes | RPC y unique de employee_benefit_usages |
| Insumo de empleado reduce stock y crea deuda o ingreso | `register_employee_supply_delivery` |
| Comisión >60% exige nota de autorización | prepare settlement RPC y UI |
| Liquidación: draft -> review -> approved -> paid; pago exacto al neto | settlement RPC |
| Pago en efectivo de liquidación exige sesión POS abierta | pay settlement RPC |
| Deudas seleccionadas no superan saldo ni bruto disponible | prepare/pay settlement RPC |
| Venta cancelada debe revertir efectos mediante RPC | cancel sale route/RPC |
| Recovery responde igual exista o no email | recovery route |
| Landing legacy exige móvil peruano de 9 dígitos | public reservations/phone util |
| Landing bloquea solapamiento confirmado, pero solo advierte pendiente | public reservations route |

## Contradicciones críticas

- Landing: `barbero/recepcion`, dashboard: `barber/reception`.
- Landing: `pendiente/confirmado/atendido`, dashboard: `pending/confirmed/checked_in/completed`.
- Landing: `publico`, dashboard permite `public_form`.
- Helper de cortesías acepta cortesía de servicio sin motivo; test exige motivo; checkout la convierte a producto-only y sustituye motivo genérico.
- README antiguo enumera scripts hasta 107; bootstrap/documentación de instalación incluye parches posteriores hasta 126.
