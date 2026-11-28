# Spec 040 · El resultado por cumplimiento no pide número

Observación 14 de ventas (2026-11-28): «Que los resultados que son por cumplimiento no te pidan colocar meta numérica».

## Problema

En la Planificación, una tarea por cumplimiento es la que no lleva meta de captación ni de compartidas (por ejemplo
«Tareas administrativas» o «Acomodo de tienda»). Desde la spec 039 su resultado se registra con «¿Se hizo?» Hecho /
No hecho, pero el diálogo «Resultado» sigue mostrando además el campo numérico «Captados». Ventas lo lee como un número
obligatorio y, si lo llenan, el número tapa al «Hecho» en la tabla.

## Decisión

Confirmado por gerencia: no hay ningún canal sin meta donde se anoten captados. El canal que deba contar captados
lleva la marca «Captación» en el Catálogo.

- Tarea por cumplimiento: el diálogo muestra solo «¿Se hizo?» y Observaciones.
- Excepción: si la fila ya tiene un número guardado (captados o compartidas), ese campo sigue a la vista para poder
  corregirlo o borrarlo. Al borrarlo, deja de aparecer.
- Tareas con meta: sin cambios.

## Criterios de aceptación

1. Dada una tarea sin meta y sin resultado, al abrir «Resultado» se ve «¿Se hizo?» y Observaciones; no se ve
   «Captados» ni «Compartidas».
2. Al marcar «Hecho» y guardar, la fila muestra «Hecho» y no se guarda ningún número.
3. Una tarea con meta de captación muestra «Captados» como hoy y no muestra «¿Se hizo?».
4. Una tarea con solo meta de compartidas muestra solo «Compartidas».
5. Una tarea sin meta que ya tiene captados guardados sigue mostrando «Captados» con su número.
6. Permisos sin cambios: el auxiliar no registra el resultado de una tarea ajena (spec 039).
7. Si la base rechaza el guardado, el diálogo muestra el mensaje y no se cierra (sin cambios).

## Alcance

- Solo interfaz: `src/features/organization/logic.ts` (función pura `resultFields`) y `ResultDialog.tsx`.
- Sin migración, sin cambios en funciones de la base ni en permisos.

## Pruebas

- `tests/unit/resultFields.test.ts` (criterios 1, 3, 4 y 5).
- `tests/e2e/organization.spec.ts`, caso «organización (040)» (criterios 1 y 2).
- Criterios 6 y 7: pruebas existentes de las specs 032 y 039.
