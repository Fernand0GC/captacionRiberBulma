# Spec 036 · Lista de freelancers cómoda con muchos nombres

Estado: en producción (2026-11-27). Origen: revisión de la spec 035 («¿qué pasa si aparecen 50 freelancers?»). Hoy
«Freelancers que van» es una columna de casillas sin buscador: con muchos nombres hay que bajar mucho, el botón de
agregar queda al fondo y no se ve qué está marcado. Solo pantalla: no cambia la base.

## Criterios de aceptación
1. Arriba de la lista, un buscador **«Buscar freelancer»**: filtra por nombre sin importar mayúsculas, tildes ni
   espacios de más. Los **marcados se ven siempre**, aunque no coincidan con la búsqueda.
2. Orden: primero los marcados, luego el resto; cada grupo por nombre.
3. Contador **«N marcados»** (con 1: «1 marcado»; con 0 no se muestra).
4. La lista tiene altura fija (unos 8 nombres) con desplazamiento propio; en pantalla ancha, dos columnas.
5. **«+ Agregar freelancer»** queda arriba, junto al buscador (como hoy: abre «Nombre del freelancer» + «Agregar»).
6. Si lo buscado tiene 2 o más letras y **no coincide exactamente** con ningún freelancer de la lista (misma
   normalización), aparece el botón **«Agregar «texto»»**, que lo agrega con `org_add_freelancer` y lo deja marcado;
   el buscador se vacía.
7. Sin resultados: «Ningún freelancer coincide con «texto».» (además del botón del criterio 6).
8. Todo lo de la spec 035 sigue igual (conteo, guardar, editar, inactivos marcados «(inactivo)»).

## Diseño
Lógica pura `freelancerView(options, picked, query)` en `src/features/organization/freelancerView.ts`.

## Pruebas
- `tests/unit/freelancerView.test.ts` (criterios 1, 2, 3 y 6).
- `tests/e2e/organization-freelancers.spec.ts` (criterios 1, 5 y 6 en pantalla).
