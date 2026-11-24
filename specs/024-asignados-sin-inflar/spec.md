# Feature Specification: «Asignados» sin inflar y etapa en que lo dejó

**Feature Branch**: `024-asignados-sin-inflar`
**Created**: 2026-11-24
**Status**: Implementada (local), pendiente de producción
**Input**: Observación de ventas sobre el modal «Clientes asignados» de Actividad: «si se asigna a otro, se debería
quitar; no quieren que se le infle». Reemplaza FR-011 y SC-004 de la spec 020.

## Contexto

Cada cliente avanza por etapas (Captación → Recaptación → Seguimiento → Cliente potencial → Venta) y la encargada lo
pasa de una persona a otra según la etapa (a mano, con `assign_prospects`). Pasar al cliente es lo normal del flujo.
Antes, todo cliente que alguna vez se le asignó a una persona en el período le contaba en «Asignados», aunque nunca lo
contactara y hoy lo tenga otra persona. Además, «A qué proceso pasaron» usaba la etapa de HOY, así que la venta que
cerró la última persona del flujo aparecía también en quienes hicieron la captación y el seguimiento.

## Decisiones (aprobadas por el PO, 2026-11-24)

1. Un cliente que ya no está a cargo de la persona (pasó a otra o quedó sin responsable) y que ella **nunca contactó**
   desde que se le asignó **no cuenta** en sus «Asignados» (modal y Actividad). Se muestra en una nota gris
   «N reasignados sin contactar», que al tocarla lista esos clientes.
2. Si lo contactó, sigue contando aunque haya pasado a otra persona (hizo su parte del flujo).
3. El total de la sucursal sigue siendo la suma de las personas (un cliente trabajado por 3 personas cuenta 3 veces:
   mide traspasos de trabajo, no clientes únicos).
4. «A qué proceso pasaron» usa la etapa en que la persona **dejó** al cliente (`stage_left`): la de hoy si sigue a su
   cargo; si no, la última etapa al momento del primer traspaso desde ella.
5. El resumen del modal lo calcula el servidor sobre todo el período (antes se sumaban las primeras 500 filas).
6. Los números de períodos pasados se recalculan con la regla nueva (no hay foto mensual).

## Criterios de aceptación

1. **Dado** un cliente de Nayara que ella no contactó, **cuando** se reasigna a Ana, **entonces** en Nayara bajan
   «Asignados» y «Sin contactar» en 1 y la nota gris suma 1.
2. **Dado** un cliente que Nayara sí contactó, **cuando** se reasigna, **entonces** sus números no cambian.
3. **Dado** el caso 1, el cliente cuenta en «Asignados» de Ana.
4. La fila de Nayara en Actividad coincide con el modal; el total de la sucursal es la suma de las filas.
5. Nayara → Ana → Nayara sin contactos: cuenta a Nayara (lo tiene hoy), no a Ana.
6. La nota gris lista los reasignados sin contactar con «Reasignado a …», sin sumarlos a las tarjetas.
7. Una auxiliar no puede leer «Clientes asignados» (forbidden); el encargado de otra sucursal no ve nada.
8. Si la reasignación falla, no cambia ningún número y se ve el aviso de error existente.
9. Tests: pgTAP `supabase/tests/assigned_reassigned_test.sql`, unitarios `tests/unit/assigned.test.ts`,
   Playwright «020 clientes asignados» en `tests/e2e/monitoring.spec.ts`.
10. **Dado** que Nayara deja un cliente en Seguimiento y luego otra persona lo lleva a Venta, en Nayara cuenta como
    Seguimiento (y la fila muestra «hoy: Venta»).

## Cambios

- Migración `20261124000200_assigned_reassigned_uncounted.sql`: reemplaza `list_agent_assigned` (suma `counted`,
  `stage_left`, `outcome` por fila; `reassigned_uncontacted` y `summary` en la respuesta) y parcha `agent_activity`
  (filtro «024» en `asg`).
- `src/features/monitoring/`: `api.ts` (tipos), `assigned.ts` (`toSummary`, `reassignedOnly`), `AssignedPanel.tsx`
  (nota gris, etapa en que lo dejó, «hoy: …»), `AgentContactsDialog.tsx`, `exportActivity.ts` (columnas
  «Etapa en que lo dejó» y «Cuenta en asignados»).

## Pendientes para conversar con ventas

- ¿La venta se acredita solo a quien la cerró o también hay un reconocimiento para quien captó?
- ¿Total de sucursal como traspasos (hoy) o como clientes únicos?
- ¿Hay una regla fija de cuándo se pasa el cliente a la siguiente persona? (el sistema podría sugerirlo o avisar estancados)
- ¿Cuánto tiempo puede tener alguien un cliente sin contactar antes de que se lo pasen?
- ¿Una columna «Reasignados sin contactar» en la tabla Actividad para comparar entre personas?
- Solo cuentan los contactos de la misma persona y desde la asignación: ¿vale también un contacto previo o de la encargada?
- El Excel de «Clientes asignados» sigue trayendo como mucho 500 filas (ahora primero las que cuentan).
