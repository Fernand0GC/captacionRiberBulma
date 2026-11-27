# Encargo a Codex · Spec 031 · Paso 1: sin «Ocupación» en Messenger y Marketplace

Reparto: el PM y QA (Claude) definió los criterios y escribió las pruebas; **tú programas**. Lee primero
`specs/031-sin-ocupacion-mensajeria/spec.md`, `CLAUDE.md` y `.specify/memory/constitution.md`.

## Pruebas que deben quedar en verde (NO las modifiques)
- `tests/unit/occupation.test.ts` (criterios 1 a 3).
- `tests/e2e/capture-occupation.spec.ts` (criterios 1, 3, 4 y 5). La corre QA.
- Y sigue en verde todo `npx vitest run`.

## Qué cambiar

### A. Nuevo `src/features/capture/occupation.ts`
- `export function asksOccupation(channelName: string | undefined): boolean`
- Normaliza el nombre: minúsculas, sin tildes (`normalize('NFD')` y quitar las marcas diacríticas), espacios de los
  extremos quitados y espacios internos colapsados a uno.
- Devuelve `false` si el nombre normalizado es exactamente `messenger` o `marketplace`; `true` en cualquier otro caso,
  incluido `undefined` o vacío.
- Comentario en español que diga por qué (spec 031, observación 12 de ventas).

### B. `src/features/capture/CaptureForm.tsx`
1. Calcula `const showOccupation = asksOccupation(channelName)` con el `channelName` que ya existe.
2. Muestra el bloque «Ocupación del cliente» (el `div` con los botones de `RUBROS`) solo si `showOccupation`.
3. Al guardar, manda `occupation` solo si `showOccupation`
   (`occupation: showOccupation ? form.occupation.trim() || undefined : undefined`).
4. No cambies nada más del formulario.

## Reglas
- TypeScript estricto, sin `any`; async/await, nunca `.then()`; funciones arrow en callbacks; comentarios en español
  como el resto del repo; código en inglés.
- Toca SOLO los archivos nombrados arriba. No modifiques pruebas. No corras comandos de base de datos, docker, git ni red.
- Listo cuando pasen: `npx tsc -b`, `npx eslint .`, `npx vitest run`.
- Al terminar, informa en español: archivos tocados, qué hiciste en cada uno y la salida final de los tres comandos.
