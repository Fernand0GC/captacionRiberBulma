# Research: 006

## R1. Totales del Excel
- **Decision**: Poner `numFmt = '#,##0'` en cada celda del resumen (fila 4). El formato de celda gana al de columna.
- **Rationale**: Hoy la fila 4 cae en columnas con formato fecha (A) y hora (E), por eso «#########» y «00:00».

## R2. Observaciones al crear
- **Decision**: `org_save` / `org_save_many` aceptan `notes` (≤ 300, recortadas). En edición, si `notes` no llega, se conserva. `org_set_result` sigue igual.
- **Rationale**: El campo ya existe en la tabla; solo faltaba en el formulario (dos observaciones del grupo).

## R3. Orden por persona
- **Decision**: `org_list` ordena `work_date, branch, person, shift, start_time`. La tabla agrega una fila separadora con el nombre al cambiar de persona; el Excel usa el mismo orden.
- **Rationale**: La foto del Excel muestra el pedido «debería estar organizada por personal».

## R4. Subcanal agregado
- **Decision**: `org_add_subchannel` copia `uses_goal` y `uses_share_goal` del canal.

## R5. Catálogo
- **Decision**: Migración con los 3 canales de Tienda (sin metas), los 2 subcanales de compartidas (solo compartidas, horario del genérico), desactivar el genérico y «Activaciones en plazas». `on conflict do nothing` por nombre.

## R6. Volanteras
- **Decision**: `org_channels.uses_flyers boolean default false` (true en Calle → Negociación y Activación). `org_assignments.flyer_ids uuid[]`. `org_upsert` valida que cada id sea perfil activo con rol `field_volunteer` de la sucursal (en edición se aceptan las que ya estaban) y vacía el dato si el canal no las pide. `org_list` devuelve `flyers: [{id, name}]`. Nuevo `org_staff` ya devuelve el rol, el formulario filtra volanteras.
- **Rationale**: Un arreglo evita una tabla hija; la cantidad es chica (≤ 10).

## R7. Rol Cobros
- **Decision**: Valor nuevo `collections` en `app_role`, en una **migración aparte** (Postgres no deja usar un valor de enum en la misma transacción en que se crea). Alcance por `profile_branches`, como el jefe de ventas.
- **Asignación del rol**: RPC `admin_set_collections(p_profile uuid, p_branches smallint[])` (solo admin): pone el rol, deja `branch_id` nulo y reemplaza sus sucursales. Desde Usuarios, botón «Hacer Cobros» en un usuario. **No se toca la edge function `admin-users`**: no se puede publicar desde esta Mac (el proyecto de producción está en la organización de Fer).
- **Pantalla**: `/verificar-compartidas`; `homePath` de Cobros lleva ahí; menú solo con esa opción.
- **Datos**: `org_assignments.share_verified smallint`, `share_verified_note text`, `share_verified_by uuid`, `share_verified_at timestamptz`.
- **RPC**: `org_share_list(p_from, p_to, p_branches)` y `org_verify_shares(p_id, p_verified, p_note)`. Permiso `can_verify_shares(branch)` = activo y (global, o rol `collections` con esa sucursal en `profile_branches`).
- **Constitución**: el principio IV lista los roles; se enmienda (v1.3.0) para agregar «Cobros (verifica compartidas, sin datos de clientes)». Pedido del usuario 2026-11-18.

## R8. Despliegue
- **Decision**: Dos archivos: `20261118002000_collections_role.sql` (solo el enum) y `20261118002100_ajustes_ventas_2.sql` (todo lo demás). En producción, un SQL con dos transacciones (`commit` entre ambas). Todo aditivo; la app publicada sigue funcionando.

## R9. Decisiones de implementación (2026-11-18)
- **Excel (R1)**: exceljs aplica el `numFmt` de una columna también a las celdas que ya existen; por eso el formato de los totales se pone **después** de configurar las columnas (si no, A seguía en fecha y E en hora). La prueba e2e lee el archivo y lo verifica.
- **Observaciones (R2)**: más de 300 caracteres se rechaza (`invalid_input`/`notes`), igual que `org_set_result`; «recortadas» = sin espacios al borde.
- **Volanteras (R6)**: al editar, `flyer_ids` ausente también se conserva (la app publicada no lo manda). `org_save_many` no cambió: ya copia los datos comunes (`notes`, `flyer_ids`) a cada ítem a través de `org_upsert`.
- **org_share_list**: además de `rows` devuelve `branches` (las sucursales que puede verificar quien consulta) para el filtro y el aviso de Cobros sin sucursales.
- **org_verify_shares**: nulo borra también el comentario; no toca `updated_at`/`updated_by` de la asignación (son de ventas).
- **Rol Cobros**: `profiles_branch_required` se amplía para que Cobros quede sin sucursal propia. `admin_set_collections` rechaza al propio admin (`invalid_input`/`self`). El formulario de Usuarios no ofrece crear Cobros (la Edge Function no conoce el rol): se crea el usuario y se usa «Hacer Cobros». Al **editar** a un Cobros se manda sin rol y después se vuelven a poner sus sucursales con `admin_set_collections`, porque la Edge Function borra `profile_branches` de quien no es jefe de ventas.
- **Menú**: «Verificar compartidas» también aparece para gerencia y Sistemas (la ruta y la base ya los permiten).
- **Pruebas**: la e2e de «+ Agregar otro…» (004) pasa de Tareas administrativas a Compartidas y estados, para ver que el subcanal toma las marcas del canal; los conteos del catálogo en pgTAP suben a 14 canales y 37 subcanales. Usuario local de prueba `cobros.verdolago` (Verdolago) agregado a `seed.sql` y creado en la base local.
- **Constitución**: además de Cobros, la lista de roles del principio IV incluye «jefe de ventas», que faltaba desde la spec de jefe de ventas.
