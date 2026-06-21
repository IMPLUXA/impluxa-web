-- v030_014 — F1b.1: read-model COMPARTIDO del calendario abierto-por-defecto.
--
-- READ-ONLY, additiva (no toca tablas ni RLS). Fuente UNICA del cupo por (excursion, fecha):
-- el predicado de cupo es copia EXACTA del motor F1a `agency_crear_reserva` (v030_012 L290-297):
-- cap efectivo = ancla.capacity (override) o capacity_default(50) si virgen; tomado = SUM(rp.qty)
-- de reservas ACTIVAS (status='reserva' OR (pre_reserva AND hold_expires_at>now())).
--
-- SPARSE: solo devuelve filas para anclas time-NULL que EXISTEN en la ventana. Los dias
-- virgenes (sin fila) NO se enumeran -> el front los pinta abierto cap=capacity_default. Abrir
-- 365 dias = 1 sola query, 0 filas creadas (no materializa).
--
-- SPLIT core/wrapper (diseno 2 pasos adelante, condicion CEO F1b.1): la logica vive UNA vez en
-- `_agency_calendario_core(p_tenant, ...)`. El wrapper `agency_calendario_salidas` deriva
-- tenant+rol del JWT (panel: vendedor/encargado/dueno_admin) y llama al core. Cuando F2 (publico)
-- lo reuse, su wrapper anon llama al MISMO core con el tenant del contexto publico -> cero cupo
-- duplicado. El core NO es callable directo (revoke all): solo via los wrappers DEFINER.
--
-- Two-Pass cold s59 (a5d9bc5...): F3 taken=SUM(rp.qty) activas (no count); F4 legacy excluye
-- cancelled. Plegados aca.

begin;

-- ===== CORE: toma tenant como PARAMETRO (no del JWT). Privado: revoke all, solo via wrappers. =====
create or replace function public._agency_calendario_core(
  p_tenant       uuid,
  p_excursion_id uuid,
  p_from         date,
  p_to           date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_cap_def integer;
  v_dias    jsonb;
  v_legacy  jsonb;
begin
  -- Ventana acotada (anti-abuso; el panel pide ~1 mes, el horizonte es 1 anio).
  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 366 then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'rango de fechas invalido (from<=to, <=366 dias)');
  end if;

  -- Excursion del tenant + capacity_default (anti-oraculo: ajena/inexistente = mismo codigo).
  select e.capacity_default into v_cap_def
    from public.excursions e
   where e.id = p_excursion_id and e.tenant_id = p_tenant;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'SALIDA_INEXISTENTE',
      'message', 'excursion inexistente');
  end if;

  -- DIAS = anclas time-NULL existentes en la ventana (SPARSE). estado: closed (closed/cancelled),
  -- limited (cap != default), open. taken = motor F1a verbatim. Filtro tenant explicito (DEFINER
  -- bypassa RLS; cinturon anti cross-tenant, igual que el motor).
  select coalesce(jsonb_agg(jsonb_build_object(
           'departure_id', d.id,
           'fecha',        d.departure_date,
           'eff_cap',      d.capacity,
           'taken',        t.taken,
           'restante',     greatest(d.capacity - t.taken, 0),
           'estado',       case
                             when d.status in ('closed','cancelled') then 'closed'
                             when d.capacity is distinct from v_cap_def then 'limited'
                             else 'open'
                           end,
           'status_raw',   d.status
         ) order by d.departure_date), '[]'::jsonb)
    into v_dias
    from public.excursion_departures d
    cross join lateral (
      select coalesce(sum(rp.qty), 0)::int as taken
        from public.reservas rv
        join public.reserva_pasajeros rp on rp.reserva_id = rv.id
       where rv.departure_id = d.id
         and rv.tenant_id = p_tenant
         and rp.tenant_id = p_tenant
         and (rv.status = 'reserva'
              or (rv.status = 'pre_reserva' and rv.hold_expires_at > now()))
    ) t
   where d.tenant_id = p_tenant
     and d.excursion_id = p_excursion_id
     and d.departure_time is null
     and d.departure_date between p_from and p_to;

  -- HORARIOS_LEGACY = filas time-specificas (time NOT NULL), EXCLUYE cancelled (FIX F4). Pools de
  -- cupo SEPARADOS del ancla (no se suman). Para el marcador "+N horarios" + el day-detail (F1b.3).
  select coalesce(jsonb_agg(jsonb_build_object(
           'departure_id', d.id,
           'fecha',        d.departure_date,
           'hora',         to_char(d.departure_time, 'HH24:MI'),
           'eff_cap',      d.capacity,
           'taken',        t.taken,
           'restante',     greatest(d.capacity - t.taken, 0),
           'estado',       case when d.status = 'closed' then 'closed' else 'open' end,
           'status_raw',   d.status
         ) order by d.departure_date, d.departure_time), '[]'::jsonb)
    into v_legacy
    from public.excursion_departures d
    cross join lateral (
      select coalesce(sum(rp.qty), 0)::int as taken
        from public.reservas rv
        join public.reserva_pasajeros rp on rp.reserva_id = rv.id
       where rv.departure_id = d.id
         and rv.tenant_id = p_tenant
         and rp.tenant_id = p_tenant
         and (rv.status = 'reserva'
              or (rv.status = 'pre_reserva' and rv.hold_expires_at > now()))
    ) t
   where d.tenant_id = p_tenant
     and d.excursion_id = p_excursion_id
     and d.departure_time is not null
     and d.status <> 'cancelled'
     and d.departure_date between p_from and p_to;

  return jsonb_build_object(
    'ok',               true,
    'capacity_default', v_cap_def,
    'dias',             v_dias,
    'horarios_legacy',  v_legacy
  );
end;
$$;

revoke execute on function public._agency_calendario_core(uuid, uuid, date, date) from public;
revoke execute on function public._agency_calendario_core(uuid, uuid, date, date) from anon;
revoke execute on function public._agency_calendario_core(uuid, uuid, date, date) from authenticated;

-- ===== WRAPPER panel: deriva tenant+rol del JWT (authenticated) y llama al core. =====
create or replace function public.agency_calendario_salidas(
  p_excursion_id uuid,
  p_from         date,
  p_to           date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_role   text;
begin
  v_tenant := public.current_active_tenant();
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO',
      'message', 'caller sin tenant activo');
  end if;

  -- Lectura del calendario = cualquier rol de agencia (vendedor incluido: necesita ver cupo
  -- para vender). El cupo es agregado (no expone reservas ajenas individuales).
  v_role := public.current_agency_role();
  if v_role is null or v_role not in ('vendedor','encargado','dueno_admin') then
    return jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO',
      'message', 'caller sin rol de agencia');
  end if;

  return public._agency_calendario_core(v_tenant, p_excursion_id, p_from, p_to);
end;
$$;

revoke execute on function public.agency_calendario_salidas(uuid, date, date) from public;
revoke execute on function public.agency_calendario_salidas(uuid, date, date) from anon;
grant  execute on function public.agency_calendario_salidas(uuid, date, date) to authenticated;

commit;
