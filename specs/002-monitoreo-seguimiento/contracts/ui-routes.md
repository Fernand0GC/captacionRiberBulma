# Contrato UI: `/gestion` con vistas de monitoreo

Roles: encargado, jefe de ventas, gerente, Sistemas (sin cambio de ruta ni de `RequireRole`).

## Selector de vista

Grupo de botones en el encabezado: **Captaciones** · **Visitas pactadas** · **Seguimientos** · **Actividad**. En celular el grupo puede desplazarse de lado. Cambiar de vista conserva período y sucursal; limpia `pagina` y filtros propios de la otra vista.

## Parámetros de búsqueda (URL)

| Parámetro | Valores | Vista |
|-----------|---------|-------|
| `ver` | `visitas` · `seguimiento` · `actividad` (ausente = Captaciones) | todas |
| `periodo`, `desde`, `hasta`, `sucursal` | como hoy | todas |
| `autor`, `canal`, `responsable` | como hoy | Captaciones, Seguimientos |
| `estado` | `sin_contactar` · `seguimiento` · `potencial` · `venta` · `sin_interes` (ausente = Todos) | Seguimientos |
| `interes` | `alto` · `medio` · `bajo` · `sin` | Seguimientos |
| `intentos` | `ninguno` · `1-2` · `3+` (sobre "No contestó seguidos") | Seguimientos |
| `vencidos` | `true` (también acepta `1`) | Seguimientos |
| `sin_contacto` | `3` · `7` · `15` · `30` | Seguimientos |
| `motivo` | id de `lost_reasons` (solo con `estado=sin_interes`) | Seguimientos |
| `orden` | `<columna>` (de mayor a menor; `full_name` A→Z) o `-<columna>` (al revés); ausente = total | Actividad |
| `persona`, `metrica` | uuid de personal · `all…sales` (abre el detalle) | Actividad |
| `pagina` | entero | Captaciones, Seguimientos |

Nunca en la URL: nombre ni celular del cliente (búsqueda en estado de la pantalla).

## Seguimientos

- Pestañas de estado con número (`by_tab`); la activa se marca con `aria-selected`.
- Escritorio (`md:` en adelante): tabla. Columnas: Cliente · Responsable · Etapa · Interés · No contestó · Contactos · Último contacto (fecha, forma, resultado) · Observación (1 línea, `title` completo) · Próximo · Días sin contacto. Vencidos marcados en ámbar.
- Celular: tarjeta por cliente con nombre, etapa, interés, "No contestó n/3 · n contactos", observación en 2 líneas (`line-clamp-2`), próximo contacto y badge "Vencido".
- Tocar fila o tarjeta → `/cliente/$id`. "Atrás" vuelve con los mismos filtros.
- Vacío: mensaje según pestaña o filtro ("No hay clientes vencidos", "Ningún cliente sin contactar en este período").
- Paginación de 50, como Captaciones. Botón Exportar Excel.

## Actividad

- Solo filtros de período y sucursal.
- Tabla en todos los tamaños: columna Personal `sticky left-0`; contenedor con desplazamiento horizontal; fila **Total** al final. Cabeceras ordenables (`aria-sort`).
- Persona inactiva: nombre con badge "Inactiva". Rol en texto pequeño.
- Tocar nombre → detalle `metrica=all`; tocar número > 0 → detalle con esa métrica (los ceros no son tocables).
- Detalle: diálogo con título "Ana · Visitas pactadas · Hoy", lista de contactos (cliente, fecha y hora, forma, resultado, observación) y "Cargar más". Tocar un contacto → `/cliente/$id`. Cerrar quita `persona`/`metrica` de la URL.
- Vacío: "Nadie registró contactos en este período".
- Botón Exportar Excel.

## Ficha del cliente (`/cliente/$id`)

- Bloque nuevo "Contactos por persona" arriba de "Historial": una línea por persona, por ejemplo "Ana · 3 llamadas · 1 mensaje" con el total destacado. Sin contactos: "Sin contactos todavía".
