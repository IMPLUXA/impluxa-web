-- #23 v030_002_f3b_rate_engine (UP)
begin;

-- PASO 0: cerrar duplicados vigentes (prerequisito del UNIQUE parcial). Evidencia E0.a: prod=0 filas (no-op).
with ranked as (
  select id,
         row_number() over (
           partition by excursion_id
           order by valid_from desc, created_at desc, id desc
         ) as rn
  from public.excursion_rates
  where valid_to is null
)
update public.excursion_rates e
   set valid_to = now()
  from ranked r
 where e.id = r.id
   and r.rn > 1;

-- PASO 1: UNIQUE parcial — 1 tarifa vigente por excursión.
create unique index excursion_rates_one_current_idx
    on public.excursion_rates (excursion_id)
 where valid_to is null;

-- PASO 2: autoridad dueño-only (decisión CEO s49). AS RESTRICTIVE explícito; ins→WITH CHECK / upd→USING+CHECK / del→USING.
drop policy if exists excursion_rates_tenant_write_ins on public.excursion_rates;
create policy excursion_rates_tenant_write_ins on public.excursion_rates
  as restrictive for insert to authenticated
  with check (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = 'dueno_admin')));

drop policy if exists excursion_rates_tenant_write_upd on public.excursion_rates;
create policy excursion_rates_tenant_write_upd on public.excursion_rates
  as restrictive for update to authenticated
  using      (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = 'dueno_admin')))
  with check (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = 'dueno_admin')));

drop policy if exists excursion_rates_tenant_write_del on public.excursion_rates;
create policy excursion_rates_tenant_write_del on public.excursion_rates
  as restrictive for delete to authenticated
  using (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = 'dueno_admin')));

drop policy if exists passenger_categories_tenant_write_ins on public.passenger_categories;
create policy passenger_categories_tenant_write_ins on public.passenger_categories
  as restrictive for insert to authenticated
  with check (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = 'dueno_admin')));

drop policy if exists passenger_categories_tenant_write_upd on public.passenger_categories;
create policy passenger_categories_tenant_write_upd on public.passenger_categories
  as restrictive for update to authenticated
  using      (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = 'dueno_admin')))
  with check (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = 'dueno_admin')));

drop policy if exists passenger_categories_tenant_write_del on public.passenger_categories;
create policy passenger_categories_tenant_write_del on public.passenger_categories
  as restrictive for delete to authenticated
  using (is_admin() or ((tenant_id = current_active_tenant()) and (current_agency_role() = 'dueno_admin')));

-- PASO 3: RPC agency_set_rate (SECURITY INVOKER, plpgsql).
-- FIX cazado por matriz T2-M1 en preview: created_by FK-ea agency_staff(id), no auth.users.
-- La RPC ahora resuelve el staff row del caller (NULL si no tiene, p.ej. is_admin plataforma).
create or replace function public.agency_set_rate(
  p_excursion_id  uuid,
  p_base_price    numeric,
  p_provider_cost numeric,
  p_currency      text
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_tenant  uuid;
  v_staff   uuid;
  v_now     timestamptz := now();
  v_open    integer;
  v_closed  integer;
  v_new_id  uuid;
begin
  if p_base_price is null or p_base_price <= 0 or not (p_base_price < 1e9) then
    raise exception 'base_price debe ser > 0 y < 1e9' using errcode = '22023';
  end if;
  if p_provider_cost is null or p_provider_cost < 0 or not (p_provider_cost < 1e9) then
    raise exception 'provider_cost debe ser >= 0 y < 1e9' using errcode = '22023';
  end if;
  if p_currency is null or upper(p_currency) !~ '^[A-Z]{3}$' then
    raise exception 'currency debe ser código de 3 letras' using errcode = '22023';
  end if;

  v_tenant := current_active_tenant();
  if v_tenant is null then
    raise exception 'caller sin tenant activo' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.excursions x
     where x.id = p_excursion_id and x.tenant_id = v_tenant
  ) then
    raise exception 'excursión inexistente o fuera del tenant' using errcode = '42501';
  end if;

  -- created_by = fila de agency_staff del caller (FK real). NULL si no tiene (admin plataforma).
  select s.id into v_staff
    from public.agency_staff s
   where s.member_user_id = auth.uid()
     and s.tenant_id = v_tenant
     and s.active = true
   limit 1;

  perform pg_advisory_xact_lock(
    hashtextextended('agency_set_rate:' || p_excursion_id::text, 0)
  );

  select count(*) into v_open
    from public.excursion_rates
   where excursion_id = p_excursion_id and valid_to is null;

  update public.excursion_rates
     set valid_to = v_now
   where excursion_id = p_excursion_id and valid_to is null;
  get diagnostics v_closed = row_count;

  if v_closed <> v_open then
    raise exception 'RLS denegó el cierre: rol sin autoridad de escritura' using errcode = '42501';
  end if;

  begin
    insert into public.excursion_rates
      (tenant_id, excursion_id, base_price, provider_cost, currency, valid_from, valid_to, created_by)
    values
      (v_tenant, p_excursion_id, p_base_price, p_provider_cost, upper(p_currency), v_now, null, v_staff)
    returning id into v_new_id;
  exception
    when unique_violation then
      raise exception 'conflicto concurrente en excursión %; reintentar', p_excursion_id using errcode = '40001';
  end;

  return v_new_id;
end;
$$;

-- PASO 4: grants
revoke execute on function public.agency_set_rate(uuid, numeric, numeric, text) from public;
revoke execute on function public.agency_set_rate(uuid, numeric, numeric, text) from anon;
grant  execute on function public.agency_set_rate(uuid, numeric, numeric, text) to authenticated;

commit;
