# Contrato UI (023)

## Del día (`/gestion?ver=dia`)

- Sección «Agenda de recontacto» debajo de las tarjetas actuales, antes de las listas.
- Día elegido = hoy: tabla `Persona | Le tocaba hoy | Contactó | Pendientes | Atrasados`, ordenada por Pendientes + Atrasados
  (mayor primero) y luego por nombre; fila Total. `data-testid="agenda-row"` por persona.
- Otro día: texto «La agenda de recontacto solo está disponible para hoy» y botón «Ir a hoy».
- Con «Solo referidos»: nota «Incluye todos los orígenes».
- Tocar una persona abre un diálogo con 3 pestañas: Pendientes, Contactados hoy, Atrasados. Columnas: Cliente (enlace a la
  ficha) y celular, Etapa, Intentos (`n/3`), Estado (etiqueta de `dueStatus`), Último contacto (forma · resultado · nota).
  Paginado 25 por página con el paginador de la 022.
- Excel de «Del día» con hoy: hoja «Agenda» con una fila por persona.

## Actividad (`/gestion?ver=actividad`)

- Dos columnas nuevas después de «Total de contactos»: «Primer contacto» (corto «1.er contacto») y «Recontacto» (corto
  «Recontactos»), por persona y por sucursal, ordenables, con fila Total y en el Excel.
- El número abre el detalle de contactos filtrado (`metrica=first|recontact`).

## Seguimientos (`/gestion?ver=seguimiento`)

- Selector «Contar por: Registro | Asignación | Último contacto | Próximo contacto» en la barra de filtros. URL:
  `contar=asignacion|ultimo|proximo` (sin el parámetro = Registro). Se limpia al cambiar de vista.
- Texto bajo el total: «registrados», «asignados», «con último contacto», «con contacto agendado» + período; la línea de
  ayuda dice qué fecha cuenta.
- Excel: el título dice qué fecha se contó.
