# Research: Organización comercial por sucursal

Decisiones técnicas tomadas a partir del código actual (`main` en `bf39758`) y de la spec. No quedó ningún
`NEEDS CLARIFICATION` en el contexto técnico.

## R1. Tablas nuevas en vez de ampliar `agenda_activities`

- **Decision**: Crear `org_strategies`, `org_channels`, `org_subchannels` y `org_assignments`. `agenda_activities` y `agenda_strategies` quedan como historial de solo lectura.
- **Rationale**: Una asignación exige persona real, estrategia y canal del catálogo nuevo; una actividad antigua exige descripción libre y no tiene nada de eso. Meter las dos formas en una tabla obliga a volver opcionales columnas que deben ser obligatorias y a llenar de casos especiales las funciones. La spec (FR-017) ya pide que lo antiguo quede solo como historial.
- **Alternatives considered**: (a) Agregar columnas a `agenda_activities`: se descartó por lo anterior. (b) Migrar las actividades antiguas a asignaciones: no se puede, porque «responsables» es texto libre y no hay persona ni subcanal que asignar.

## R2. Catálogo de tres niveles con llaves compuestas

- **Decision**: `org_channels` lleva `strategy_id` y `org_subchannels` lleva `channel_id`. `org_assignments` guarda los tres ids y los valida con llaves foráneas compuestas (`(channel_id, strategy_id)` y `(subchannel_id, channel_id)`).
- **Rationale**: La base rechaza por sí sola una combinación que no existe (FR-010, SC-002), sin depender de que cada función lo verifique.
- **Alternatives considered**: Guardar solo `subchannel_id` y derivar lo demás: no sirve, porque el subcanal es opcional (FR-009). Una sola tabla con `parent_id`: permite niveles mal armados y complica las consultas.

## R3. Horarios sugeridos como columnas del subcanal

- **Decision**: Cuatro columnas `time` opcionales en `org_subchannels`: `morning_start`, `morning_end`, `afternoon_start`, `afternoon_end`, con una restricción por par (los dos o ninguno, fin mayor que inicio).
- **Rationale**: Solo hay dos turnos y son fijos (enum `shift`). Una tabla aparte de horarios no agrega nada.
- **Alternatives considered**: Tabla `org_subchannel_schedules (subchannel_id, shift, start, end)`: más flexible si hubiera más turnos, pero hoy es complejidad sin uso (YAGNI, constitución V).

## R4. El catálogo inicial va en una migración

- **Decision**: Las 2 estrategias, 10 canales y 34 subcanales con sus horarios se insertan en la migración, no en `seed.sql`.
- **Rationale**: Regla del proyecto: los catálogos reales van en migraciones para que lleguen a producción. Fuente: [insumos-excel.md](./insumos-excel.md).
- **Alternatives considered**: Cargarlos a mano desde la pantalla de catálogo: son 46 filas y 60 horarios; cargarlos a mano invita a errores.

## R5. Catálogo separado del de captaciones

- **Decision**: No se toca la tabla `channels` ni `prospects.channel_id`. Las asignaciones no guardan canal de captación.
- **Rationale**: Decisión del usuario (FR-006).
- **Consecuencia que hay que conocer**: la Planificación actual cuenta sola las captaciones de cada actividad (`activity_captures`), la da por cumplida o no al terminar su horario (`auto_status`) y le pasa el canal y el lugar a la pantalla Registrar (`currentActivity.ts`). Con asignaciones nuevas, resultado manual y catálogos separados, **esas tres cosas dejan de funcionar para lo que se planifique desde ahora**. Quedan solo en el historial.
- **Alternatives considered**: Agregar a cada subcanal un «canal de captación equivalente» opcional para conservar el conteo automático: es justo la unificación que el usuario pospuso; queda anotada como mejora posterior.

## R6. Gerente a cargo derivado de `profile_branches`, con copia en la asignación

- **Decision**: El gerente a cargo de una sucursal es el usuario activo con rol `sales_lead` que la tiene en `profile_branches`. Una función `branch_lead(branch)` lo devuelve; si hay más de uno, el primero por nombre. Al crear una asignación se copia su id en `lead_id`.
- **Rationale**: La relación ya existe y la administra la pantalla de Usuarios (FR-027). La copia cumple que las asignaciones pasadas conserven el gerente de ese día.
- **Alternatives considered**: Columna `branches.lead_id`: duplica una relación que ya existe. Restricción de un solo jefe por sucursal: cambiaría el comportamiento del rol actual, fuera de alcance.

## R7. Permisos con una función propia, sin tocar `manages_branch`

- **Decision**: Función nueva `manages_org(branch)` = `manages_branch(branch)` o (rol `field_supervisor` y su sucursal). Segunda función `org_can_replan(branch, day)`: verdadera siempre para gerencia general, Sistemas y el jefe de ventas de la sucursal; para encargado y supervisor, solo si el día es posterior a hoy (hora de La Paz).
- **Rationale**: `manages_branch` se usa en captaciones, reparto y metas; ampliarla le daría al supervisor permisos que nadie pidió. El límite de FR-029 queda en un solo lugar.
- **Alternatives considered**: Ampliar `manages_branch`: demasiado alcance. Verificar el límite solo en la pantalla: viola la constitución IV (la base es la barrera).
- **Detalle**: crear una asignación el mismo día está permitido a encargado y supervisor (caso límite de la spec); editar meta, persona, horario o catálogo de una asignación de hoy o pasada, no.

