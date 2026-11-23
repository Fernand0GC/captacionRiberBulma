# Contrato de UI: 020

## Modal «Clientes asignados» (`/gestion?ver=actividad&persona=…&metrica=assigned`)

- Lupa: `input` con `aria-label="Buscar por nombre o celular"`, placeholder «Buscar nombre o celular…». No va a la URL.
- Botón «Seleccionar» / «Cancelar selección» (`SelectToggle`), deshabilitado si no hay clientes reasignables.
- En modo selección: casilla `aria-label="Seleccionar <nombre>"` solo en filas reasignables (sin contactar y a cargo).
- Barra «Asignar» (`role="region" aria-label="Asignar"`) al pie del modal: la de `AssignSelection.tsx` con
  `layout: 'dialog'`. Sin sucursal única: «Clientes de varias sucursales: elige una sucursal en Actividad para reasignar.»
- Confirmación «¿Reasignar?» y avisos «✓ N reasignados» / «✓ N sin responsable»: los de siempre (sustantivo `clientes`).
- Cada fila muestra el celular bajo el nombre (`data-testid="assigned-phone"`).
- Sin coincidencias: «Ningún cliente con este filtro.» y contador «0 de N».

## Mis contactos (`/seguimiento`)

- Lupa: mismo `aria-label="Buscar por nombre o celular"`, placeholder «Buscar nombre o celular…».
- Contadores de pestañas y lista «Ver cerrados anteriores» cuentan/filtran solo las coincidencias.
- Sin coincidencias en la pestaña: «Ningún contacto coincide con «<texto>».»
