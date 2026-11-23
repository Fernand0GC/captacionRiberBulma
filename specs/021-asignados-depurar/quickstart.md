# Quickstart: probar la 021 en local

1. Aplicar la migración (no `supabase migration up`, no `db reset`):
   `docker exec -i supabase_db_riber-captacion psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/migrations/20261123002100_assigned_hidden.sql`
2. Datos de prueba propios:
   `docker exec -i supabase_db_riber-captacion psql -U postgres -v ON_ERROR_STOP=1 -q < specs/021-asignados-depurar/seed-demo-021.sql`
3. Abrir http://localhost:5180 → entrar como `enc.verdolago` (clave `Captacion.2026`) → Gestión → Actividad →
   «Clientes asignados» de Auxiliar Verdolago.
4. Ver el aviso con la cantidad de contactados → «Ocultar»: salen de la lista; «N ocultos» y «Ver ocultos» aparecen;
   los números de la fila de Actividad no cambian.
5. Encender «Ver ocultos» → filas marcadas «Oculto» → «Mostrar» en una.
6. «Ocultar» en la fila de un sin contactar.
7. Cerrar y abrir de nuevo → «Mantener» (cuando haya contactados visibles) → reabrir: no vuelve a preguntar hoy.
8. Entrar como `aux.verdolago` → Mis contactos: los ocultos siguen ahí.
9. Quitar los datos: `specs/021-asignados-depurar/seed-demo-021-limpiar.sql` (solo los «Demo 021»).

Tests: `pnpm test tests/unit/assigned.test.ts` · `pnpm db:test` (o `supabase test db supabase/tests/assigned_hidden_test.sql`)
· `pnpm e2e tests/e2e/assigned-hide.spec.ts` (preguntar antes si otra pestaña corre Playwright).
