# Research: La encargada edita la planificación de hoy

## R1. Dónde vive la regla

- **Decision**: cambiar solo `public.org_can_replan(p_branch smallint, p_day date)`.
- **Rationale**: es el único punto de control por fecha. La usan `org_save` (versiones de 20261117000200,
  000400, 20261118000100, 002100, 20261119000100, 000200, 20261121000100), `org_delete` y `org_list` (campo
  `can_replan`). Redefinirla con `create or replace` actualiza todo de una vez.
- **Alternatives considered**: tocar cada `org_save`/`org_delete` (repetitivo y propenso a olvidos); mostrar el botón
  solo en la pantalla (viola la constitución IV: el servidor seguiría rechazando).

## R2. Nueva condición

- **Decision**:
  ```sql
  select public.manages_org(p_branch) and (
    public.app_role() in ('general_manager', 'admin', 'sales_lead')
    or p_day >= (now() at time zone 'America/La_Paz')::date
  )
  ```
- **Rationale**: `manages_org` ya cubre encargada de la sucursal y supervisor de campo de la sucursal (además de
  gerencia/jefe). Pasar de `>` a `>=` incluye hoy y deja fuera solo los días anteriores. La fecha de Bolivia evita que
  el día «cambie» a las 20:00 (UTC−4).
- **Alternatives considered**: permitir hasta N días atrás (no lo pidieron; abre la puerta a alterar reportes
  cerrados).

## R3. Firma y permisos de ejecución

- **Decision**: mantener la misma firma y `security definer set search_path = ''`; repetir el `revoke`/`grant` de la
  migración original.
- **Rationale**: `create or replace` conserva los grants, pero repetirlos deja la migración autoexplicativa y segura si
  se aplica sola.

## R4. Tests

- **Decision (pgTAP)**: en `supabase/tests/org_assignments_test.sql`, invertir los 4 asserts del encargado/supervisor
  sobre «hoy» (meta, eliminar, `can_replan`) y agregar una asignación de **ayer** creada por el gerente para probar que
  encargada y supervisor siguen bloqueados en días pasados (editar, eliminar y `can_replan = false`) mientras el
  resultado sí se registra. Ajustar `plan(N)`.
- **Decision (Playwright)**: test nuevo `tests/e2e/planning-same-day.spec.ts` con `enc.trinidad`: crea una asignación
  hoy, la edita (meta) y la quita; luego verifica que en el día anterior no hay «Editar» ni «✕» en filas del encargado.
- **Rationale**: archivo e2e nuevo para no mezclar con los flujos de la spec 003/004 y poder correrlo solo.
- **Alternatives considered**: agregar el caso dentro de `organization.spec.ts` (archivo ya largo, 300+ líneas).

## R5. Datos de «ayer» en e2e

- **Decision**: el test e2e no crea filas en días pasados (la encargada no puede). Navega con «Día anterior» y
  verifica que **ninguna** fila tenga «Editar» ni «Quitar asignación de…». Si no hay filas, el assert sigue siendo
  válido (0 botones).
- **Rationale**: evita depender del seed; el límite de días pasados ya queda cubierto con datos reales en pgTAP.
