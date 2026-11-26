# Spec 029 · Permisos por persona para la encargada

**Estado**: En producción (2026-11-26). QA del PO aprobada. Migración aplicada y verificada en producción (`RB-union/migraciones-029-produccion.sql` = `20261126000100_profile_permissions.sql`), después de la corrección de auditoría de la 027 (`RB-union/migraciones-027b-produccion.sql` = `20261125000200`). Revisión previa: `RB-union/precheck-029-produccion.sql` (funciones reemplazadas sin cambios a mano).

## Por qué
Directriz de gerencia (26/11): las encargadas de sucursal deben ir asumiendo la planificación que hoy arman las jefas
de ventas. El traspaso es gradual: se les da más permiso de a poco, persona por persona, sin que cada paso sea una
tarea de programación.

## Decisiones (aprobadas por el PO, 2026-11-26)
1. **Enfoque A**: los roles siguen fijos. Se agregan permisos extra que se prenden **por persona**. No se construye un
   sistema de perfiles configurables (reescribiría ~150 verificaciones de permisos en la base).
2. Primera entrega, dos permisos (la brecha Encargado → Jefe de ventas):
   - `replan_past` · **Planificar días pasados**: editar y quitar asignaciones de cualquier día de su sucursal.
   - `referrals` · **Referidos**: el módulo completo (Reporte, Cargar, Seguimiento, Referidores), solo de su sucursal.
3. «Figurar como gerente a cargo» (`branch_lead`) queda **fuera** de esta entrega.
4. Solo se otorgan a **Encargados** (`branch_manager`). El Supervisor se suma después con el mismo mecanismo.
5. Quien puede otorgar también puede quitar, con las mismas reglas.
6. Otorgan: **Sistemas** y **Gerente** a cualquier encargada; **Jefe de ventas** solo a encargadas de sus sucursales
   (la jefa tiene ambos permisos por su rol).
7. **Sistemas actuando como otra persona** («Actuar como», spec 027) otorga y quita **sin restricciones**, como
   Sistemas. La auditoría guarda al admin real en `acting_by`.
8. La encargada con permisos sigue limitada a **su sucursal**: los permisos nunca amplían el alcance.

## Qué cambia
- Tabla `profile_permissions` (persona + permiso + quién y cuándo). Se escribe solo por RPC; cada uno lee las suyas.
- `has_permission(p)`: vale solo si la persona está activa **y sigue siendo encargada** (un cambio de rol los apaga).
- `permission_set(persona, permiso, on)`: otorga o quita, idempotente, con auditoría en `audit_log`.
- `permissions_list(sucursal)`: las encargadas que la persona puede gestionar, con sus permisos.
- `org_can_replan`: días pasados también con `replan_past`. `can_see_referrals` y `referral_branches`: la encargada
  con `referrals`, en su sucursal.
- App: el perfil trae sus permisos; «Referidos» se muestra por rol **o** permiso; pantalla nueva «Permisos»
  (`/permisos`) para Sistemas, Gerente y Jefe de ventas, y para Sistemas actuando como otro.

## Criterios de aceptación
Otorgar y quitar
1. Sistemas o Gerente otorgan a una encargada activa de cualquier sucursal; queda con quién y cuándo, y en la auditoría.
2. La jefa de ventas otorga a la encargada de una de sus sucursales.
3. Quitar: deja de tener efecto en el servidor de inmediato y queda en la auditoría.
4. Otorgar dos veces no da error ni duplica.

Quién NO puede
5. La jefa no otorga a encargadas de sucursales ajenas; en su pantalla ni aparecen.
6. Encargado, Supervisor, Auxiliar, Volantero y Cobros no otorgan ni quitan (tampoco llamando al servidor) ni ven «Permisos».
7. Solo se otorga a Encargados.
8. Sistemas actuando como otra persona **sí** otorga y quita sin restricciones; queda `acting_by`.

Planificar días pasados
9. Sin permiso, igual que hoy: ayer no; hoy y días futuros sí.
10. Con permiso: edita y quita días pasados de su sucursal.
11. Nunca otra sucursal.

Referidos
12. Sin permiso, igual que hoy: no lo ve; por dirección o por el servidor, rechazado.
13. Con permiso: lo ve y lo usa solo con su sucursal, sin selector.
14. Otra sucursal o «todas»: rechazado.

Borde y error
15. Si la encargada cambia de rol, sus permisos dejan de tener efecto sin quitarlos.
16. Recién desplegado, sin permisos otorgados, nadie ve ni puede nada distinto.
17. Si falla el guardado, la casilla vuelve a su estado y se ve el error.
18. Jefe de ventas, Gerente y Sistemas siguen igual, sin necesitar permisos.

Correcciones de QA (revisión independiente, 2026-11-26; decididas por el PM)
19. Si la consulta de permisos falla (p. ej., la app se publicó antes que la migración), el perfil carga igual con
    permisos vacíos: nadie queda sin poder entrar.
20. Al cambiar el rol o la sucursal de una persona, o al darla de baja, sus permisos se borran solos (por cualquier
    vía: app, Edge Function o Studio) y queda en la auditoría. Volver a ser encargada no los revive.
21. Quitar un permiso funciona aunque la persona ya no sea encargada o esté inactiva (con el mismo alcance por sucursal).
22. La migración se puede aplicar dos veces sin error; «Deshacer» funciona copiado tal cual y dice que primero se
    revierte la app y después la base.
23. `anon` no tiene ningún privilegio sobre `profile_permissions`; `authenticated` solo puede leer (sus filas, por RLS).
24. Mientras se guarda un permiso, todas las casillas quedan deshabilitadas; si falla, solo esa casilla vuelve.

## Pruebas
- `supabase/tests/permissions_baseline_test.sql`: caracterización (lo de hoy, antes del cambio).
- `supabase/tests/permissions_test.sql`: criterios 1–16 y 18 por rol.
- `tests/unit/access_baseline.test.ts`, `tests/unit/access.test.ts`, `tests/unit/permissions.test.ts`: menú y casilla.
- `supabase/tests/permissions_qa_test.sql`: criterios 20, 21 y 23. `tests/unit/permissions_qa.test.ts`: criterios 19 y 24.
- Criterio 22: QA aplica la migración dos veces dentro de una transacción que se deshace (ver `codex/paso-1.md`).

## Fuera de alcance
- `branch_lead` (gerente a cargo de la planificación) y permisos para el Supervisor.
- Perfiles configurables desde pantalla.
