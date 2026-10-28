# Contract: Exportación Excel (modelo `Unificado.xlsx`)

Filtros: rango de fechas (obligatorio) y sucursales (encargado: fija la suya). Excluye captaciones `voided`.
Archivo: `captacion_<sucursal|TODAS>_<desde>_<hasta>.xlsx`. Fechas en hora de La Paz, formato `dd/mm/yyyy`.

## Hoja `CLIENTES`
Encabezado de resumen (fila 3–4): Clientes registrados · Interés alto · Interés medio · Ventas · Sin interés.

| Columna | Origen |
|---|---|
| Nº | correlativo |
| Nombre completo | `full_name` |
| Teléfono / celular | `phone_raw` |
| Actividad | `occupation` |
| Producto | `products.name` (categoría; Celulares es una sola) |
| Dirección / referencia | `address` |
| Tipo de interés | `interest` → Alto/Medio/Bajo; si la etapa es `sale` → COMPRA; si es `lost` → Perdido (igual que el modelo) |
| Ubicación (enlace) | vacío (sin GPS en la v1) |
| Fecha de captación | `client_created_at` |
| Sucursal | `branches.name` |
| Canal | `channels.name` |
| Encargado | autor (`created_by.full_name`) |
| Etapa | etapa actual *(columna nueva respecto al modelo)* |
| Responsable seguimiento | `assigned_to.full_name` *(nueva)* |
| Turno | Mañana/Tarde *(nueva)* |

Filas con `duplicate_rejected`: van en una hoja aparte, `DUPLICADOS`, con las mismas columnas más "Duplicado de (fecha y autor del original)".

## Hoja `INFORMES` (gestiones)
Una fila por gestión dentro del rango (`contacted_at`).

| Columna del modelo | Origen |
|---|---|
| ID | `G-` + correlativo |
| Fecha | `contacted_at` |
| Sucursal | sucursal del prospecto |
| Canal | canal de la gestión |
| Responsable | `actor_id.full_name` |
| Cliente / institución | `full_name` |
| Teléfono | `phone_raw` |
| Producto / necesidad | producto |
| Línea | CELULARES/ELECTROS |
| Estado | `result` en español |
| Próxima acción sugerida | `next_action` |
| Fecha seguimiento | `next_contact_at` |
| Observaciones | `note` |
| Contacto efectivo | Sí/No |
| Venta confirmada | Sí si la etapa actual es `sale`; si no, No |
| Alerta seguimiento | Vencido / Sin fecha / vacío, calculado a la fecha de exportación |

Las columnas del modelo que la v1 no maneja (Tipo de venta, Pedido anterior/actual, Folletos, Vales, Empleados, Negociador, etc.) **se omiten**.

## Hoja `AGENDA`
Encabezado: Actividades · Completadas · Pendientes · En curso · Vencidas.
Columnas: Fecha · Sucursal · Turno · Hora (inicio–fin) · Estrategia · Actividad (descripción) · Meta / resultado esperado (cantidad + unidad, o texto) · Lugares · Responsable(s) · Estado · Resultado · Cumplimiento (%).

## Hoja `GERENCIA`
Por cada mes del rango: Sucursal · Línea · Meta mes (unid.) · Ventas registradas · Saldo · Avance mes (%) · Días restantes · Obj. día según saldo · Obj. mínimo entero.
Abajo, un total nacional (como la hoja `DATOS` del modelo).

## Reglas
- Los totales del encabezado se calculan de las mismas filas exportadas (SC-007: coinciden al 100%).
- Las celdas numéricas y de fecha llevan su tipo real, no texto.