## R8. Acceso solo por funciones `security definer`

- **Decision**: `org_assignments` con RLS activado y sin permisos directos; todo pasa por RPC (`org_list`, `org_save`, `org_set_result`, `org_delete`, `org_copy_day`, `org_staff`). El catálogo se lee por RLS (cualquier usuario activo) y lo escribe solo Sistemas por política, igual que `channels`.
- **Rationale**: Es el patrón de toda la app (`agenda_day`, `save_activity`). La regla de qué ve cada rol (auxiliar: solo lo suyo; volantera: nada) queda en `org_list`.
- **Alternatives considered**: Políticas RLS por rol sobre la tabla: la regla del auxiliar y el límite por fecha son más claros y más fáciles de probar dentro de una función.

## R9. Filtros y totales en el navegador

- **Decision**: `org_list(desde, hasta, sucursales)` devuelve las filas del rango (máximo 31 días). Los filtros por columna y los totales se calculan en el navegador con funciones puras.
- **Rationale**: Volumen pequeño: 10 sucursales × unas 30 filas por día × 31 días ≈ 9 000 filas en el peor caso, y lo normal es una sucursal y una semana (unas 200). Filtrar en el navegador da respuesta inmediata y la lógica se prueba con Vitest (SC-005).
- **Alternatives considered**: Filtros en el servidor: una consulta por cada cambio de filtro y totales duplicados en SQL, sin beneficio a este volumen.

## R10. Cruce de horarios como aviso en la pantalla

- **Decision**: El aviso de FR-015 se calcula en el navegador con las filas ya cargadas de esa sucursal y ese día.
- **Rationale**: Es un aviso, no una regla; no bloquea guardar.
- **Alternatives considered**: Restricción de exclusión en la base: impediría guardar, y la spec pide lo contrario.

## R11. Auditoría

- **Decision**: Disparador `audit_row` existente sobre `org_assignments` para las ediciones. La creación queda en `created_by` y `created_at`. La eliminación la registra `org_delete` insertando en `audit_log` la fila borrada.
- **Rationale**: Reutiliza lo que ya hay (FR-020) sin tabla nueva.
- **Alternatives considered**: Borrado lógico: obliga a filtrar en todas las consultas por algo que se usa poco.

## R12. Pantallas

- **Decision**: Carpeta nueva `src/features/organization/`. La ruta `/planificacion` pasa a mostrar la tabla de asignaciones (tabla en pantallas anchas, tarjetas en celular) con rango de fechas, sucursales, filtros, totales y exportación. El historial antiguo queda en `/planificacion/historial` reutilizando `PlanningPage` en solo lectura. El catálogo se administra en `/admin/catalogo`.
- **Rationale**: Una sola pantalla sirve para cargar el día (rango = un día) y para consultar (rango amplio). Todo con carga diferida para no sumar al JS inicial (constitución II).
- **Alternatives considered**: Pantalla de carga y pantalla de consulta separadas: duplican la lista y los filtros.

## R13. Visibilidad por rol en el menú y en Registrar

- **Decision**: «Plan del día» sale del menú de la volantera; el auxiliar ve «Mi plan» (solo sus filas); el supervisor ve la Planificación completa. `RegisterHome` deja de consultar la actividad en curso.
- **Rationale**: FR-026. La actividad en curso depende de actividades antiguas que ya no se crean (R5), así que el aviso quedaría siempre vacío.
- **Alternatives considered**: Dejar el aviso de Registrar: código sin uso y una consulta inútil en la pantalla más sensible al peso.

## R14. Sin trabajo sin conexión

- **Decision**: Cargar y consultar la organización requiere conexión.
- **Rationale**: La constitución I exige offline para la escritura de campo (captaciones). Esto es gestión, igual que Metas o Repartir, que también requieren conexión.
- **Alternatives considered**: Guardar en la cola local: complejidad alta para una tarea que se hace en oficina.

## R15. Exportación

- **Decision**: `exportOrganization.ts` con `exceljs` cargado bajo demanda, mismas 14 columnas y orden de la planilla, más una fila de totales arriba.
- **Rationale**: `exceljs` ya es dependencia y ya se carga así en las otras exportaciones; no entra ninguna dependencia nueva.

## R16. Lo que no se hace en esta feature

- No se renombra la sucursal Santa Cruz: las hojas de la planilla dicen solo «Santa Cruz».
- No se crean por migración los 4 gerentes ni las 27 personas: los usuarios se crean desde la pantalla Usuarios (pasan por Auth). Queda como paso de puesta en marcha en [quickstart.md](./quickstart.md).
- No se resuelven las 4 funciones de monitoreo que faltan en `main`; son de otra feature.
