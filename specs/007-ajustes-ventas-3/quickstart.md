# Quickstart (007)

## Probar en local
1. `supabase migration up` (o aplicar `20261119000100_ajustes_ventas_3.sql` con psql si la CLI falla por el historial).
2. `pnpm test` (Vitest) y `pnpm exec playwright test tests/e2e/organization.spec.ts --workers=1`.
3. A mano: copiar el día anterior dos veces → la segunda dice «0 copiadas, N ya estaban».

## Revisar duplicados en producción (solo lee)
```sql
select a.work_date, b.name as sucursal, p.full_name, a.shift, a.start_time, a.end_time,
       a.channel_id, a.subchannel_id, count(*) as veces, array_agg(a.id order by a.created_at) as ids
from public.org_assignments a
join public.profiles p on p.id = a.profile_id
join public.branches b on b.id = a.branch_id
where a.work_date >= current_date - 7
group by 1,2,3,4,5,6,7,8
having count(*) > 1
order by 1,2,3;
```
Para limpiar: conservar el primer id de cada grupo y borrar el resto desde la app (botón de borrar) o con un
`delete ... where id = any(...)` revisado fila por fila.
