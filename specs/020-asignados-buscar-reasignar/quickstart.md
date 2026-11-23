# Quickstart: validar la 020 en local

## Aplicar la migración (solo base local)

```bash
docker exec -i supabase_db_riber-captacion psql -U postgres -v ON_ERROR_STOP=1 -q \
  < supabase/migrations/20261123002000_agent_assigned_phone_branch.sql
```

No usar `supabase db reset` ni `supabase migration up` (la `20261113000200` no está aplicada en local a propósito).

## Tests

```bash
pnpm test -- tests/unit/assigned.test.ts tests/unit/search.test.ts
supabase test db supabase/tests/agent_assigned_test.sql
# Solo si ninguna otra pestaña está corriendo Playwright (comparten el puerto 4173 y test-results/):
pnpm e2e tests/e2e/monitoring.spec.ts tests/e2e/followup.spec.ts
```

## Prueba manual

1. Como `enc.verdolago`, asignar dos captaciones nuevas a la Auxiliar Verdolago.
2. `/gestion` → Actividad → fila de la auxiliar → «Clientes asignados».
3. Escribir parte del nombre y luego 4 dígitos del celular: la lista se reduce.
4. «Seleccionar» → marcar los dos → «Asignar a» Supervisor → «Reasignar» → confirmar: «✓ 2 reasignados» y cada fila
   dice «Reasignado a Supervisor Verdolago». Los números de la auxiliar en Actividad no cambian.
5. Como `sup.verdolago`, en «Mis contactos», buscar por nombre o celular: aparecen los dos clientes recibidos. Marcar
   «Ver cerrados anteriores» y buscar: esa lista también se filtra.
