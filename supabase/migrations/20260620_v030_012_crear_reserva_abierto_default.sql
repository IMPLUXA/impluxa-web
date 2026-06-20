-- v030_012 — F1a abierto-por-defecto: refactor agency_crear_reserva.
-- Cambio de input a la clave natural (excursion, fecha) + lazy-materialize del
-- ancla time-NULL (slot default diario). Advisory-lock por (tenant,excursion,fecha)
-- reemplaza el FOR UPDATE sobre la fila sembrada (no existe en fecha virgen).
-- Cupo efectivo = override (si la fila existe) o capacity_default(50) si virgen.
-- BACKWARD-COMPAT: una fecha con fila time-NULL ya existente usa SU capacity/status
-- (identico a hoy); las salidas multi-horario existentes (time NOT NULL) quedan como
-- overrides SEPARADOS, intactos; las reservas vivas NO se tocan (solo se crean nuevas).
-- DUAL-SIGNATURE (transicion zero-window, plata viva): la nueva (excursion, fecha) se
-- CREA AL LADO de la vieja (p_departure_id) SIN dropearla. Las dos coexisten durante el
-- cutover del caller del panel; la vieja se dropea en un release POSTERIOR (F1a+1,
-- post-cutover verificado). Asi el booking presencial nunca llama una signature
-- inexistente (no hay ventana de function-not-found en prod).

begin;

