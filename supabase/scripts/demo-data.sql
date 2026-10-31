-- 50 clientes de prueba (SOLO base local) para ver el panel con datos: últimos 7 días, Verdolago y Trinidad,
-- canales y productos variados, todas las etapas con sus contactos y eventos coherentes. Las de hoy quedan sin
-- asignar (para probar Repartir). Se borra con `pnpm db:clean`. Uso: pnpm db:demo
do $$
declare
  tz constant text := 'America/La_Paz';
  names text[] := array['María','José','Juan','Ana','Luis','Rosa','Carlos','Carmen','Jorge','Lucía','Pedro','Elena','Miguel','Patricia',
                        'Fernando','Silvia','Ricardo','Gladys','Roberto','Martha','Wilson','Sandra','Edwin','Ximena','Freddy','Noemí'];
  lasts text[] := array['Vaca','Rojas','Flores','Mamani','Suárez','Justiniano','Áñez','Roca','Peña','Guzmán','Méndez','Ortiz','Salvatierra',
                        'Cuéllar','Arteaga','Moreno','Vargas','Ribera','Paz','Montaño'];
  ver_authors uuid[] := array['00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000006',
                              '00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000003']::uuid[];
  tri_authors uuid[] := array['00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000007']::uuid[];
  aux_ver constant uuid := '00000000-0000-4000-8000-000000000004';
  enc_tri constant uuid := '00000000-0000-4000-8000-000000000007';
  ch_names text[] := array['Volantes','Volantes','Volantes','Volantes','Activación','Activación','Activación','Visitas de negociación','TikTok','TikTok','Facebook','Messenger','Otro'];
  i int; v_chname text; v_phone text; v_id uuid; v_branch smallint; v_author uuid; v_agent uuid; v_day int; v_at timestamptz; v_ch smallint; v_prod int;
  r float; v_stage public.prospect_stage; v_next timestamptz; v_visit timestamptz; v_c timestamptz; v_attempts int; v_reason int;
