# Spec 031 · Sin «Ocupación» en Messenger y Marketplace

Estado: en producción (2026-11-27). Origen: observación 12 de ventas («APP - CAPTACION»): «Todo lo que venga de
messenger, mk place quitar ocupación».

## Problema

Al registrar un cliente, el formulario siempre muestra «Ocupación del cliente» (Independiente/Negocio/Microcrédito o
Dependiente/Asalariado). Para los contactos que llegan por Messenger o Marketplace ese dato no se conoce, y ventas pide
no mostrarlo.

## Criterios de aceptación

1. Si el **canal de la jornada** (el que se elige en «¿Por qué canal captas hoy?», catálogo `channels`) es
   **Messenger** o **Marketplace**, el formulario de registro NO muestra «Ocupación del cliente».
2. La comparación del nombre ignora mayúsculas, tildes y espacios de más (`Marketplace`, `MARKETPLACE`, ` marketplace `).
3. Con cualquier otro canal, o sin canal elegido, el campo se muestra como hoy (sigue opcional).
4. Con el campo oculto, la captación se guarda sin ocupación (`occupation` no se manda).
5. No cambia nada más del formulario (nombre, celular, producto, referido, dirección, interés).

## Fuera de alcance

- Las fichas y ediciones de clientes ya registrados (`ClientPage`, `EditClientDialog`) siguen mostrando la ocupación.
- Los subcanales de la Organización («Mensajería Marketplace», «Comentarios Markeplace»): son otro catálogo.

## Diseño

Función pura `asksOccupation(channelName: string | undefined): boolean` en `src/features/capture/occupation.ts`,
usada por `CaptureForm.tsx` con el `channelName` que ya calcula.

## Pruebas

- `tests/unit/occupation.test.ts` (criterios 1 a 3).
- `tests/e2e/capture-occupation.spec.ts` (criterios 1, 3 y 4 en pantalla).
