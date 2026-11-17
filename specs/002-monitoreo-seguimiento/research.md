# Research: Monitoreo de seguimiento y actividad del personal

Sin NEEDS CLARIFICATION abiertos (resueltos en spec, sesión 2026-11-13). Decisiones de diseño:

## R1. ¿Tabla nueva o calcular al vuelo?

- **Decision**: calcular al vuelo en RPC desde `prospects` + `followups`.
- **Rationale**: principio III (reportes desde eventos, sin contadores sueltos). Índices ya existentes: `followups_prospect_idx (prospect_id, contacted_at desc)` para último contacto y conteo por cliente; `followups_actor_idx (actor_id, contacted_at)` para Actividad. Volumen esperado (miles por sucursal) cabe sin problema.
- **Alternatives**: columnas denormalizadas `last_contacted_at`/`contacts_count` en `prospects` (más rápido pero contador mantenido a mano, viola III); vista materializada (refresco y complejidad sin necesidad).

## R2. Alcance por rol

- **Decision**: `public.scoped_branch(f.branch_id)` como en `list_prospects` y `dashboard_metrics`.
- **Rationale**: ya resuelve encargado (la suya; otra = `forbidden`), jefe de ventas (una de `profile_branches`; sin elegir = la primera), gerente/Sistemas (la pedida o todas). Probado en `sales_lead_test.sql`.
- **Alternatives**: RLS directa con consultas desde el cliente (expondría tablas y haría N consultas).

## R3. Tres RPC separadas

- **Decision**: `list_followup_status` (Seguimientos, paginada, con conteo por pestaña), `agent_activity` (Actividad, una fila por persona), `list_agent_contacts` (detalle, paginada).
- **Rationale**: cada una con una forma de salida estable y su propio test; la de detalle se pide solo al tocar.
- **Alternatives**: extender `list_prospects` (ya tiene muchos modos; mezclar orden y columnas nuevas complica sus tests); una sola RPC "monitoring" con modo (contrato difuso).

## R4. Reutilizar la tabla `by_agent` de `dashboard_metrics`

- **Decision**: no reutilizar; `agent_activity` es nueva. El Panel no cambia.
- **Rationale**: `by_agent` filtra contactos por fecha pero no lista personas en cero, no desglosa por forma ni da ids para el detalle. Cambiar su forma rompería el Panel y `metrics_test.sql`.
- **Alternatives**: ampliar `by_agent` y apuntar el Panel a la nueva (más cambio sin valor ahora).

## R5. Definiciones de los valores

| Valor | Definición |
|-------|-----------|
| Último contacto | `followups` más reciente del cliente por `contacted_at` (lateral `limit 1`). |
| Última observación | `note` de ese contacto; si es nula, la pantalla muestra el resultado (edge case de la spec). |
| No contestó seguidos | `prospects.contact_attempts` (0–3). |
| Contactos totales | `count(*)` de `followups` del cliente. |
| Próximo contacto | `prospects.next_contact_at` (ya incluye la visita pactada: `add_followup` la copia ahí; se anula al cerrar en venta o sin interés). |
| Vencido | `stage not in ('sale','lost') and next_contact_at < now()`. |
| Días sin contacto | `fecha La Paz de hoy − fecha La Paz de coalesce(último contacto, client_created_at)`. |
| Efectivo | `followups.effective` (= resultado ≠ `no_answer`, lo fija `add_followup`). |
| Llamadas | `method in ('call','whatsapp_call')`. |
| Mensajes / En tienda | `method = 'message'` / `'store'`. |
| No contestó / Visitas pactadas / Ventas | `result = 'no_answer'` / `'visit_store'` / `'sold'`. |
| Clientes contactados | `count(distinct prospect_id)`. |

## R6. Orden por defecto de Seguimientos

- **Decision**: `vencido desc, next_contact_at asc solo entre vencidos (más atrasado arriba), días sin contacto desc, client_created_at, id`.
- **Rationale**: FR-015; el `id` final hace la paginación determinista.

## R7. Pestañas y conteos

- **Decision**: la RPC devuelve `by_tab` calculado sobre todos los filtros **menos** la pestaña, y `rows`/`total` con la pestaña aplicada. Pestañas: `sin_contactar`=`capture`, `seguimiento`=`followup`+`recapture`, `potencial`=`interested`, `venta`=`sale`, `sin_interes`=`lost`, `todos`.
- **Rationale**: mismo patrón que `by_channel` en `list_prospects`; garantiza SC-004 (suma = Todos) en una sola consulta.

## R8. Quién aparece en Actividad

- **Decision**: unión de (a) perfiles activos con rol `field_assistant` o `field_supervisor` cuya `branch_id` está en el alcance, y (b) cualquier `actor_id` con contactos en el período sobre clientes del alcance. Se devuelve `role` y `active` para marcar inactivos.
- **Rationale**: clarificación Q3 (opción C). Los contactos se filtran por la sucursal **del cliente**, no del actor (un jefe de ventas puede contactar en varias).

## R9. Detalle del cliente

- **Decision**: tocar un cliente en Seguimientos o en el detalle de Actividad navega a `/cliente/$id` (ficha con Historial). El resumen por persona se calcula en el cliente agrupando los items `type: 'contact'` del `timeline` por `actor` y `method`.
- **Rationale**: la ficha ya tiene el historial completo y los permisos; no hace falta RPC nueva. Volver con "atrás" conserva filtros porque están en la URL.
- **Alternatives**: abrir el `ResultDialog` (es para registrar un contacto, no muestra historial); agregar `by_actor` a `get_prospect` (cambio de contrato innecesario). Riesgo menor: dos personas con el mismo nombre se agruparían juntas; aceptable (los nombres de personal son únicos en la práctica).

## R10. UI responsive

- **Decision**: Seguimientos: `<table>` en `md:` y lista de tarjetas en celular (mismo patrón que la tabla compacta actual). Actividad: tabla con `position: sticky; left: 0` en la columna nombre y contenedor `overflow-x-auto`; fila de totales con `sticky bottom` dentro del contenedor. Orden por columna en el cliente (filas pocas).
- **Rationale**: sin librerías de tablas (presupuesto II).

## R11. Excel

- **Decision**: dos exportadores nuevos en `src/features/monitoring/`, con `import('exceljs')` dinámico como `exportProspects.ts`; Seguimientos pagina de a 200 hasta completar; Actividad usa la misma respuesta de la pantalla. Formato en `contracts/excel-export.md`.

## R12. Parámetros de la URL

- **Decision**: extender `validateManageSearch` con `ver: 'visitas'|'seguimiento'|'actividad'`, `estado`, `interes`, `intentos`, `vencidos`, `sin_contacto`, `motivo`, `persona`, `metrica`, `orden`. Valores fuera de lista se descartan (no rompen la pantalla). `persona` es id de personal (no dato personal de cliente, como el `autor` actual).

## R13. Migración y entorno

- **Decision**: dos migraciones (`20261114000100_followup_status.sql` para US1 y `20261114000200_agent_activity.sql` para US2/US3, para entregar por historia), aplicada localmente con `supabase migration up` (nunca `db reset`, CLAUDE.md). Producción solo con autorización explícita del usuario.
