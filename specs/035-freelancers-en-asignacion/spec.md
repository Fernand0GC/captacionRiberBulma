# Spec 035 · Freelancers que van en la asignación

Estado: en producción (2026-11-27). Origen: revisión de la observación 2 de ventas («CANAL: FREELANCER. Agregar la
cantidad de freelancers que hay en la sucursal»). La spec 033 muestra la cantidad; al revisarla el usuario pidió
**ver y elegir** los freelancers, como «Volanteras que van» (spec 006).

## Decisión del usuario (2026-11-27)
«Elegir cuáles van»: lista de freelancers de la sucursal con casillas en la asignación; quedan guardados y se ven en
la tabla y el Excel. Si falta uno, se agrega ahí mismo.

## Criterios de aceptación

### Catálogo
1. Nueva marca de canal `org_channels.uses_freelancers` (por defecto `false`). La migración la pone en `true` para el
   canal **Freelancers** (por nombre normalizado). Sistemas puede cambiarla en el Catálogo como las demás marcas.

### Base
2. `org_assignments.freelancer_ids smallint[] not null default '{}'` (ids de `referrers`).
3. `org_upsert` (y por él `org_save` y `org_save_many`) recibe `freelancer_ids` (lista de números). Si el canal no
   tiene `uses_freelancers`, se guarda `'{}'`. Si lo tiene, cada id debe ser un referidor **activo**, `kind = 'freelance'`,
   sin unir (`merged_into` nulo) y **de la sucursal**; si no, `invalid_input` con detalle `freelancers`. Al editar se
   aceptan además los que ya tenía la asignación (aunque hoy estén inactivos). Ausente al editar = se conservan.
4. `org_list` devuelve `uses_freelancers`, `freelancer_ids` y `freelancers` (`[{id, name}]` ordenado por nombre,
   también los inactivos).
5. `org_copy_day_v2` copia `freelancer_ids` dejando solo los freelancers que siguen activos y de la sucursal, y solo
   si el canal tiene `uses_freelancers`.
6. RPC nueva `org_add_freelancer(p_branch smallint, p_name text) returns jsonb` para quien gestiona la Organización de
   esa sucursal (`manages_org`): nombre limpio de 2 a 60 caracteres (si no, `invalid_input` detalle `name`); si ya hay
   un referidor de la sucursal con el mismo nombre normalizado (`referrer_key`) lo devuelve (`existed: true`), si no lo
   crea con `kind = 'freelance'`, `source = 'manager'` y `created_by` = quien llama. Devuelve `{id, existed}`.
   Sin permiso → `forbidden`.

### App
7. En «Nueva asignación» / editar, si el canal tiene `uses_freelancers`: debajo del conteo de la spec 033, un grupo
   **«Freelancers que van»** con una casilla por freelancer activo de la sucursal (y los que ya tenía la asignación,
   marcados «(inactivo)»), y **«+ Agregar freelancer»** (escribe el nombre → `org_add_freelancer` → aparece marcado).
   Sin freelancers: el aviso de la spec 033 y el botón para agregar.
8. Las casillas son opcionales (se puede guardar sin marcar ninguno).
9. La tabla de la Planificación muestra «Freelancers: Ana, Luis» como hoy «Volanteras: …»; el Excel suma la columna
   **«Freelancers»**.

## Fuera de alcance
- Resultados por freelancer.

## Pruebas
- `supabase/tests/freelancers_assignment_test.sql` (criterios 1 a 6).
- `tests/e2e/organization-freelancers.spec.ts` (criterios 7 y 9; se amplía la de la 033).
