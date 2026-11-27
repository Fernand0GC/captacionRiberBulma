# Encargo a Codex · Spec 036 · Paso 1: lista de freelancers con buscador

Reparto: el PM y QA (Claude) definió los criterios y escribió las pruebas; **tú programas**. Lee primero
`specs/036-freelancers-lista-larga/spec.md`, `CLAUDE.md` y `.specify/memory/constitution.md`. Solo pantalla: **no hay
migración**.

## Pruebas que deben quedar en verde (NO las modifiques)
- `tests/unit/freelancerView.test.ts` (criterios 1, 2, 3, 6 y 7).
- `tests/e2e/organization-freelancers.spec.ts` (criterios 1, 5 y 6). La corre QA.
- Y sigue en verde todo `npx vitest run`.

## Qué cambiar
1. Nuevo `src/features/organization/freelancerView.ts` (lógica pura):
   ```ts
   export type FreelancerItem = { id: number; name: string; checked: boolean }
   export function freelancerView(
     options: { id: number; name: string }[], picked: number[], query: string,
   ): { items: FreelancerItem[]; pickedText: string | null; addName: string | null; emptyText: string | null }
   ```
   - Normaliza para comparar con `normalizeText` de `src/lib/search.ts` (minúsculas, sin tildes, espacios colapsados).
   - `items`: los marcados SIEMPRE + los no marcados cuyo nombre normalizado **contiene** la búsqueda normalizada
     (búsqueda vacía = todos). Orden: marcados primero, luego el resto; cada grupo con `localeCompare(…, 'es')`.
     Respeta el `name` tal cual (incluido un eventual sufijo «(inactivo)» que ponga quien llama).
   - `pickedText`: `null` con 0; «1 marcado»; «N marcados».
   - `addName`: búsqueda limpia (`trim` + espacios colapsados, mayúsculas como las escribió) si tiene 2 o más
     caracteres y ningún nombre de `options` es **igual** normalizado; si no, `null`.
   - `emptyText`: con búsqueda no vacía y `items` vacío → `Ningún freelancer coincide con «<búsqueda tal cual>».`;
     si no, `null`.
2. `src/features/organization/AssignmentDialog.tsx`, grupo «Freelancers que van» (spec 035):
   - Arriba: `input type="search"` con etiqueta accesible **«Buscar freelancer»** y, al lado, «+ Agregar freelancer»
     (mismo comportamiento que hoy, dentro del mismo `fieldset`).
   - Debajo: `pickedText` si no es `null`; los `items` con su casilla (etiqueta = nombre) dentro de un contenedor con
     altura máxima (~8 filas, `max-h-72` o similar) y `overflow-y-auto`, en `grid` de 1 columna y 2 en `sm:`.
   - `emptyText` si no es `null`. Si `addName` no es `null`, botón **«Agregar «<addName>»»** que llama al mismo flujo de
     `addFreelancer`, deja marcado el nuevo y vacía el buscador.
   - El buscador vive solo en el estado del diálogo (no se guarda).
   - No cambies nada más del formulario ni el conteo `freelancer-count`.

## Reglas
- TypeScript estricto, sin `any`; async/await, nunca `.then()`; funciones arrow en callbacks; comentarios en español.
- Toca SOLO esos dos archivos. No modifiques pruebas. No corras comandos de base de datos, docker, git ni red.
- Listo cuando pasen: `npx tsc -b`, `npx eslint .`, `npx vitest run`.
- Al terminar, informa en español: archivos tocados, qué hiciste y la salida final de los tres comandos.
