# Implementation Plan: «Acomodo de tienda» como canal propio de Tienda

**Branch**: `019-acomodo-tienda-canal` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/019-acomodo-tienda-canal/spec.md`

## Summary

Una sola migración SQL crea (o reutiliza) el canal Tienda → «Acomodo de tienda», mueve a ese canal todas las
asignaciones que usan un subcanal con ese nombre normalizado (cambia solo estrategia, canal y subcanal) y desactiva
los subcanales viejos. La lógica vive en una función interna `org_subchannel_to_channel(nombre, estrategia)`, que la
migración llama una vez y que los tests pgTAP vuelven a llamar sobre datos de prueba, porque el subcanal real solo
existe en producción. Antes de aplicar, el usuario corre `diagnostico-produccion.sql` (solo lectura). No hay cambios
de pantallas: el canal aparece en la Planificación y el Catálogo por ser parte del catálogo.

## Technical Context

**Language/Version**: SQL (PostgreSQL 15 de Supabase, PL/pgSQL) · TypeScript strict solo en el test e2e

**Primary Dependencies**: ninguna nueva

**Storage**: Supabase Postgres — `org_strategies`, `org_channels`, `org_subchannels`, `org_assignments`, `audit_log`

**Testing**: pgTAP (`supabase test db`), Playwright (`tests/e2e/organization.spec.ts`)

**Target Platform**: Supabase local (pruebas) y producción (lo aplica el usuario)

**Project Type**: PWA web + backend Supabase

**Performance Goals**: la migración termina en segundos (pocas decenas o cientos de filas, según diagnóstico)

**Constraints**: idempotente; no falla si el subcanal no existe; una transacción; no borra nada; sin `db reset`

**Scale/Scope**: 1 migración, 1 test pgTAP nuevo, 1 test pgTAP ajustado (conteo de canales), 1 test e2e nuevo

## Constitution Check

| Principio | Cumple | Cómo |
|---|---|---|
| I. Campo primero | ✅ | No toca captura ni sync; la Planificación es de gestión y lee del servidor |
| II. Rápido en gama baja | ✅ | Cero JS nuevo |
| III. El embudo es la fuente de verdad | ✅ | No toca eventos del prospecto; los números de la asignación se conservan; el cambio queda en `audit_log` |
| IV. Seguridad en la BD | ✅ | La función es interna: sin `execute` para `anon`/`authenticated`; el catálogo sigue con su RLS |
| V. Simple y spec-driven | ✅ | Una migración; la función se justifica abajo (Complexity Tracking) |
| Migraciones versionadas, nada a mano en producción | ✅ | El cambio va en `supabase/migrations/`; el diagnóstico solo lee |

**Re-check post-diseño**: sin cambios; sigue cumpliendo.

## Project Structure

### Documentation (this feature)

```text
specs/019-acomodo-tienda-canal/
├── spec.md
├── diagnostico-produccion.sql   # solo lectura, lo corre el usuario en producción (antes y después)
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── migration.md             # contrato de org_subchannel_to_channel
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/20261123001900_acomodo_tienda_channel.sql   # NUEVO: función + llamada
└── tests/
    ├── acomodo_tienda_channel_test.sql                   # NUEVO: pgTAP de la migración
    └── org_catalog_test.sql                              # AJUSTE: 14 → 15 canales

tests/e2e/organization.spec.ts                            # NUEVO test (019) al final del archivo
```

**Structure Decision**: Solo base de datos y pruebas. No se toca `src/` ni nada de la spec 018 (`org_can_replan`,
`org_assignments_test.sql`, `specs/018-encargada-edita-hoy/`). El nombre de la migración usa `…001900` para no chocar
con una migración de la 018 del mismo día.

## Complexity Tracking

| Decisión | Por qué | Alternativa simple descartada |
|---|---|---|
| Función `org_subchannel_to_channel` que queda en la base | El subcanal solo existe en producción: sin la función, pgTAP no puede probar el movimiento (la migración corre una vez, sobre una base local sin el subcanal) | Bloque `do $$ … $$` anónimo: no se puede volver a ejecutar en el test; se probaría solo el caso vacío |
| Parámetros nombre/estrategia | Mismo costo que fijarlos; deja lista la conversión de CONTEO/garantías si otra spec la decide | Constantes fijas: igual de simple, pero obliga a otra función casi igual después |
