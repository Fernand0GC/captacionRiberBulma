# Contrato UI — spec 021 (modal «Clientes asignados»)

## Aviso (`HideNotice`, arriba de la lista)

- Aparece si `contacted_visible > 0` y no hay «Mantener» guardado hoy para (quien mira, persona).
- `role="alert"`, texto: «N clientes ya fueron contactados. ¿Ocultarlos de esta lista?» (singular: «1 cliente ya fue contactado. ¿Ocultarlo de esta lista?»).
- Botones «Ocultar» y «Mantener».
  - Ocultar → `hide_assigned_contacted` → toast «✓ N ocultos» → recarga la lista.
  - Mantener → guarda la fecha en `localStorage` y cierra el aviso.
- Error → toast de error; la lista no cambia.

## Barra (`AssignedToolbar`)

- Interruptor «Ver ocultos» (`role="switch"`, apagado al abrir) y texto «N ocultos» (`data-testid="hidden-count"`), visibles si `hidden_total > 0`.
- Con el interruptor apagado, lupa, filtros, contador «X de N» y «Seleccionar» actúan solo sobre no ocultos.

## Fila (`AssignedRowItem`)

- Botón «Ocultar» (`aria-label="Ocultar <nombre>"`) en filas no ocultas.
- Fila oculta (solo con «Ver ocultos»): marca «Oculto» (`data-testid="hidden-badge"`) y botón «Mostrar» (`aria-label="Mostrar <nombre>"`).
- Ocultar → toast «✓ Oculto»; Mostrar → toast «✓ Visible de nuevo». Ambas recargan la lista.
- En modo «Seleccionar» los botones Ocultar/Mostrar no se muestran (una acción a la vez).

## Sin cambios

- Indicadores de arriba (`AssignedKpis`, «De dónde vienen», «A qué proceso pasaron»): cuentan todo el período.
- Tabla de Actividad.
