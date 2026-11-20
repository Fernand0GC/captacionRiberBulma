# riber-captacion

App PWA de captación de clientes (volanteros → seguimiento → venta). Proyecto separado de riber-bulma-app:
otra BD (Supabase nuevo), otro deploy.

- Principios: `.specify/memory/constitution.md` (manda por encima de todo).
- Definición y alcance: `docs/proyecto.md`.
- Features: `specs/001-captacion-mvp/` (MVP), `specs/002-monitoreo-seguimiento/` (vistas Seguimientos y Actividad en `/gestion`), `specs/003-organizacion-comercial/` (la Planificación pasa a asignaciones con catálogo Estrategia → Canal → Subcanal; reemplaza la US4 de la 001) , `specs/004-ajustes-organizacion-ventas/` (metas de captación y compartidas por subcanal, selección múltiple de subcanales y «+ Agregar otro…») y `specs/005-referidos/` (activa: origen del referido al registrar, referidores con meta mensual y reporte `/referidos` solo para jefes; Recompra/Nuevos y duplicados quedan para una spec futura de Recompra) y `specs/006-ajustes-ventas-2/` (observaciones del grupo de ventas, volanteras, verificación de compartidas por Cobros) y `specs/007-ajustes-ventas-3/` (copia de días sin duplicados, error visible al guardar, aviso de cruce con nombre, meta de compartidas opcional, tabla compacta y filtro Turno por la tarde) y `specs/008-subcanal-horario-obligatorio/` (subcanal obligatorio si el canal tiene subcanales, subcanal único marcado solo, horario obligatorio) y `specs/009-reporte-del-dia/` (activa: vista «Del día» en /gestion con registros nuevos, promedios y clientes con seguimiento, filtro de referidos; tarjeta en el Panel; RPC daily_report).
- Flujo SDD: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`. Features en `specs/NNN-nombre/`.

## Reglas
- Git (commit/branch/push/merge) lo ejecuta el usuario; solo proponer los comandos.
- No tocar bases de riber-bulma (Firebase/Supabase) ni su repo desde acá.
- No aplicar migraciones ni deploy en el Supabase de producción sin autorización explícita.
- Base local: **nunca `supabase db reset` sin preguntar** (el usuario edita catálogos en Studio y el reset los pisa). Limpiar datos de prueba con `pnpm db:clean`; aplicar migraciones nuevas con `supabase migration up`. Los catálogos reales van en migraciones, no en `seed.sql`.
- Código y BD en inglés; UI en español.
- Antes de agregar una dependencia, justificar su peso (presupuesto: ≤170 KB gzip de JS inicial).
