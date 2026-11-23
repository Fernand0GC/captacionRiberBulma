-- Diagnóstico spec 019 «Acomodo de tienda» — SOLO LECTURA.
-- Correr en el SQL Editor de producción, cada bloque por separado (el editor muestra solo el último resultado).
-- «read only» hace que Postgres rechace cualquier escritura, por si acaso.

-- 1) Subcanales y canales cuyo nombre se parece a «acomodo» (atrapa variantes de escritura) -------------------
begin read only;
select 'subcanal' as nivel, s.name as estrategia, c.name as canal, sc.name as nombre, sc.id, sc.active as activo,
  sc.uses_goal as usa_meta, sc.uses_share_goal as usa_compartidas, p.full_name as agregado_por,
  (sc.added_at at time zone 'America/La_Paz')::timestamp(0) as agregado_el,
  public.org_norm(sc.name) = public.org_norm('Acomodo de tienda') as coincide_exacto
from public.org_subchannels sc
join public.org_channels c on c.id = sc.channel_id
join public.org_strategies s on s.id = c.strategy_id
left join public.profiles p on p.id = sc.added_by
where public.org_norm(sc.name) like '%acomod%'
union all
select 'canal', s.name, c.name, c.name, c.id, c.active, c.uses_goal, c.uses_share_goal, null, null,
  public.org_norm(c.name) = public.org_norm('Acomodo de tienda')
from public.org_channels c
join public.org_strategies s on s.id = c.strategy_id
where public.org_norm(c.name) like '%acomod%'
order by 1 desc, 2, 3;
rollback;

-- 2) Asignaciones que usan esos subcanales: cuántas, fechas, sucursales, metas, resultados y verificación -------
begin read only;
select s.name as estrategia, c.name as canal, sc.name as subcanal, sc.id as subcanal_id,
  count(*) as asignaciones,
  min(a.work_date) as primera_fecha, max(a.work_date) as ultima_fecha,
  count(*) filter (where a.work_date >= (now() at time zone 'America/La_Paz')::date) as de_hoy_o_futuras,
  string_agg(distinct b.name, ', ') as sucursales,
  count(a.goal) as con_meta, coalesce(sum(a.goal), 0) as suma_meta,
  count(a.result) as con_resultado, coalesce(sum(a.result), 0) as suma_resultado,
  count(a.share_goal) as con_meta_compartidas, coalesce(sum(a.share_goal), 0) as suma_meta_compartidas,
  count(a.share_result) as con_resultado_compartidas, coalesce(sum(a.share_result), 0) as suma_resultado_compartidas,
  count(a.share_verified) as verificadas_cobros, coalesce(sum(a.share_verified), 0) as suma_verificadas,
  count(*) filter (where a.batch_id is not null) as en_lote,
  count(*) filter (where cardinality(a.flyer_ids) > 0) as con_volanteras
from public.org_assignments a
join public.org_subchannels sc on sc.id = a.subchannel_id
join public.org_channels c on c.id = a.channel_id
join public.org_strategies s on s.id = a.strategy_id
join public.branches b on b.id = a.branch_id
where public.org_norm(sc.name) = public.org_norm('Acomodo de tienda')
group by s.name, c.name, sc.name, sc.id
order by asignaciones desc;
rollback;

-- 3) Choques: asignaciones que quedarían iguales a otra al pasar al canal nuevo -------------------------------
-- (misma sucursal, día, persona, turno y horario; ambas «Acomodo» o una ya en un canal «Acomodo de tienda»)
begin read only;
with moved as (
  select a.id, a.branch_id, a.work_date, a.profile_id, a.shift, a.start_time, a.end_time
  from public.org_assignments a
  left join public.org_subchannels sc on sc.id = a.subchannel_id
  join public.org_channels c on c.id = a.channel_id
  where public.org_norm(sc.name) = public.org_norm('Acomodo de tienda')
     or (a.subchannel_id is null and public.org_norm(c.name) = public.org_norm('Acomodo de tienda'))
)
select b.name as sucursal, m.work_date as fecha, p.full_name as persona, m.shift as turno,
  to_char(m.start_time, 'HH24:MI') || '–' || to_char(m.end_time, 'HH24:MI') as horario, count(*) as filas
from moved m
join public.branches b on b.id = m.branch_id
join public.profiles p on p.id = m.profile_id
group by b.name, m.work_date, p.full_name, m.shift, m.start_time, m.end_time
having count(*) > 1
order by fecha desc, sucursal, persona;
rollback;
