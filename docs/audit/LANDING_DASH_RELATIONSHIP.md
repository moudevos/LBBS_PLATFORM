# Relación Landing / Dashboard

## Dependencias Landing -> Dash

La dependencia no es de código sino de infraestructura y contrato de datos. Landing apunta al mismo Supabase y espera tablas/columnas creadas por el linaje `lbbs_Dash_v2/supabase/sql`: `branch_schedules`, `employee_schedules`, `customer_reviews`, `landing_assets`, `customer_visit_stats`, `customer_reward_accounts`, `service_orders` y columnas heredadas de entidades compartidas.

El home muestra servicios, equipo, reseñas, sedes, configuración, galería y contacto. Reservas públicas crean/reutilizan clientes y escriben reservas. Agenda y disponibilidad leen horarios/reservas. Asistencias revela historial/rewards por teléfono.

## Dependencias Dash -> Landing

El dashboard nuevo no llama a landing ni administra explícitamente `landing_assets`, reseñas o schedules. Sí modifica las entidades compartidas `branches`, `employees`, `customers`, `services`, `reservations`, `app_settings`, `audit_logs` y `whatsapp_templates`, por lo que puede romperla indirectamente.

## Recursos compartidos

| Recurso | Dashboard actual | Landing | Riesgo |
| --- | --- | --- | --- |
| Supabase project/keys | sí | sí | máximo acoplamiento |
| `branches` | `slug`, código/estado | `code`, imagen, dirección, teléfono | columnas divergentes |
| `employees` | `full_name`, rol `barber`, status | first/last name, rol `barbero`, `is_active` | incompatibilidad |
| `services` | `base_price`, categoría, precios por sede | `price`, `sku`, `branch_id` | incompatibilidad |
| `customers` | `phone_normalized`, sin `branch_id` canónico | `normalized_phone`, `branch_id` | duplicados/fallos |
| `reservations` | fecha/hora separadas y estados ingleses | timestamps y estados españoles | incompatibilidad crítica |
| `audit_logs` | action/entity/metadata | event/table/old/new/IP | incompatibilidad crítica |
| Storage | no administrado por dash actual | landing-assets/avatars | dependencia unilateral |

## Recursos independientes

- Exclusivos dashboard: POS, ventas, pagos, stock canónico, caja, rewards nuevos, producción, nómina/liquidaciones, finanzas, QA.
- Exclusivos landing/legado: reseñas, galería, horarios, visitas, devices/hotspots/push/cron y órdenes heredadas.
- UI, runtime Next, React y lockfiles son independientes.

## Cambios en Dash que podrían afectar Landing

1. Reinstalar `000_production_bootstrap.sql` en una base limpia: landing pierde tablas/columnas heredadas.
2. Cambiar enums/roles/estados: filtros públicos quedan vacíos.
3. Simplificar clientes: creación y consulta pública pueden duplicar o fallar.
4. Cambiar servicios/empleados/sedes: desaparecen catálogo/equipo/opciones de reserva.
5. Endurecer RLS no afecta hoy a landing porque service role la evita, pero retirar esa key obliga a crear políticas públicas seguras.
6. Modificar Storage o rutas de imágenes rompe hero/galería/avatares.

Conclusión: no existe un contrato compartido versionado. Antes de corregir dashboard debe elegirse un modelo objetivo y migrar landing a ese contrato.
