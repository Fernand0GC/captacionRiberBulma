# Spec 032 · Cierre del día: resultados del día y planificar con resultados

Estado: en producción (2026-11-27; rige desde esa fecha). Origen: observaciones 7 y 8 de ventas («APP - CAPTACION»):
- 7 «ORGANIZACIÓN: No poder mover el resultado pasada las 12:00 de la noche.»
- 8 «PLANIFICACIÓN: Que no te deje crear una nueva organización, si no colocas los resultados.»

## Decisiones del usuario (2026-11-27)

- Obs. 7: «en el día sí pueden editar, pero pasado el día no; solo las jefas para arriba». Es la misma regla que ya
  tienen las asignaciones (`org_can_replan`, specs 018 y 029): **el mismo día**, quien gestiona la sucursal
  (encargado, supervisor); **días pasados**, solo jefe de ventas, gerente y Sistemas, o un encargado con el permiso
  `replan_past` dado desde `/permisos`.
- Obs. 8: bloquea por **sucursal**, mirando el **último día trabajado**; jefe de ventas, gerente y Sistemas no se bloquean.
- Si la encargada se olvidó de cargar los resultados de ayer, se destraba pidiéndoselo a una jefa (que sí puede cargarlos).

## Criterios de aceptación

### Obs. 7 · Resultados solo el mismo día
1. `org_set_result` (las dos versiones, de 3 y 4 argumentos) rechaza con `forbidden` si quien llama no puede
   replanificar ese día: usa `org_can_replan(sucursal, día de la asignación)` en lugar de `manages_org`.
2. Encargado y supervisor: cargan resultados del día de hoy; de un día pasado, no.
3. Jefe de ventas (en sus sucursales), gerente y Sistemas: cargan resultados de cualquier día.
4. Encargado con el permiso `replan_past`: también días pasados.
5. `org_list` devuelve `can_set_result = org_can_replan(sucursal, día)`; así el botón «Resultado» no aparece en días
   pasados para quien no puede.
6. La verificación de compartidas de Cobros (`org_verify_shares`) no cambia.
7. En `/permisos`, el permiso «Planificar días pasados» explica que incluye los resultados.

### Obs. 8 · No planificar un día nuevo sin los resultados del último día trabajado
8. Al **crear** asignaciones (`org_save` y `org_save_many`, vía `org_upsert` sin `id`) para el día D en la sucursal S,
   y al **copiar un día** (`org_copy_day_v2` y `org_copy_day`) hacia el día D:
   - L = el último día con asignaciones en S que sea **anterior a D y no posterior a hoy** (días futuros no pueden
     tener resultados todavía).
   - Pendientes = asignaciones de S en L con `goal` escrito y `result` vacío, o con `share_goal` escrito y
     `share_result` vacío. Las que no tienen meta no cuentan.
   - Si hay pendientes, rechaza con `results_pending` y detalle `«L»|«cantidad»` (p. ej. `2026-11-26|3`).
9. Si no hay día L (sucursal sin historia), no bloquea.
10. Solo mira el último día trabajado: pendientes de días más viejos no bloquean.
11. **Editar** una asignación que ya existe no se bloquea.
12. Jefe de ventas, gerente y Sistemas no se bloquean (pueden planificar aunque falten resultados).
13. App: el error se muestra como «Faltan resultados del dd/mm (N asignaciones). Cárgalos antes de planificar un día
    nuevo.» (en el formulario y al copiar el día).

### Desde cuándo rige (decisión del usuario, 2026-11-27: «que no bloquees los días anteriores y la regla sea desde hoy»)
14. Las dos reglas rigen desde una **fecha de inicio** que da `public.org_day_close_since()` (`2026-11-27`), en un
    solo lugar para poder moverla.
15. Obs. 7: un día **anterior** a la fecha de inicio sigue como antes (quien gestiona la sucursal carga su resultado).
    Desde la fecha de inicio aplica el criterio 1. Igual para `can_set_result` en `org_list`.
16. Obs. 8: L solo se busca entre días **desde** la fecha de inicio; pendientes de días anteriores no bloquean.

## Fuera de alcance

- Cerrar el día con un botón o un estado «cerrado».
- Avisos automáticos a las jefas de resultados atrasados.

## Nota de QA (2026-11-27)

Las e2e que crean asignaciones como encargada (organization 7/138/352/467, planning-same-day 7, verify-shares 18) se
bloquean en la base local con «Faltan resultados…» porque la local acumula asignaciones viejas sin resultado: es la
regla funcionando. Con la regla apagada temporalmente pasan las 6. Pendiente: aislar los datos de las e2e
(limpiar `org_assignments` de prueba o cargar resultados en el arranque).

## Pruebas

- `supabase/tests/day_close_test.sql` (criterios 1 a 5 y 8 a 12).
- `tests/unit/organization.test.ts`: mensaje de `results_pending` (criterio 13).
