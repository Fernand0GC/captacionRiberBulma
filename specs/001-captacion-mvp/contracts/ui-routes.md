# Contract: Rutas y pantallas

Después del login, la redirección depende del rol: los roles de campo van a `/registrar`; encargado, gerente y admin, a `/gestion`.
Las rutas protegidas por rol también se protegen en la base (la UI no es la barrera de permisos).

| Ruta | Roles | Pantalla | Carga |
|---|---|---|---|
| `/login` | público | Usuario + contraseña | inicial |
| `/registrar` | campo, encargado | Canal de la jornada (se elige una vez), botón Registrar, contador del día, insignia de pendientes y avisos de duplicado | **inicial** (bundle mínimo, offline) |
| `/registrar/nuevo` | campo, encargado | Formulario: nombre y celular obligatorios; producto, interés (botones Alto/Medio/Bajo), actividad y dirección opcionales. Muestra el canal de la jornada. Guardar vuelve a `/registrar` | inicial |
| `/seguimiento` | aux, sup, encargado | Bandeja "mis asignados": hoy, vencidos y próximos | lazy |
| `/seguimiento/$id` | responsable asignado, gestores | Ficha de solo lectura de los datos + historial + registrar gestión + cambiar etapa | lazy |
| `/gestion` | encargado, jefe de ventas, gerente, admin | Listado con filtros en la URL (`?sucursal&desde&hasta&autor&canal&etapa&interes&asignado&vence&tras_baja`). `vence=hoy\|vencidos` (por `next_contact_at`) es la bandeja de toda la sucursal o de todas (FR-033); `tras_baja` muestra las captaciones subidas después de una baja (R9). La búsqueda por nombre o teléfono vive solo en el estado de la pantalla, nunca en la URL (constitución IV) · Vistas `ver=visitas`, `ver=seguimiento` (Seguimientos) y `ver=actividad` (Actividad por persona): ver `specs/002-monitoreo-seguimiento/contracts/ui-routes.md` | lazy |
| `/gestion/nuevo` | encargado, gerente, admin | Registrar desde gestión (con señal) | lazy |
| `/gestion/$id` | encargado, gerente, admin | Ficha: editar, asignar, gestiones, etapa, historial y auditoría; anular (solo admin) | lazy |
| `/gestion/sin-asignar` | encargado, gerente, admin | Prospectos sin responsable, con asignación masiva | lazy |
| `/gestion/duplicados` | encargado, gerente, admin | Captaciones rechazadas por duplicado | lazy |
| `/agenda` | encargado, gerente, admin | Agenda por sucursal, fecha y turno; crear, editar, copiar y cerrar con resultado | lazy |
| `/metas` | encargado (ver), gerente, admin | Metas del mes por sucursal × línea y avance | lazy |
| `/exportar` | encargado, gerente, admin | Rango de fechas + sucursales → descarga .xlsx | lazy (ExcelJS se carga al exportar) |
| `/admin/usuarios` | admin | Alta, edición, baja y reactivación, reseteo de contraseña | lazy |
| `/admin/catalogos` | admin | Canales, productos (con línea), motivos, estrategias, corte de turno | lazy |

Requisitos de UI de campo: botones de 48 px como mínimo, teclado numérico para el teléfono, selectores con
opciones grandes, una sola columna, sin scroll horizontal desde 360 px de ancho, y textos en español (Bolivia).

> Rutas de la planificación (`/planificacion`, `/planificacion/historial`) y del catálogo (`/admin/catalogo`): ver
> `specs/003-organizacion-comercial/contracts/ui-routes.md`.
