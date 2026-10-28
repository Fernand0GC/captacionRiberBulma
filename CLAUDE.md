# riber-captacion

App PWA de captación de clientes (volanteros → seguimiento → venta). Proyecto separado de riber-bulma-app:
otra BD (Supabase nuevo), otro deploy.

- Principios: `.specify/memory/constitution.md` (manda por encima de todo).
- Definición y alcance: `docs/proyecto.md`.
- Feature activa: `specs/001-captacion-mvp/` (spec, plan, research, data-model, contracts/, quickstart).
- Flujo SDD: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`. Features en `specs/NNN-nombre/`.

## Reglas
- Git (commit/branch/push/merge) lo ejecuta el usuario; solo proponer los comandos.
- No tocar bases de riber-bulma (Firebase/Supabase) ni su repo desde acá.
- No aplicar migraciones ni deploy en el Supabase de producción sin autorización explícita.
- Código y BD en inglés; UI en español.
- Antes de agregar una dependencia, justificar su peso (presupuesto: ≤170 KB gzip de JS inicial).
