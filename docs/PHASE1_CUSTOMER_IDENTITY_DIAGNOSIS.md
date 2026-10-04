# Fase 1 — diagnóstico de identidad digital

La base remota ya ejecutó `147_customer_identity_rewards_phase1.sql`. Se reutilizan `customer_accounts`, `customer_link_requests`, `customer_reward_physical_migrations`, el ledger Rewards con `idempotency_key` y las RPC de identidad/Rewards.

La aplicación de clientes vive exclusivamente en `lbbs-clientes`; el dashboard conserva solo acciones internas de vinculaciones y migración física. La corrección `148_customer_identity_phase1_corrections.sql` no duplica 147: agrega estado seguro de solicitud y endurece reintentos/concurrencia del registro y uso único del código.

La atención Rewards sigue siendo una venta `completed`, de un cliente real y con al menos un `sale_item` de servicio; no depende del cierre de la sesión POS.