create or replace function public.agency_crear_reserva(
  p_excursion_id    uuid,
  p_departure_date  date,
  p_holder_name     text,
  p_pasajeros       jsonb,
  p_holder_email    text default null,
  p_holder_phone    text default null,
  p_holder_lodging  text default null,
  p_hold_hours      integer default 24,
  p_seller_staff_id uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant       uuid;
  v_role         text;
  v_caller_staff uuid;
  v_seller       uuid;
  v_hold_hours   integer;
  v_cap_default  integer;
  v_dep_id       uuid;
  v_eff_cap      integer;
  v_eff_status   text;
  v_is_virgin    boolean;
  v_salida_ts    timestamptz;
  v_hold         timestamptz;
  v_rate         record;
  v_elem         jsonb;
  v_code_cat     text;
  v_cat_id       uuid;
  v_factor       numeric;
  v_qty          integer;
  v_pax          jsonb := '[]'::jsonb;
  v_base_cents   numeric;
  v_prov_cents   numeric;
  v_factor_bp    numeric;
  v_unit_cents   numeric;
  v_unit_prov    numeric;
  v_solicitado   integer := 0;
  v_gross_cents  numeric := 0;
  v_prov_total   numeric := 0;
  v_tomado       integer;
  v_code         text;
  v_reserva_id   uuid;
  v_intento      integer;
  v_constraint   text;
  v_out_pax      jsonb := '[]'::jsonb;
begin
  -- ===== Validaciones fail-fast (ANTES del lock y de todo INSERT) =====
  if p_holder_name is null
     or length(btrim(p_holder_name)) < 1
     or length(p_holder_name) > 200 then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'holder_name requerido (1..200 caracteres)');
  end if;

  if p_idempotency_key is not null then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'idempotency_key no soportado en v1 (reservado para C14)');
  end if;

  if length(coalesce(p_holder_email, '')) > 320
     or length(coalesce(p_holder_phone, '')) > 50
     or length(coalesce(p_holder_lodging, '')) > 200 then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'holder_email/phone/lodging exceden el largo maximo');
  end if;

  if p_departure_date is null then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'departure_date requerido');
  end if;

  v_hold_hours := greatest(1, least(72, coalesce(p_hold_hours, 24)));

  if p_pasajeros is null or jsonb_typeof(p_pasajeros) <> 'array'
     or jsonb_array_length(p_pasajeros) < 1
     or jsonb_array_length(p_pasajeros) > 20 then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'pasajeros: array de 1..20 items {categoria, qty}');
  end if;

  for v_elem in select value from jsonb_array_elements(p_pasajeros) loop
    if jsonb_typeof(v_elem) <> 'object'
       or (select count(*) from jsonb_object_keys(v_elem)) <> 2
       or not (v_elem ? 'categoria') or not (v_elem ? 'qty')
       or jsonb_typeof(v_elem -> 'categoria') <> 'string'
       or jsonb_typeof(v_elem -> 'qty') <> 'number'
       or not ((v_elem ->> 'qty') ~ '^[0-9]{1,3}$') then
      return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
        'message', 'cada pasajero = {categoria: code, qty: entero 1..999}');
    end if;
    v_qty := (v_elem ->> 'qty')::integer;
    if v_qty < 1 then
      return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
        'message', 'qty debe ser >= 1');
    end if;
    v_solicitado := v_solicitado + v_qty;
  end loop;

  if (select count(distinct e.value ->> 'categoria')
        from jsonb_array_elements(p_pasajeros) e)
     <> jsonb_array_length(p_pasajeros) then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'categorias repetidas en pasajeros');
  end if;

  -- ===== Guards de identidad (B3) =====
  v_tenant := public.current_active_tenant();
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO',
      'message', 'caller sin tenant activo');
  end if;

  v_role := public.current_agency_role();
  if v_role is null
     or v_role not in ('vendedor', 'encargado', 'dueno_admin') then
    return jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO',
      'message', 'caller sin rol de agencia');
  end if;

  select s.id into v_caller_staff
    from public.agency_staff s
   where s.member_user_id = auth.uid()
     and s.tenant_id = v_tenant
     and s.active = true
   limit 1;
  if v_caller_staff is null then
    return jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO',
      'message', 'caller sin staff activo');
  end if;

  if v_role = 'vendedor' then
    if p_seller_staff_id is not null
       and p_seller_staff_id <> v_caller_staff then
      return jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO',
        'message', 'vendedor no puede atribuir la venta a otro staff');
    end if;
    v_seller := v_caller_staff;
  elsif p_seller_staff_id is null then
    v_seller := v_caller_staff;
  else
    select s.id into v_seller
      from public.agency_staff s
     where s.id = p_seller_staff_id
       and s.tenant_id = v_tenant
       and s.active = true;
    if v_seller is null then
      return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
        'message', 'seller_staff_id invalido');
    end if;
  end if;

  -- ===== Excursion: existe + tenant + capacity_default (anti-oraculo: ajena o
  -- inexistente = MISMO codigo SALIDA_INEXISTENTE) =====
  select e.capacity_default into v_cap_default
    from public.excursions e
   where e.id = p_excursion_id
     and e.tenant_id = v_tenant;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'SALIDA_INEXISTENTE',
      'message', 'salida inexistente');
  end if;

  -- ===== Advisory-lock por (tenant, excursion, fecha): serializa los primeros
  -- bookings concurrentes de una fecha VIRGEN (el unique con time NULL no los
  -- protege: NULLs distintos en PG). Reemplaza el FOR UPDATE sobre fila sembrada. =====
  perform pg_advisory_xact_lock(
    hashtextextended(v_tenant::text || ':' || p_excursion_id::text
                     || ':' || p_departure_date::text, 0));

  -- Ancla = slot DEFAULT diario (time NULL) de (excursion, fecha). Las salidas con
  -- hora explicita (time NOT NULL) son overrides SEPARADOS, no entran aca.
  select d.id, d.capacity, d.status
    into v_dep_id, v_eff_cap, v_eff_status
    from public.excursion_departures d
   where d.tenant_id = v_tenant
     and d.excursion_id = p_excursion_id
     and d.departure_date = p_departure_date
     and d.departure_time is null
   for update;
  if found then
    v_is_virgin := false;  -- override existente: usa SU capacity/status (backward-compat)
  else
    -- Virgen: el ancla aun no existe; el cupo sale del default de la excursion.
    v_is_virgin  := true;
    v_dep_id     := null;
    v_eff_status := 'open';
    v_eff_cap    := v_cap_default;
    if v_eff_cap is null then
      -- excursion sin capacity_default = NO configurada para open-booking.
      return jsonb_build_object('ok', false, 'error_code', 'SALIDA_NO_DISPONIBLE',
        'message', 'la excursion no esta configurada para reservas (sin cupo default)');
    end if;
  end if;

  if v_eff_status <> 'open' then
    return jsonb_build_object('ok', false, 'error_code', 'SALIDA_NO_DISPONIBLE',
      'message', 'la salida no admite reservas',
      'details', jsonb_build_object('status', v_eff_status));
  end if;

  -- Deadline REAL de la salida en TZ del tenant (slot default = fin del dia 23:59).
  v_salida_ts := (p_departure_date + time '23:59')
                   at time zone 'America/Argentina/Buenos_Aires';
  if v_salida_ts <= now() then
    return jsonb_build_object('ok', false, 'error_code', 'SALIDA_NO_DISPONIBLE',
      'message', 'la salida ya ocurrio');
  end if;

  v_hold := least(now() + make_interval(hours => v_hold_hours), v_salida_ts);
  if v_hold <= now() then
    return jsonb_build_object('ok', false, 'error_code', 'SALIDA_NO_DISPONIBLE',
      'message', 'hold invalido para esta salida');
  end if;

  -- ===== Tarifa VIGENTE (filtro tenant explicito, misma tx) =====
  select r.base_price, r.provider_cost, r.currency
    into v_rate
    from public.excursion_rates r
   where r.excursion_id = p_excursion_id
     and r.tenant_id = v_tenant
     and r.valid_to is null;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'TARIFA_NO_VIGENTE',
      'message', 'la excursion no tiene tarifa vigente');
  end if;
  if v_rate.currency <> 'ARS' then
    return jsonb_build_object('ok', false, 'error_code', 'TARIFA_NO_VIGENTE',
      'message', 'v1 solo opera tarifas ARS',
      'details', jsonb_build_object('currency', v_rate.currency));
  end if;

  -- ===== Categorias + pricing en CENTAVOS ENTEROS (half-up, paridad lib) =====
  v_base_cents := round(v_rate.base_price * 100);
  v_prov_cents := round(coalesce(v_rate.provider_cost, 0) * 100);

  for v_elem in select value from jsonb_array_elements(p_pasajeros) loop
    v_code_cat := v_elem ->> 'categoria';
    v_qty := (v_elem ->> 'qty')::integer;

    select pc.id, pc.price_factor
      into v_cat_id, v_factor
      from public.passenger_categories pc
     where pc.tenant_id = v_tenant
       and pc.code = v_code_cat;
    if not found or v_factor is null then
      return jsonb_build_object('ok', false, 'error_code', 'CATEGORIA_INVALIDA',
        'message', 'categoria de pasajero invalida',
        'details', jsonb_build_object('categoria', v_code_cat));
    end if;

    v_factor_bp  := round(v_factor * 10000);
    v_unit_cents := round((v_base_cents * v_factor_bp) / 10000.0);
    v_unit_prov  := round((v_prov_cents * v_factor_bp) / 10000.0);
    v_gross_cents := v_gross_cents + (v_unit_cents * v_qty);
    v_prov_total  := v_prov_total + (v_unit_prov * v_qty);

    v_pax := v_pax || jsonb_build_object(
      'category_id', v_cat_id, 'categoria', v_code_cat, 'qty', v_qty,
      'unit_cents', v_unit_cents);
  end loop;

  -- ===== Anti-oversell. Cupo tomado = Σ qty activas (confirmadas + pre_reserva
  -- hold vigente) del ANCLA. Virgen => 0 (todavia no hay fila ni reservas). El
  -- filtro tenant explicito es cinturon contra filas cross-tenant (DEFINER bypassa RLS). =====
  if v_is_virgin then
    v_tomado := 0;
  else
    select coalesce(sum(rp.qty), 0) into v_tomado
      from public.reservas rv
      join public.reserva_pasajeros rp on rp.reserva_id = rv.id
     where rv.departure_id = v_dep_id
       and rv.tenant_id = v_tenant
       and rp.tenant_id = v_tenant
       and (rv.status = 'reserva'
            or (rv.status = 'pre_reserva' and rv.hold_expires_at > now()));
  end if;

  if v_tomado + v_solicitado > v_eff_cap then
    return jsonb_build_object('ok', false, 'error_code', 'CUPO_INSUFICIENTE',
      'message', 'cupo insuficiente para la salida',
      'details', jsonb_build_object(
        'solicitado', v_solicitado,
        'disponible', greatest(v_eff_cap - v_tomado, 0)));
  end if;

  -- ===== Lazy-materialize: si la fecha es virgen, recien ahora (cupo OK, bajo el
  -- advisory-lock) creamos el ancla time-NULL con el cupo default. Evita anclas
  -- huerfanas en caminos de rechazo. =====
  if v_is_virgin then
    insert into public.excursion_departures
      (tenant_id, excursion_id, departure_date, departure_time, capacity, status)
    values
      (v_tenant, p_excursion_id, p_departure_date, null, v_eff_cap, 'open')
    returning id into v_dep_id;
  end if;

  -- ===== reservation_code: 6 chars sin ambiguos, unico por tenant. Retry SOLO
  -- por colision de ESE constraint. =====
  for v_intento in 1..5 loop
    v_code := (
      select string_agg(
               substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
                      1 + floor(random() * 31)::int, 1), '')
        from generate_series(1, 6));
    begin
      insert into public.reservas
        (tenant_id, departure_id, seller_staff_id,
         holder_name, holder_email, holder_phone, holder_lodging,
         status, reservation_code,
         snapshot_currency, snapshot_fx_rate,
         snapshot_gross, snapshot_provider_cost, snapshot_net,
         commission_ruleset_id, hold_expires_at)
      values
        (v_tenant, v_dep_id, v_seller,
         btrim(p_holder_name),
         nullif(btrim(coalesce(p_holder_email, '')), ''),
         nullif(btrim(coalesce(p_holder_phone, '')), ''),
         nullif(btrim(coalesce(p_holder_lodging, '')), ''),
         'pre_reserva', v_code,
         'ARS', 1.000000,
         v_gross_cents / 100.0, v_prov_total / 100.0,
         (v_gross_cents - v_prov_total) / 100.0,
         null, v_hold)
      returning id into v_reserva_id;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = CONSTRAINT_NAME;
      if v_constraint is distinct from 'reservas_tenant_id_reservation_code_key' then
        raise;
      end if;
      if v_intento = 5 then
        raise exception 'reservation_code: reintentos agotados'
          using errcode = '40001';
      end if;
    end;
  end loop;

  for v_elem in select value from jsonb_array_elements(v_pax) loop
    insert into public.reserva_pasajeros
      (tenant_id, reserva_id, passenger_category_id, full_name, unit_price, qty)
    values
      (v_tenant, v_reserva_id, (v_elem ->> 'category_id')::uuid, null,
       (v_elem ->> 'unit_cents')::numeric / 100.0,
       (v_elem ->> 'qty')::integer);
    v_out_pax := v_out_pax || jsonb_build_object(
      'categoria', v_elem ->> 'categoria',
      'qty', (v_elem ->> 'qty')::integer,
      'unit_price_cents', ((v_elem ->> 'unit_cents')::numeric)::bigint);
  end loop;

  -- Audit trail (falla de audit = WARNING, jamas voltea la reserva).
  begin
    perform public.append_audit(jsonb_build_object(
      'actor_user_id', auth.uid()::text,
      'acting_as_tenant_id', v_tenant::text,
      'acting_as_role', v_role,
      'action', 'reserva_creada',
      'resource_type', 'reserva',
      'resource_id', v_reserva_id::text,
      'metadata', jsonb_build_object(
        'reservation_code', v_code,
        'departure_id', v_dep_id,
        'seller_staff_id', v_seller,
        'gross_cents', (v_gross_cents)::bigint)));
  exception when others then
    raise warning 'agency_crear_reserva: append_audit fallo (%) — reserva % creada igual',
      sqlerrm, v_reserva_id;
  end;

  return jsonb_build_object(
    'ok', true,
    'reserva_id', v_reserva_id,
    'reservation_code', v_code,
    'status', 'pre_reserva',
    'hold_expires_at', v_hold,
    'currency', 'ARS',
    'gross_cents', (v_gross_cents)::bigint,
    'provider_cost_cents', (v_prov_total)::bigint,
    'net_cents', (v_gross_cents - v_prov_total)::bigint,
    'cupo_restante', v_eff_cap - v_tomado - v_solicitado,
    'pasajeros', v_out_pax);
end;
$$;

revoke execute on function public.agency_crear_reserva(uuid, date, text, jsonb, text, text, text, integer, uuid, text) from public;
revoke execute on function public.agency_crear_reserva(uuid, date, text, jsonb, text, text, text, integer, uuid, text) from anon;
grant  execute on function public.agency_crear_reserva(uuid, date, text, jsonb, text, text, text, integer, uuid, text) to authenticated;

commit;
