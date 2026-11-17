# Contract: Exportación de la organización a Excel

Archivo `.xlsx` generado en el navegador con `exceljs` (cargado bajo demanda). Exporta las filas visibles de la
pantalla Organización, es decir, con los filtros aplicados.

- **Nombre**: `organizacion_<alcance>_<desde>_<hasta>.xlsx` (por ejemplo, `organizacion_verdolago_2026-11-16_2026-11-22.xlsx`).
- **Hoja**: `ORGANIZACION`, con la fila de encabezados fija.

## Encabezado de la hoja

| Fila | Contenido |
|---|---|
| 1 | Título: «Organización comercial · <alcance> · del <desde> al <hasta>» |
| 3–4 | Totales de las filas exportadas: Meta total, Resultado total, N° de asignaciones |
| 6 | Encabezados de columna |

## Columnas (mismo orden que la planilla de ventas)

| # | Encabezado | Origen | Formato |
|---|---|---|---|
| 1 | Fecha | `work_date` | fecha `dd/mm/yyyy` |
| 2 | Gerente | `lead` | texto |
| 3 | Sucursal | `branch` | texto |
| 4 | Turno | `shift` | «Mañana» o «Tarde» |
| 5 | Hora Inicio | `start_time` | hora `hh:mm` |
| 6 | Hora Fin | `end_time` | hora `hh:mm` |
| 7 | Personal | `person` | texto |
| 8 | Estrategia | `strategy` | texto |
| 9 | Canal | `channel` | texto |
| 10 | Subcanal | `subchannel` | texto |
| 11 | Ubicación /Lugar | `place` | texto |
| 12 | Meta | `goal` | número entero |
| 13 | Resul. | `result` | número entero; celda vacía si no hay resultado |
| 14 | Observaciones | `notes` | texto |

## Reglas

- Sin filas visibles no se genera archivo; se muestra un aviso.
- El orden de las filas es el de la pantalla.
- Las fechas y horas se escriben como valores de fecha y hora de Excel, no como texto, para que se puedan filtrar y ordenar.
