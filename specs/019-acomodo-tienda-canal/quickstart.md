# Quickstart: spec 019

## Local

```bash
supabase migration up                     # aplica 20261123001900 (nunca db reset)
pnpm db:test                              # pgTAP, incluye acomodo_tienda_channel_test.sql
pnpm e2e tests/e2e/organization.spec.ts   # con la app corriendo como en los otros e2e
```

En local no existe el subcanal: la migración solo crea el canal (moved = 0). El movimiento se prueba en pgTAP.

## Producción (lo hace el usuario)

1. Correr `specs/019-acomodo-tienda-canal/diagnostico-produccion.sql`, bloques 1–3, y guardar el resultado (los «antes»).
2. Si el bloque 1 muestra variantes que no coinciden exacto (`coincide_exacto = false`) y sí son «Acomodo de tienda»,
   avisar antes de aplicar: la migración no las mueve.
3. Aplicar la migración por el camino habitual (archivo `migraciones-019-produccion.sql` en el SQL Editor).
4. Volver a correr el diagnóstico:
   - Bloque 2 vacío (ninguna asignación en el subcanal viejo).
   - Bloque 1: subcanal(es) con `activo = false` y el canal Tienda → Acomodo de tienda activo.
   - Las sumas del «antes» deben aparecer en el canal nuevo (consulta de verificación incluida en el archivo de producción).
5. Abrir Planificación → Tienda → «Acomodo de tienda»: se guarda sin subcanal.
