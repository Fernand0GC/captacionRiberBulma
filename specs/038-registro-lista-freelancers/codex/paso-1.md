# Encargo a Codex · Spec 038 · Paso 1: lista de freelancers en el registro

Reparto: el PM y QA (Claude) definió los criterios y escribió las pruebas; **tú programas**. Lee primero
`specs/038-registro-lista-freelancers/spec.md`, `CLAUDE.md` y `.specify/memory/constitution.md`. Solo pantalla: **no
hay migración**.

## Pruebas que deben quedar en verde (NO las modifiques)
- `tests/e2e/capture-freelance.spec.ts` (la corre QA).
- `tests/unit/freelancerView.test.ts` y todo `npx vitest run`.

## Qué cambiar
1. Nuevo componente `src/features/capture/FreelancerPicker.tsx`, usado por `CaptureForm.tsx` en modo Freelance en
   lugar de `ReferrerPicker`:
   - Props: las opciones de referidores que ya calcula el formulario (`referrerOptions`, filtradas a
     `kind === 'freelance'`), el valor elegido (`ReferrerChoice | null`), `onChange` y el error.
   - Raíz con `role="radiogroup"` y nombre accesible **«Freelancer \*»** (título visible «Freelancer» con asterisco
     como los demás obligatorios); el error debajo, como hoy.
   - `input type="search"` con etiqueta accesible **«Buscar freelancer»**.
   - Usa `freelancerView` de `src/features/organization/freelancerView.ts` con `picked` = el elegido (0 o 1). Las
     opciones sin id (escritas en este celular, `id: null`) usan un id negativo estable solo para la vista
     (p. ej. derivado del índice) y se mapean de vuelta al elegir.
   - Cada fila es un `input type="radio"` (mismo `name`) con el nombre como etiqueta; elegir llama `onChange` con
     `{ id, name }` (catálogo) o `{ id: null, name, kind: 'freelance' }` (escrito en el celular).
   - Lista en contenedor con altura máxima (~8 filas) y `overflow-y-auto`; elegido primero.
   - Si `addName` no es null: botón **«Agregar «<addName>»»** → `onChange({ id: null, name: addName, kind: 'freelance' })`
     y vacía el buscador. (Se recuerda en el celular igual que hoy: el formulario ya llama `remember…` al guardar un
     referidor nuevo.)
   - Sin opciones y sin búsqueda: «No hay freelancers cargados. Escribe el nombre arriba para agregarlo.»
   - Con búsqueda sin resultados: `emptyText` de `freelancerView`.
2. `src/features/capture/CaptureForm.tsx`: en modo Freelance usa `FreelancerPicker` (el modo normal sigue con
   `ReferrerPicker` sin cambios); el título «Producto que compró» lleva el asterisco de obligatorio (mismo estilo que
   los demás campos obligatorios). Validación y envío como hoy (spec 033).
3. Si `ReferrerPicker.tsx` quedó con la prop `fixedKind` solo para el modo Freelance y ya no se usa, puedes dejarla
   (no la borres si otro lugar la usa).

## Reglas
- TypeScript estricto, sin `any`; async/await, nunca `.then()`; funciones arrow en callbacks; comentarios en español.
- Toca SOLO esos archivos. No modifiques pruebas. No corras comandos de base de datos, docker, git ni red.
- Listo cuando pasen: `npx tsc -b`, `npx eslint .`, `npx vitest run`.
- Al terminar, informa en español: archivos tocados, qué hiciste y la salida final de los tres comandos.
