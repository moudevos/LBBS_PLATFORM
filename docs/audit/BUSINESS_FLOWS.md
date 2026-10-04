# Flujos de negocio

## Autenticación y autorización

Entrada login -> Supabase Auth -> `/api/auth/me` -> empleado/rol -> `/control`. Proxy refresca cookies; layout valida sesión/cambio obligatorio; página valida módulo; API valida rol; RLS/RPC vuelve a validar. Recuperación usa mensaje genérico y service role solo para auditoría.

Riesgos: recovery no tiene rate limit; endpoints que no usan `require*` omiten el bloqueo de contraseña y descansan en RLS.

## Reserva administrativa

Reception/admin selecciona cliente, sede, interés de servicio/barbero, fecha/hora y estado -> `/api/admin/reservations` -> `reservations`; notas a `reservation_notes`; contacto usa template y log. La reserva es referencial: no descuenta stock, no cobra ni genera rewards. Al pasar a POS solo se vincula; la venta real define ítems/barbero/precios.

Estados canónicos: pending, contacted, confirmed, rescheduled, checked_in, completed, cancelled, no_show. Riesgo: landing escribe el vocabulario heredado.

## Reserva pública

`/reservar` -> options -> availability -> POST reservations con service role. Valida teléfono, servicio/barbero/sede/horario; detecta solapamiento confirmado y advierte pendiente; busca/crea cliente; inserta reserva; intenta auditar. No hay transacción única, idempotencia, rate limiting ni constraint de exclusión.

## Venta/POS

1. Abre sesión POS por sede (`open_pos_session`).
2. Bootstrap carga catálogos, cliente, reserva, pagos, cortesías/rewards.
3. Cliente arma carrito local; backend recalcula precios, stock, cortesías, reward y pagos.
4. Crea venta draft, ítems, reward y pagos en llamadas separadas.
5. `complete_sale` bloquea/valida, descuenta stock, completa venta/reserva y dispara producción.
6. Se genera/consulta snapshot de ticket; cancelación usa RPC e intenta revertir efectos.

Inconsistencia posible: fallo entre llamadas deja limpieza compensatoria best-effort; no todo checkout está en una transacción DB.

## Caja

Sesión POS -> movimientos manuales por categoría -> RPC `create_cash_movement`; cancelación por RPC; cierre obtiene resumen por método y registra conciliación. Liquidaciones e insumos pueden crear movimientos vinculados. Reglas: recepción limitada a sede, montos positivos, categorías activas y sesión compatible.

## Stock

Compras/ajustes/mermas/transferencias/cortesías/ventas alimentan `stock_movements`; `vw_product_stock` agrega saldo. Venta e insumo validan disponibilidad. El endpoint manual normaliza signo y recepción se valida por sede.

## Rewards

Venta completa genera ledger/entitlement según reglas; POS puede aplicar uno; migración registra visitas históricas; recalculo reconstruye. Cliente genérico no participa. Beneficios/reglas deben estar activos y vigentes. Landing conserva un sistema de rewards distinto, con tablas y semántica incompatibles.

## Producción y liquidación

Venta completada -> trigger/RPC genera producción por empleado -> periodo -> borrador de liquidación con snapshots -> revisión/ajustes -> aprobación -> pago exacto. Pago efectivo exige sesión POS y genera egreso; deudas se aplican al pagar; settlement pagado es inmutable por parches posteriores. Todo el bloque principal está encapsulado en RPC transaccionales.

## Empleados: beneficio, insumo y deuda

Equipo abre perfil financiero. Admin registra deuda/pago; admin o recepción de sede registra corte mensual e insumo. Insumo reduce stock y crea deuda o ingreso inmediato. Restricción única impide doble corte mensual. La UI solo expone el perfil a admin aunque dos RPC permiten reception.

## Contenido de landing

No existe módulo actual en dashboard para reseñas, galería, horarios o imágenes. Landing lee directamente tablas heredadas/Storage. Por tanto, “administración del landing” es una capacidad ausente en dashboard v2.
