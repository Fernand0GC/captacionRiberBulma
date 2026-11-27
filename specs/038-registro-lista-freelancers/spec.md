# Spec 038 · Registro con freelancer: ver la lista y elegir uno

Estado: en producción (2026-11-27). Origen: revisión de la spec 033 en producción. En el registro con canal Freelance,
el campo «Freelancer» es un buscador que solo sugiere al escribir: quien registra no ve que ya hay freelancers en la
sucursal. El usuario pide verlos y poder agregar los que faltan, «así como en las volanteras». Solo pantalla.

## Criterios de aceptación
1. En modo Freelance (spec 033), el campo **Freelancer \*** muestra desde el inicio la **lista de freelancers de la
   sucursal** (catálogo descargado: referidores activos `kind = 'freelance'` de la sucursal de registro, más los
   recién escritos en este celular que aún no subieron), cada uno como opción de **selección única** (radio).
2. Arriba de la lista, buscador **«Buscar freelancer»** (sin importar mayúsculas, tildes ni espacios). El elegido se
   ve siempre, primero. Lista con altura fija (~8 nombres) y desplazamiento propio.
3. Si lo buscado tiene 2 o más letras y no es igual a ningún freelancer de la lista, botón **«Agregar «texto»»**:
   lo deja elegido como freelancer nuevo (`referrer_new` con `kind: 'freelance'`, como hoy) y vacía el buscador. Se
   recuerda en el celular como los demás referidores nuevos (spec 010).
4. Sin freelancers en la sucursal: «No hay freelancers cargados. Escribe el nombre arriba para agregarlo.»
5. Sin elegir: «Escribe el nombre del freelancer.» (como hoy). Lo demás de la spec 033 no cambia.
6. **«Producto que compró»** lleva el asterisco de obligatorio.
7. Funciona sin señal (la lista sale del catálogo guardado).

## Diseño
Reutiliza la lógica pura de la spec 036 (`freelancerView`) con un solo elegido. Las opciones sin id (escritas en este
celular) usan como clave su nombre normalizado.

## Pruebas
- `tests/e2e/capture-freelance.spec.ts` (criterios 1 a 3, 5 y 6).
- `tests/unit/freelancerView.test.ts` sigue en verde.
