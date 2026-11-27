# Spec 033 · Freelancers: registro corto como venta y cantidad en la Planificación

Estado: en producción (2026-11-27). Origen: observaciones 2, 10 y 11 de ventas («APP - CAPTACION»):
- 2 «CANAL: FREELANCER. Agregar la cantidad de freelancers que hay en la sucursal.»
- 10 «FREELANCER: Nombre del Freelancer.»
- 11 «Para los freelancer: dejar solo nombre completo, celular, qué producto compró, directo a compró.»

## Decisiones del usuario (2026-11-27)

- El padrón de freelancers es el que **ya existe**: referidores con tipo `freelance` (spec 005), por sucursal, que se
  cargan en Referidos o al registrar. La cantidad sale de ahí.
- El formulario se reduce porque «es muy extenso». El cliente entra **directo como venta**, a cargo de **quien lo registra**.

## Criterios de aceptación

### Registro con canal Freelance (obs. 10 y 11)
1. Si el canal de la jornada (catálogo `channels`) se llama **Freelance** (sin importar mayúsculas, tildes ni espacios),
   el formulario de registro muestra SOLO: **Nombre completo**, **Celular**, **Freelancer** y **Producto que compró**.
   No muestra ocupación, dirección, nivel de interés ni la casilla «Es referido».
2. Los cuatro son obligatorios. Sin freelancer: «Escribe el nombre del freelancer.»; sin producto:
   «Elige el producto que compró.». Nombre y celular se validan como hoy.
3. **Freelancer**: se elige de los freelancers activos de la sucursal (referidores `kind = 'freelance'`) o se escribe
   uno nuevo, que se crea con tipo `freelance` sin preguntar el tipo. Usa el mismo buscador de referidores (spec 010).
4. Al guardar se manda la captación con `sold: true`, el producto y el freelancer como referidor (`referrer_id` o
   `referrer_new` con `kind: 'freelance'`). Funciona sin señal como cualquier registro (cola de envío).
5. **Base (`submit_capture`)**, cuando llega `sold = true`:
   - sin producto válido → `invalid_input`, detalle `product_id`; sin freelancer (ni elegido ni creado) →
     `invalid_input`, detalle `referrer`;
   - si la captación queda activa: etapa **`sale`**, `sold_at` y `stage_changed_at` = ahora, `assigned_to` = quien
     registra; historial `capture → sale` con nota «Venta directa (freelancer)» y asignación a quien registra;
   - si el celular ya existe, queda como duplicado igual que hoy.
6. Sin `sold`, `submit_capture` se comporta igual que antes (incluido «interés alto → cliente potencial»).

### Planificación, canal Freelancers (obs. 2)
7. Al elegir el canal **Freelancers** en una asignación, el formulario muestra «N freelancers en la sucursal»
   (referidores activos con `kind = 'freelance'` de esa sucursal). Con 0: «No hay freelancers cargados en la
   sucursal. Se cargan en Referidos.»

## Fuera de alcance
- Comisiones o pagos a freelancers.
- Cambiar el reporte de Referidos (los freelancers ya aparecen ahí como referidores).

## Diseño
- `submit_capture` se modifica con un **parche** (`pg_temp.patch_function`, como las migraciones 005/010/014), no
  copiando el cuerpo: producción tiene el bloque «interés alto» (spec de 13/11) que la base local no tiene.
  Huella de producción antes del cambio: `b3051c07650eea7b9272b44afaf45ea2`.
- Lógica pura `isFreelanceChannel(name)` en `src/features/capture/freelance.ts`.

## Pruebas
- `supabase/tests/freelance_sale_test.sql` (criterios 5 y 6).
- `tests/unit/freelance.test.ts` (criterio 1, nombre del canal).
- `tests/e2e/capture-freelance.spec.ts` (criterios 1 a 4) y `tests/e2e/organization-freelancers.spec.ts` (criterio 7).
