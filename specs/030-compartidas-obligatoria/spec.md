# Spec 030 · Meta de compartidas obligatoria

Estado: en producción (2026-11-27: migración 20261127000100 aplicada y registrada; app en el commit 7cc16ac). Origen: observaciones 1, 3, 4 y 5 de ventas («APP - CAPTACION»).

## Problema

Ventas reporta que «Barrios chinos», «Mensajería WhatsApp», «Compartidas WhatsApp», «Estados de colegas» e
«Historias de Facebook y TikTok» «no tienen meta de compartidas».

Diagnóstico en producción (2026-11-27, `RB-union/diagnostico-catalogo-metas.sql`): el catálogo está bien. Todos esos
subcanales piden meta de compartidas (`uses_share_goal = true`). Pero desde la spec 007 (FR-011) esa meta es
**opcional**, así que muchas asignaciones quedaron sin ella:

| Subcanal | Asignaciones | Con meta de compartidas |
|---|---|---|
| Mensajería WhatsApp | 165 | 77 |
| Barrios chinos - grupos | 36 | 22 |
| BARRIO CHINO | 92 | 64 |
| Compartidas WhatsApp | 110 | 86 |
| Compartidas redes sociales | 100 | 78 |
| ESTADOS DE COLEGAS | 65 | 54 |
| HISTORIAS DE FACEBOOK Y TIK TOK | 5 | 3 |

Decisión del usuario (2026-11-27): **volver obligatoria** la meta de compartidas. Reemplaza la FR-011 de la spec 007.

## Criterios de aceptación

1. **Base (`org_upsert`, usada por `org_save` y `org_save_many`)**: si la marca efectiva del subcanal (o del canal sin
   subcanal) pide compartidas y `share_goal` llega vacío, rechaza con `invalid_input` y detalle `share_goal`. Igual que
   la meta de captación.
2. Si la marca no pide compartidas, la meta que llegue se sigue guardando vacía (sin cambio).
3. Un subcanal que pide las dos metas (Mensajería WhatsApp, Barrios chinos) exige las dos.
4. En la carga múltiple, si falta la de un subcanal, no se guarda ninguno (todo o nada, como hoy).
5. **App (formulario de asignación)**: el campo «Meta de compartidas» deja de decir «(opcional)» y se marca obligatorio.
   Al guardar sin escribirla sale «Escribe la meta de compartidas.» (o «… de «<subcanal>».» en la carga múltiple) y el
   foco va a ese campo, igual que con la de captación.
6. Rango sin cambio: entero de 0 a 9999. El 0 es válido.
7. **Editar una asignación vieja** que quedó sin meta de compartidas obliga a escribirla para guardar.
8. **«Copiar día» no cambia**: copia la meta tal como estaba en el origen, aunque esté vacía. Si no, no se podría copiar
   un día que tiene asignaciones viejas sin meta. La persona la completa al editar.
9. Registrar el resultado (`org_set_result`) no cambia.

## Fuera de alcance

- Completar las metas que faltan en asignaciones pasadas.
- Una meta general de compartidas por sucursal o día (ver observación 9, pendiente de aclarar con ventas).

## Pruebas

- `supabase/tests/share_goal_required_test.sql` (criterios 1 a 4, 6 y 8).
- `supabase/tests/ajustes_ventas_3_test.sql`: el caso «sin meta de compartidas se guarda» pasa a «se rechaza».
- `tests/e2e/organization.spec.ts`: la carga múltiple pide la meta de compartidas (criterio 5).
