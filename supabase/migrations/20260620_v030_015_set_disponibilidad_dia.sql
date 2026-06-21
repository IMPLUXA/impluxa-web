-- v030_015 — F1b.2: acciones del calendario abierto-por-defecto (cerrar / limitar / reabrir).
--
-- MUTA disponibilidad real de salidas. Materializa-o-patchea el ancla time-NULL de (excursion,
-- fecha) BAJO EL MISMO advisory-lock del motor F1a `agency_crear_reserva` (v030_012 L188-190) =>
-- mismo lock space => un booking concurrente sobre ese (excursion, fecha) se serializa (no race,
-- no doble-ancla: el UNIQUE no caza time-NULL, el lock es el unico guard - FIX F2 del Two-Pass).
--
-- LOCK KEY: inline byte-identico al motor `hashtextextended(tenant::text || ':' || excursion::text
-- || ':' || fecha::text, 0)` (seed 0). El substrato asserta igualdad con la expresion del motor.
-- (Follow-up posible: extraer un helper inmutable compartido y migrar el motor a usarlo - toca el
-- motor de plata => su propio Two-Pass; NO en F1b.2.)
--
-- ESCRITURA = encargado/dueno_admin (espeja las RLS write; vendedor NO). DEFINER + tenant explicito.
--
-- Acciones:
--   cerrar  : materializa/patchea el ancla a status=closed (no toca reservas existentes; el motor
--             rechaza NUEVOS bookings sobre un ancla closed). Sin guardrail (no baja cupo).
--   limitar : materializa/patchea capacity=N, status=open. GUARDRAIL DURO: N >= cupo ya TOMADO
--             (activas: status reserva/pre_reserva-hold-vivo, predicado del motor) o rechaza
--             CUPO_MENOR_A_RESERVADO. Toca plata indirecta (disponibilidad de lo que se vende).
--   reabrir : vuelve al default (open, cap_default). FK NO ACTION: si el ancla tiene CUALQUIER
--             reserva (COUNT(*) todas, no solo activas - FIX F1) NO se puede DELETE -> PATCH a
--             open/cap_default. Si 0 reservas -> DELETE (vuelve a virgen). Virgen -> noop.

begin;

