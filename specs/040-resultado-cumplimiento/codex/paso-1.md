# Encargo para Codex · Spec 040: el resultado por cumplimiento no pide número

Reparto: el PM y QA (Claude) definió los criterios y escribió las pruebas; **tú programas**.

## Dónde trabajas

- Carpeta: `/Users/daniel/Documents/RB-union/captacionRiberBulma`, rama actual (no cambies de rama).
- Lee `CLAUDE.md` y `specs/040-resultado-cumplimiento/spec.md` completa.
- Modelo de estilo: las funciones puras vecinas de `src/features/organization/logic.ts` (`goalFlags`, `resultState`),
  con su comentario JSDoc en español que nombra la spec.

## Pruebas que ya existen y hoy fallan (NO las modifiques)

- `tests/unit/resultFields.test.ts`: falla porque `resultFields` todavía no existe.
- `tests/e2e/organization.spec.ts`, caso «organización (040)»: lo corre QA, tú no tienes base ni navegador.

Deben seguir pasando: todo `npx vitest run`, en especial `organization.test.ts`, `ownResult.test.ts` y
`dayClose.test.ts`.

## Qué construir

1. **`src/features/organization/logic.ts`**: función pura exportada, junto a `resultState`:

   ```ts
   resultFields(a: {
     uses_goal: boolean
     uses_share_goal: boolean
     goal: number | null
     share_goal: number | null
     result: number | null
     share_result: number | null
   }): { done: boolean; capture: boolean; share: boolean }
   ```

   - `done`: la tarea es por cumplimiento: sin marca de captación, sin marca de compartidas, sin meta de captación y
     sin meta de compartidas (la regla que hoy es `showDone` en el diálogo).
   - `share`: marca de compartidas, o meta de compartidas cargada, o compartidas ya guardadas (igual que hoy).
   - `capture`: marca de captación, o meta de captación cargada, o captados ya guardados. **Este es el cambio**: hoy
     el diálogo además lo muestra cuando no hay compartidas (`|| !showShare`); esa parte se quita.

2. **`src/features/organization/ResultDialog.tsx`**: reemplaza las tres constantes `showDone`, `showShare` y
   `showCapture` por el resultado de `resultFields(a)`, calculado una sola vez con la fila que recibe el diálogo.
   Quita el comentario «Sin ninguna meta (p. ej. Tareas administrativas) igual se puede anotar un resultado de
   captación», que deja de ser cierto, y actualiza el JSDoc del componente para nombrar la spec 040. El resto del
   diálogo (envío, validaciones, textos, botones) no cambia.

   Criterios que QA prueba en el navegador:
   1. Tarea sin meta y sin resultado: se ve «¿Se hizo?» con «Hecho» y «No hecho» y Observaciones; no hay campo
      «Captados» ni «Compartidas».
   2. Al marcar «Hecho» y guardar, aparece «✓ Resultado guardado» y la fila muestra «Hecho».
   3. Tarea con meta de captación: «Captados» como hoy, sin «¿Se hizo?».
   4. Tarea sin meta que ya tiene captados guardados: «Captados» sigue visible con su número.
   5. Si la base rechaza, el diálogo muestra el mensaje y no se cierra (ya funciona así; no lo rompas).

## Límites

- No modifiques pruebas existentes ni las dos pruebas nuevas de la spec 040.
- No toques migraciones, `api.ts`, `OrganizationPage.tsx` ni nada fuera de los dos archivos nombrados.
- Sin dependencias nuevas. Sin `config.toml` ni `.env*`. Sin commit ni push.
- TypeScript estricto, sin `any`. Mismo formato que los archivos vecinos.

## Cómo comprobar

No tienes Docker: QA corre la base y el navegador.

```sh
npx vitest run
npm run typecheck
npm run lint
```

## Qué entregar

Un resumen corto con:
- los archivos cambiados;
- la salida de los comandos;
- dónde se resuelve cada criterio;
- las decisiones propias.
