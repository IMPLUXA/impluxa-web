-- v030_018 — F3: reserva ANONIMA self-service. RPC publica `public_crear_reserva`.
--
-- APPROACH B (decision CEO C-2): funcion SEPARADA que ESPEJA el motor `agency_crear_reserva`
-- (v030_012) byte-fiel en lo que importa para la integridad — NO se toca el motor de plata vivo.
--   * Lock-key BYTE-IDENTICO al motor: hashtextextended(tenant||':'||excursion||':'||date, 0).
--     => anon + agency serializan en el MISMO advisory-lock => SIN oversell cruzado entre los 2 paths.
--   * Predicado de cupo IDENTICO: SUM(rp.qty) de reservas activas (reserva + pre_reserva hold-vivo).
--   * Precio IDENTICO: centavos enteros desde excursion_rates (server-side; el cliente NUNCA manda monto).
--   * Snapshot/lazy-materialize/reservation_code IDENTICOS.
-- DIFERENCIAS anon (vs el motor authenticated):
--   * Tenant DERIVADO de excursions.tenant_id (server-side), NO de current_active_tenant() (anon no tiene JWT).
--   * SIN guards de rol/staff; seller_staff_id = NULL (no hay vendedor logueado).
--   * Hold = 30 min (no 24h): un anon no debe squatear cupo (decision CEO C-1).
--   * Idempotencia SOPORTADA (dedup de doble-submit anon) via columna + indice unico.
--   * SECURITY DEFINER; GRANT SOLO service_role (NO anon, NO authenticated). El unico caller es el
--     endpoint Next.js server-side (que aplica anti-abuso) via service-role. Grantear a `anon` seria un
--     agujero (saltearia el anti-abuso) — ver el bloque revoke/grant al final.
--
-- El Two-Pass del build verifica: lock-key byte-identico (token-level), tenant no-manipulable, precio
-- no-manipulable, output minimizado. El motor agency_crear_reserva queda INTACTO (cero CREATE OR REPLACE sobre el).

begin;