create or replace function public.agency_set_disponibilidad_dia(
  p_excursion_id   uuid,
  p_departure_date date,
  p_accion         text,
  p_capacity       integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant     uuid;
  v_role       text;
  v_cap_def    integer;
  v_dep_id     uuid;
  v_is_virgin  boolean;
  v_taken      integer;
  v_rows_total integer;
  v_estado     text;
  v_eff_cap    integer;
begin
  -- ===== Guards =====
  v_tenant := public.current_active_tenant();
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO',
      'message', 'caller sin tenant activo');
  end if;

  v_role := public.current_agency_role();
  if v_role is null or v_role not in ('encargado','dueno_admin') then
    return jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO',
      'message', 'rol sin permiso de edicion de salidas');
  end if;

  if p_accion is null or p_accion not in ('cerrar','limitar','reabrir') then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'accion invalida (cerrar|limitar|reabrir)');
  end if;
  if p_departure_date is null then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'departure_date requerido');
  end if;
  if p_accion = 'limitar'
     and (p_capacity is null or p_capacity < 0 or p_capacity > 999) then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'capacity requerido (0..999) para limitar');
  end if;

  -- Excursion del tenant + capacity_default (anti-oraculo: ajena/inexistente = mismo codigo).
  select e.capacity_default into v_cap_def
    from public.excursions e
   where e.id = p_excursion_id and e.tenant_id = v_tenant;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'SALIDA_INEXISTENTE',
      'message', 'excursion inexistente');
  end if;
  if v_cap_def is null then
    return jsonb_build_object('ok', false, 'error_code', 'SALIDA_NO_DISPONIBLE',
      'message', 'la excursion no esta configurada para reservas (sin cupo default)');
  end if;

  -- ===== Advisory-lock (MISMA expresion que el motor F1a) =====
  perform pg_advisory_xact_lock(
    hashtextextended(v_tenant::text || ':' || p_excursion_id::text
                     || ':' || p_departure_date::text, 0));

  -- Ancla time-NULL FOR UPDATE (igual que el motor).
  select d.id into v_dep_id
    from public.excursion_departures d
   where d.tenant_id = v_tenant
     and d.excursion_id = p_excursion_id
     and d.departure_date = p_departure_date
     and d.departure_time is null
   for update;
  v_is_virgin := not found;

  -- Cupo TOMADO activo (guardrail limitar) — predicado del motor F1a. Virgen => 0.
  if v_is_virgin then
    v_taken := 0;
  else
    select coalesce(sum(rp.qty), 0)::int into v_taken
      from public.reservas rv
      join public.reserva_pasajeros rp on rp.reserva_id = rv.id
     where rv.departure_id = v_dep_id
       and rv.tenant_id = v_tenant
       and rp.tenant_id = v_tenant
       and (rv.status = 'reserva'
            or (rv.status = 'pre_reserva' and rv.hold_expires_at > now()));
  end if;

  -- ===== Branch por accion =====
  if p_accion = 'cerrar' then
    if v_is_virgin then
      insert into public.excursion_departures
        (tenant_id, excursion_id, departure_date, departure_time, capacity, status)
      values (v_tenant, p_excursion_id, p_departure_date, null, v_cap_def, 'closed')
      returning id into v_dep_id;
    else
      update public.excursion_departures set status = 'closed' where id = v_dep_id;
    end if;

  elsif p_accion = 'limitar' then
    if p_capacity < v_taken then
      return jsonb_build_object('ok', false, 'error_code', 'CUPO_MENOR_A_RESERVADO',
        'message', 'el cupo no puede ser menor a lo ya reservado para ese dia',
        'details', jsonb_build_object('tomado', v_taken, 'intento', p_capacity));
    end if;
    if v_is_virgin then
      insert into public.excursion_departures
        (tenant_id, excursion_id, departure_date, departure_time, capacity, status)
      values (v_tenant, p_excursion_id, p_departure_date, null, p_capacity, 'open')
      returning id into v_dep_id;
    else
      update public.excursion_departures
         set capacity = p_capacity, status = 'open'
       where id = v_dep_id;
    end if;

  else -- 'reabrir'
    if not v_is_virgin then
      -- FK NO ACTION: contar TODAS las reservas (no solo activas; una muerta tambien bloquea DELETE).
      select count(*)::int into v_rows_total
        from public.reservas
       where departure_id = v_dep_id and tenant_id = v_tenant;
      if v_rows_total = 0 then
        delete from public.excursion_departures where id = v_dep_id;
        v_dep_id := null;  -- vuelve a virgen = default open/cap_def
      else
        -- FK NO ACTION: no se puede DELETE con reservas -> reset a default-behavior SIN borrar.
        -- greatest(cap_def, taken) (Two-Pass R1 hardening): nunca deja cap < tomado (jamas oversell;
        -- en el caso normal taken<=cap_def => = cap_def).
        update public.excursion_departures
           set status = 'open', capacity = greatest(v_cap_def, v_taken)
         where id = v_dep_id;
      end if;
    end if;
    -- virgen: ya es default; noop.
  end if;

  -- Estado resultante del dia (para repintar la celda sin re-fetch completo).
  if v_dep_id is null then
    v_estado := 'open';
    v_eff_cap := v_cap_def;
  else
    select case
             when status in ('closed','cancelled') then 'closed'
             when capacity is distinct from v_cap_def then 'limited'
             else 'open'
           end, capacity
      into v_estado, v_eff_cap
      from public.excursion_departures where id = v_dep_id;
  end if;

  -- Audit (falla de audit = WARNING, jamas voltea la accion).
  begin
    perform public.append_audit(jsonb_build_object(
      'actor_user_id', auth.uid()::text,
      'acting_as_tenant_id', v_tenant::text,
      'acting_as_role', v_role,
      'action', 'disponibilidad_dia_' || p_accion,
      'resource_type', 'excursion_departure',
      'resource_id', coalesce(v_dep_id::text, 'deleted'),
      'metadata', jsonb_build_object(
        'excursion_id', p_excursion_id,
        'fecha', p_departure_date,
        'capacity', p_capacity,
        'estado_resultante', v_estado)));
  exception when others then
    raise warning 'agency_set_disponibilidad_dia: append_audit fallo (%)', sqlerrm;
  end;

  return jsonb_build_object(
    'ok',      true,
    'accion',  p_accion,
    'fecha',   p_departure_date,
    'estado',  v_estado,
    'eff_cap', v_eff_cap,
    'taken',   v_taken);
end;
$$;

revoke execute on function public.agency_set_disponibilidad_dia(uuid, date, text, integer) from public;
revoke execute on function public.agency_set_disponibilidad_dia(uuid, date, text, integer) from anon;
grant  execute on function public.agency_set_disponibilidad_dia(uuid, date, text, integer) to authenticated;

commit;
