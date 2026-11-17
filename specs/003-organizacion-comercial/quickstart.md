# Quickstart: validación de la organización comercial (003)

Guía para comprobar de punta a punta que la feature cumple la spec. Detalles en [data-model.md](data-model.md)
y [contracts/](contracts/).

## Prerrequisitos

- Proyecto levantado en local según `specs/001-captacion-mvp/quickstart.md`.
- Usuarios de prueba del seed (uno por rol en Verdolago, más encargado y volantera de Trinidad y un jefe de ventas con las dos).

## Aplicar los cambios de base

```bash
supabase migration up      # aplica solo las migraciones nuevas; NO usar `supabase db reset`
```

## Pruebas automáticas

```bash
pnpm test                  # Vitest: filtros, totales, cruce de horarios, horario sugerido
supabase test db           # pgTAP: permisos por rol, límite por fecha, catálogo, copia de día
pnpm e2e                   # Playwright: flujo de carga, resultado, filtros y exportación
pnpm build && pnpm size    # el JS inicial sigue ≤170 KB gzip
```

## Validación manual por historia

### Historia 1: cargar la organización del día

1. Entrar como encargado de Verdolago y abrir Planificación.
2. Agregar una asignación para mañana: elegir Calle y comprobar que Canal ofrece solo Negociación, Activación y Volantes.
3. Elegir Activación → «Activaciones en barrios», turno Mañana: las horas se llenan con 10:00 y 12:00.
4. Cambiar el turno a Tarde: pasan a 16:30 y 18:30.
5. Elegir «Activaciones instituciones» con turno Tarde: las horas quedan vacías.
6. Guardar y comprobar que la fila muestra al jefe de ventas de la sucursal en la columna Gerente.
7. Cambiar la Estrategia de una asignación: Canal y Subcanal se vacían.
8. Asignar a la misma persona otra tarea con horario que se cruza: aparece el aviso y se puede guardar.

**Esperado**: 5 asignaciones cargadas en menos de 5 minutos (SC-001), ninguna con combinación inválida.

### Historia 2: resultado y observaciones

1. En una asignación con meta 30, registrar resultado 15: la fila muestra 15 de 30 y 50 %.
2. Una asignación sin resultado aparece como pendiente, no como 0.
3. Escribir una observación de más de 300 caracteres: el sistema avisa y no pierde el texto.

### Historia 3: filtros y totales

1. Entrar como jefe de ventas, elegir una semana y sus dos sucursales.
2. Filtrar por un canal: la tabla y los tres totales cambian.
3. Sumar a mano las filas visibles y comparar con los totales (SC-005).
4. Aplicar un filtro sin coincidencias: «Sin resultados» y totales en cero.

### Historia 4: catálogo

1. Entrar como Sistemas, abrir Catálogo y agregar un subcanal con sus dos horarios.
2. Como encargado, comprobar que aparece al cargar una asignación.
3. Desactivarlo: ya no se ofrece, pero la asignación que lo usa lo sigue mostrando.
4. Intentar repetir un nombre dentro del mismo canal: lo rechaza con un mensaje claro.

### Historia 5: exportar

1. Filtrar una sucursal y una semana y exportar.
2. Abrir el archivo: mismas filas que la pantalla y las 14 columnas en el orden de [contracts/excel-export.md](contracts/excel-export.md).

### Permisos (FR-025 a FR-029)

| Usuario | Prueba | Esperado |
|---|---|---|
| Encargado de Verdolago | Abrir la organización de Trinidad | No puede |
| Encargado | Cambiar la meta de una asignación de hoy | No puede; sí puede registrar el resultado |
| Encargado | Crear una asignación para hoy | Puede |
| Supervisor de Verdolago | Cargar y corregir en Verdolago | Puede, con los mismos límites que el encargado |
| Jefe de ventas | Cambiar la meta de una asignación de hoy en su sucursal | Puede; queda en el historial de cambios |
| Auxiliar | Abrir «Mi plan» | Ve solo sus asignaciones, sin acciones |
| Volantera | Buscar la Planificación | No está en su menú; la dirección la devuelve a su inicio |
| Cualquiera que no sea Sistemas | Abrir Catálogo | No puede |

### Historial

1. Abrir «Ver planificación anterior»: se ven las actividades cargadas antes del cambio, sin botones de editar.

## Puesta en marcha (fuera del código)

Estos pasos son de datos y se hacen desde la pantalla Usuarios, no por migración:

1. Crear o revisar los 4 jefes de ventas con sus sucursales, según la tabla de [insumos-excel.md](insumos-excel.md).
2. Dar de alta, con su sucursal, a las personas de la planilla que todavía no tienen usuario.
3. Comprobar con ventas que el catálogo sembrado sigue vigente (lo marcaron como provisional).