begin
  perform setseed(0.42);
  for i in 1 .. 50 loop
    v_id := gen_random_uuid();
    v_branch := case when i % 7 in (0, 3) then 7 else 5 end;
    v_author := case when v_branch = 5 then ver_authors[1 + floor(random() * 5)::int] else tri_authors[1 + floor(random() * 3)::int] end;
    v_agent := case when v_branch = 5 then aux_ver else enc_tri end;
    v_day := case when i <= 9 then 0 else 1 + floor(random() * 6)::int end;   -- 9 de hoy, el resto en los 6 días previos
    v_at := ((((now() at time zone tz)::date - v_day)::timestamp + time '08:30' + (random() * interval '4 hours 30 minutes')) at time zone tz);
    if v_at > now() then v_at := now() - random() * interval '2 hours'; end if;
    -- el sorteo va en una variable: dentro del WHERE se recalcularía por fila
    v_chname := ch_names[1 + floor(random() * array_length(ch_names, 1))::int];
    select id into v_ch from public.channels where name = v_chname;
    v_prod := case when random() < 0.6 then (select id from public.products where active order by random() limit 1) end;

    -- Etapa: hoy sin trabajar; días previos con el embudo realista.
    r := random();
    v_stage := case
      when v_day = 0 then 'capture'
      when r < 0.22 then 'recapture' when r < 0.47 then 'followup' when r < 0.58 then 'interested'
      when r < 0.72 then 'sale' when r < 0.90 then 'lost' else 'capture' end;
    if v_stage = 'sale' and v_prod is null then v_prod := (select id from public.products where name = 'Celulares'); end if;
    v_attempts := case when v_stage = 'recapture' then 1 + floor(random() * 2)::int else 0 end;
    v_visit := case when v_stage in ('followup', 'interested') and random() < 0.5
                    then (((now() at time zone tz)::date + floor(random() * 4)::int)::timestamp + time '10:00' + floor(random() * 7) * interval '1 hour') at time zone tz end;
    -- con visita pactada, el próximo contacto es la visita (igual que add_followup)
    v_next := case when v_visit is not null then v_visit
                   when v_stage in ('recapture', 'followup', 'interested')
                   then (((now() at time zone tz)::date + floor(random() * 3)::int)::timestamp + time '09:00') at time zone tz end;
    v_reason := case when v_stage = 'lost' then (select id from public.lost_reasons where name in ('No le interesa', 'No contesta (3 intentos)', 'Número equivocado') order by random() limit 1) end;
    v_c := v_at + interval '6 hours' + random() * interval '2 hours';   -- contacto por la tarde
    if v_c > now() then v_c := now() - interval '5 minutes'; end if;

    v_phone := (case when random() < 0.5 then '6' else '7' end) || lpad((1000000 + i * 137911 % 8999999)::text, 7, '0');
    insert into public.prospects (id, full_name, phone_raw, phone_norm, product_id, channel_id, interest, branch_id, created_by,
      client_created_at, received_at, shift, stage, stage_changed_at, sold_at, lost_reason_id, assigned_to, next_contact_at,
      contact_attempts, visit_at, updated_by)
    values (v_id, names[1 + floor(random() * array_length(names, 1))::int] || ' ' || lasts[1 + floor(random() * array_length(lasts, 1))::int]
              || ' ' || lasts[1 + floor(random() * array_length(lasts, 1))::int],
            v_phone, v_phone,
            v_prod, v_ch, (array['high','medium','low',null]::public.interest_level[])[1 + floor(random() * 4)::int],
            v_branch, v_author, v_at, v_at, public.shift_for(v_at),
            v_stage, case when v_stage = 'capture' then v_at else v_c end, case when v_stage = 'sale' then v_c end, v_reason,
            case when v_stage = 'capture' then null else v_agent end, v_next, v_attempts, v_visit, v_author);

    insert into public.stage_events (prospect_id, from_stage, to_stage, actor_id, created_at) values (v_id, null, 'capture', v_author, v_at);
    if v_stage <> 'capture' then
      insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at)
        values (v_id, null, v_agent, case when v_branch = 5 then '00000000-0000-4000-8000-000000000003'::uuid else enc_tri end, v_at + interval '5 hours');
      insert into public.followups (id, prospect_id, contacted_at, result, method, effective, note, visit_at, callback_at, actor_id)
        values (gen_random_uuid(), v_id, v_c,
          case v_stage when 'recapture' then 'no_answer' when 'followup' then (case when v_visit is not null then 'visit_store' else 'looking_product' end)
                       when 'interested' then 'very_interested' when 'sale' then 'sold'
                       else (case when random() < 0.5 then 'not_interested' else 'wrong_number' end) end::public.contact_result,
          (array['whatsapp_call','whatsapp_call','whatsapp_call','message','store']::public.contact_method[])[1 + floor(random() * 5)::int],
          v_stage <> 'recapture', case when random() < 0.3 then 'Pidió precio a crédito' end,
          case when v_stage = 'followup' and v_visit is not null then v_visit end, null, v_agent);
      insert into public.stage_events (prospect_id, from_stage, to_stage, lost_reason_id, actor_id, created_at)
        values (v_id, 'capture', v_stage, v_reason, v_agent, v_c);
    end if;
  end loop;
end $$;

-- Metas de ejemplo (el ejemplo del encargado de ventas: 50 captaciones y 20 potenciales por día) y mensual por línea.
insert into public.daily_goal_base (branch_id, captures, potential) values (5, 50, 20), (7, 20, 8)
on conflict (branch_id) do nothing;
insert into public.monthly_goals (branch_id, line, month, units) values
  (5, 'phones', date_trunc('month', now() at time zone 'America/La_Paz')::date, 230),
  (5, 'appliances', date_trunc('month', now() at time zone 'America/La_Paz')::date, 160),
  (7, 'phones', date_trunc('month', now() at time zone 'America/La_Paz')::date, 250),
  (7, 'appliances', date_trunc('month', now() at time zone 'America/La_Paz')::date, 120)
on conflict do nothing;

select 'captaciones: ' || count(*) || ' · sin asignar: ' || count(*) filter (where assigned_to is null)
       || ' · ventas: ' || count(*) filter (where stage = 'sale') as demo
from public.prospects;
