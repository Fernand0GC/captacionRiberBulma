# Contract: Rutas y pantallas de la organización comercial

Las rutas protegidas por rol también se protegen en la base (la pantalla no es la barrera de permisos).
Todas cargan de forma diferida; ninguna entra en el JS inicial de `/registrar`.

| Ruta | Roles | Pantalla |
|---|---|---|
| `/planificacion` | supervisor, encargado, jefe de ventas, gerente, Sistemas | Organización: rango de fechas, sucursales, filtros por columna, totales, tabla de asignaciones, agregar, editar, registrar resultado, copiar día y exportar |
| `/planificacion` | auxiliar | «Mi plan»: solo sus asignaciones, sin acciones |
| `/planificacion/historial` | los mismos que hoy ven la Planificación, menos la volantera | Planificación anterior en solo lectura |
| `/admin/catalogo` | Sistemas | Estrategias, canales, subcanales y horarios sugeridos |

La volantera no tiene ninguna de estas rutas en el menú y, si escribe la dirección, vuelve a su inicio.

## Menú

| Entrada | Antes | Ahora |
|---|---|---|
| «Planificación» (menú de gestión) | encargado, jefe, gerente, Sistemas | igual, más el supervisor |
| «Plan del día» (menú de campo) | todos los roles | solo auxiliar, con el nombre «Mi plan» |
| «Catálogo» | no existía | Sistemas |

## Pantalla Organización

- **Rango**: por defecto, hoy. Máximo 31 días.
- **Sucursales**: encargado y supervisor ven la suya fija; jefe de ventas elige entre las suyas (por defecto, todas las suyas); gerente y Sistemas eligen entre todas.
- **Filtros**: gerente, sucursal, turno, persona, estrategia, canal y subcanal. Cada uno ofrece solo los valores presentes en las filas cargadas. Se combinan.
- **Totales**: meta, resultado y número de asignaciones de las filas visibles. Las filas sin resultado no suman resultado.
- **Tabla** (pantalla ancha): las 14 columnas de la planilla, en su orden. En celular, una tarjeta por asignación.
- **Sin filas**: mensaje «Sin resultados» y totales en cero.
- **Acciones por fila** según `can_replan` y `can_set_result`.

## Diálogo de asignación

Campos, en este orden: Turno, Persona, Estrategia, Canal, Subcanal, Hora inicio, Hora fin, Ubicación/Lugar, Meta.

- Canal se habilita al elegir Estrategia; Subcanal, al elegir Canal.
- Cambiar Estrategia vacía Canal y Subcanal; cambiar Canal vacía Subcanal.
- Al elegir Subcanal y Turno se llenan Hora inicio y Hora fin con el horario sugerido, salvo que el usuario ya las haya escrito a mano.
- Si la persona ya tiene otra asignación ese día con horario que se cruza, aparece un aviso; se puede guardar igual.

## Diálogo de resultado

Resultado (número, se puede dejar vacío) y Observaciones (hasta 300 caracteres, con contador).

## Pantalla Catálogo

Tres niveles anidados. Por cada elemento: nombre, orden, activo. Por cada subcanal, además: mañana (inicio y fin) y tarde (inicio y fin).
No hay botón de eliminar; se desactiva.

## Pantalla Registrar

Deja de mostrar la actividad en curso del plan (ver research R13).