-- ===== Idempotencia: columna + indice unico parcial (el hueco que el motor reservo para "C14"). =====
-- Additivo: el motor NO escribe esta columna (queda null para reservas de agency). Sin impacto en el motor.
alter table public.reservas add column if not exists idempotency_key text;
create unique index if not exists reservas_tenant_idempotency_idx
  on public.reservas (tenant_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.public_crear_reserva(
  p_excursion_id    uuid,
  p_departure_date  date,
  p_holder_name     text,
  p_pasajeros       jsonb,
  p_holder_email    text default null,
  p_holder_phone    text default null,
  p_holder_lodging  text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant       uuid;
  v_hold_minutes constant integer := 30;   -- C-1: hold corto anon (no 24h)
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
  v_existing     record;
begin
  -- ===== Validaciones fail-fast (identicas al motor) =====
  if p_holder_name is null
     or length(btrim(p_holder_name)) < 1
     or length(p_holder_name) > 200 then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'holder_name requerido (1..200 caracteres)');
  end if;

  if length(coalesce(p_holder_email, '')) > 320
     or length(coalesce(p_holder_phone, '')) > 50
     or length(coalesce(p_holder_lodging, '')) > 200
     or length(coalesce(p_idempotency_key, '')) > 80 then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'campos exceden el largo maximo');
  end if;

  if p_departure_date is null then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'departure_date requerido');
  end if;

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

  -- ===== Tenant DERIVADO del excursion (server-side, NUNCA del cliente). Anti-oraculo: excursion
  -- inexistente = SALIDA_INEXISTENTE (mismo shape que el motor). El cliente no elige ni pasa tenant. =====
  select e.tenant_id, e.capacity_default
    into v_tenant, v_cap_default
    from public.excursions e
   where e.id = p_excursion_id;
  if not found or v_tenant is null then
    return jsonb_build_object('ok', false, 'error_code', 'SALIDA_INEXISTENTE',
      'message', 'salida inexistente');
  end if;

  -- ===== Idempotencia: si ya existe una reserva con esta key (tenant), devolverla (dedup doble-submit). =====
  if p_idempotency_key is not null then
    select r.id, r.reservation_code, r.status, r.hold_expires_at
      into v_existing
      from public.reservas r
     where r.tenant_id = v_tenant
       and r.idempotency_key = p_idempotency_key
     limit 1;
    if found then
      return jsonb_build_object('ok', true, 'reserva_id', v_existing.id,
        'reservation_code', v_existing.reservation_code, 'status', v_existing.status,
        'hold_expires_at', v_existing.hold_expires_at, 'idempotent_replay', true);
    end if;
  end if;

  -- ===== Advisory-lock BYTE-IDENTICO al motor (mismo lock-space => sin oversell cruzado anon/agency). =====
  perform pg_advisory_xact_lock(
    hashtextextended(v_tenant::text || ':' || p_excursion_id::text
                     || ':' || p_departure_date::text, 0));

  -- Ancla time-NULL (slot default diario). Misma logica que el motor.
  select d.id, d.capacity, d.status
    into v_dep_id, v_eff_cap, v_eff_status
    from public.excursion_departures d
   where d.tenant_id = v_tenant
     and d.excursion_id = p_excursion_id
     and d.departure_date = p_departure_date
     and d.departure_time is null
   for update;
  if found then
    v_is_virgin := false;
  else
    v_is_virgin  := true;
    v_dep_id     := null;
    v_eff_status := 'open';
    v_eff_cap    := v_cap_default;
    if v_eff_cap is null then
      return jsonb_build_object('ok', false, 'error_code', 'SALIDA_NO_DISPONIBLE',
        'message', 'la excursion no esta configurada para reservas (sin cupo default)');
    end if;
  end if;

  if v_eff_status <> 'open' then
    return jsonb_build_object('ok', false, 'error_code', 'SALIDA_NO_DISPONIBLE',
      'message', 'la salida no admite reservas',
      'details', jsonb_build_object('status', v_eff_status));
  end if;

  v_salida_ts := (p_departure_date + time '23:59')
                   at time zone 'America/Argentina/Buenos_Aires';
  if v_salida_ts <= now() then
    return jsonb_build_object('ok', false, 'error_code', 'SALIDA_NO_DISPONIBLE',
      'message', 'la salida ya ocurrio');
  end if;

  v_hold := least(now() + make_interval(mins => v_hold_minutes), v_salida_ts);
  if v_hold <= now() then
    return jsonb_build_object('ok', false, 'error_code', 'SALIDA_NO_DISPONIBLE',
      'message', 'hold invalido para esta salida');
  end if;

  -- ===== Tarifa VIGENTE — PRECIO 100% SERVER-SIDE (el cliente NUNCA manda monto). =====
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

  -- ===== Categorias + pricing en centavos enteros (identico al motor). =====
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

  -- ===== Anti-oversell — predicado IDENTICO al motor (cupo tomado = Σ qty activas del ancla). =====
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

  -- ===== Lazy-materialize del ancla (identico al motor). =====
  if v_is_virgin then
    insert into public.excursion_departures
      (tenant_id, excursion_id, departure_date, departure_time, capacity, status)
    values
      (v_tenant, p_excursion_id, p_departure_date, null, v_eff_cap, 'open')
    returning id into v_dep_id;
  end if;

  -- ===== reservation_code (identico al motor) + idempotency_key. seller_staff_id = NULL (anon). =====
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
         commission_ruleset_id, hold_expires_at, idempotency_key)
      values
        (v_tenant, v_dep_id, null,
         btrim(p_holder_name),
         nullif(btrim(coalesce(p_holder_email, '')), ''),
         nullif(btrim(coalesce(p_holder_phone, '')), ''),
         nullif(btrim(coalesce(p_holder_lodging, '')), ''),
         'pre_reserva', v_code,
         'ARS', 1.000000,
         v_gross_cents / 100.0, v_prov_total / 100.0,
         (v_gross_cents - v_prov_total) / 100.0,
         null, v_hold, p_idempotency_key)
      returning id into v_reserva_id;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = CONSTRAINT_NAME;
      -- Idempotencia: si dos submits con la MISMA key corren a la par, el 2do choca el indice
      -- unico -> devolver la reserva ya creada (dedup, no error).
      if v_constraint = 'reservas_tenant_idempotency_idx' then
        select r.id, r.reservation_code, r.status, r.hold_expires_at
          into v_existing
          from public.reservas r
         where r.tenant_id = v_tenant and r.idempotency_key = p_idempotency_key
         limit 1;
        return jsonb_build_object('ok', true, 'reserva_id', v_existing.id,
          'reservation_code', v_existing.reservation_code, 'status', v_existing.status,
          'hold_expires_at', v_existing.hold_expires_at, 'idempotent_replay', true);
      end if;
      if v_constraint is distinct from 'reservas_tenant_id_reservation_code_key' then
        raise;
      end if;
      if v_intento = 5 then
        raise exception 'reservation_code: reintentos agotados' using errcode = '40001';
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

  -- Audit (anon: actor null, role 'public_anon'). Falla de audit = WARNING, jamas voltea la reserva.
  begin
    perform public.append_audit(jsonb_build_object(
      'actor_user_id', null,
      'acting_as_tenant_id', v_tenant::text,
      'acting_as_role', 'public_anon',
      'action', 'reserva_publica_creada',
      'resource_type', 'reserva',
      'resource_id', v_reserva_id::text,
      'metadata', jsonb_build_object(
        'reservation_code', v_code,
        'departure_id', v_dep_id,
        'gross_cents', (v_gross_cents)::bigint)));
  exception when others then
    raise warning 'public_crear_reserva: append_audit fallo (%) — reserva % creada igual',
      sqlerrm, v_reserva_id;
  end;

  -- Output MINIMIZADO: solo lo que el turista necesita (codigo + hold + total). Sin PII, sin datos de otras reservas.
  return jsonb_build_object(
    'ok', true,
    'reserva_id', v_reserva_id,
    'reservation_code', v_code,
    'status', 'pre_reserva',
    'hold_expires_at', v_hold,
    'currency', 'ARS',
    'gross_cents', (v_gross_cents)::bigint,
    'pasajeros', v_out_pax);
end;
$$;

-- GRANT SOLO service_role. **NO anon, NO authenticated.** El flujo público pasa SIEMPRE por el endpoint
-- Next.js server-side (que aplica rate-limit + Turnstile + honeypot) y desde ahí service-role llama la RPC.
-- Si se granteara a `anon`, un atacante con el anon-key público (que vive en el browser) llamaría la RPC
-- DIRECTO, salteando el endpoint y por ende el anti-abuso → spam libre. Por eso la superficie pública es el
-- ENDPOINT (gateado), no la RPC. El motor agency_crear_reserva queda INTACTO (cero CREATE OR REPLACE sobre él).
revoke execute on function public.public_crear_reserva(uuid, date, text, jsonb, text, text, text, text) from public;
revoke execute on function public.public_crear_reserva(uuid, date, text, jsonb, text, text, text, text) from anon;
revoke execute on function public.public_crear_reserva(uuid, date, text, jsonb, text, text, text, text) from authenticated;
grant  execute on function public.public_crear_reserva(uuid, date, text, jsonb, text, text, text, text) to service_role;

commit;
