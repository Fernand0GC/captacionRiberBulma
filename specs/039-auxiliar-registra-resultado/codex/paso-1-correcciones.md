# Correcciones de QA · Spec 039

Mismo lugar, rama y límites que `paso-1.md`. QA corrió pgTAP (own_result 30/30, day_close y goals_plan_breakdown en
verde), vitest 453/453, tsc y eslint en 0, navegador 16/16. Falta esto:

1. **«Registrado por» desacomoda la tarjeta móvil (menor).** En `OrganizationPage.tsx`, tarjeta de celular («Mi plan» y
   Planificación a 360 px): cuando hay «Registrado por Encargado Verdolago», `ResultCell` se hace ancho, el `flex-wrap`
   lo baja debajo de la hora y el estado («No hecho») queda a la izquierda, entre la hora y el canal. Sin esa línea,
   el estado queda arriba a la derecha (correcto). Se espera: el estado siempre arriba a la derecha y «Registrado por X»
   como línea propia, chica y gris, al final de la tarjeta (después de volanteras/freelancers/observaciones). En la tabla
   de escritorio puede quedar donde está (debajo del resultado). Sugerencia: una prop de `ResultCell` para no pintar la
   línea, y pintarla aparte en la tarjeta.

No cambies nada más. Comprueba con `npx vitest run`, `npx tsc -b`, `npx eslint .`. Entrega un resumen corto.
