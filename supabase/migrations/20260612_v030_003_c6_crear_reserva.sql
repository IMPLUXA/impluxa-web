-- #24 v030_003_c6_crear_reserva (UP)
-- C6 del punch-list s48: RPC crear reserva (tx FOR UPDATE + anti-oversell +
-- hold + snapshot congelado). Plan: meta/plan-motor-reservas-s51.md.
--
-- SECURITY DEFINER (corrección BA Pass-1, refutado INVOKER con evidencia:
-- reservas_role_select filtra por seller para vendedor → COUNT subcontaría
-- → oversell; reserva_pasajeros_role_write excluye vendedor → INSERT
-- fallaría). Guards B3 (SE Pass-2): search_path '' + fully-qualified,
-- lecturas internas con filtro tenant explícito, anti-oráculo (inexistente
-- y ajeno = mismo código), jsonb cerrado con bounds, REVOKE en la misma tx.
--
-- CONTRATO TOOL-CALLABLE (doble propósito: function-calling del agente
-- Gemini): errores de NEGOCIO = envelope jsonb {ok:false, error_code} con
-- códigos estables; RAISE solo invariantes/concurrencia (errcode 40001).
-- Montos del envelope en CENTAVOS ENTEROS (boundary numeric, lesson s49).
-- p_idempotency_key RESERVADO: v1 lo RECHAZA si viene non-null (decisión
-- CEO post-preview: contrato honesto > ignorar mudo — un caller que reintenta
-- creyendo idempotencia NO debe duplicar reservas en silencio). La
-- implementación real es PREREQUISITO de C14/agente público.
--
-- Decisiones CEO fijadas (GO s51): TTL hold default 24h clamp 1..72 ·
-- infante (factor 0.0) SÍ ocupa asiento · provider_cost escala por factor.

begin;

create or replace function public.agency_crear_reserva(
  p_departure_id    uuid,
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
  v_dep          record;
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
  -- ===== Validaciones fail-fast (ANTES del lock y de todo INSERT: cero
  -- estado parcial; todo error de negocio retorna envelope) =====
  if p_holder_name is null
     or length(btrim(p_holder_name)) < 1
     or length(p_holder_name) > 200 then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'holder_name requerido (1..200 caracteres)');
  end if;

  -- p_idempotency_key: RESERVADO para C14. v1 lo RECHAZA non-null (decisión
  -- CEO): aceptar el parámetro ignorándolo sería prometer una semántica de
  -- dedup que no existe.
  if p_idempotency_key is not null then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'idempotency_key no soportado en v1 (reservado para C14)');
  end if;

  -- Caps de holder_* (SE riesgo-1 + CR sugerencia-2): columnas text sin
  -- CHECK — el bound vive en el boundary, simétrico con holder_name.
  if length(coalesce(p_holder_email, '')) > 320
     or length(coalesce(p_holder_phone, '')) > 50
     or length(coalesce(p_holder_lodging, '')) > 200 then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'holder_email/phone/lodging exceden el largo maximo');
  end if;

  v_hold_hours := greatest(1, least(72, coalesce(p_hold_hours, 24)));

  if p_pasajeros is null or jsonb_typeof(p_pasajeros) <> 'array'
     or jsonb_array_length(p_pasajeros) < 1
     or jsonb_array_length(p_pasajeros) > 20 then
    return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
      'message', 'pasajeros: array de 1..20 items {categoria, qty}');
  end if;

  -- Estructura CERRADA por item: exactamente {categoria, qty}; qty entero
  -- 1..999 (campos extra o shapes raros = inválido, B3).
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
    -- cinturón: role no-null implica staff row, pero el DEFINER no asume.
    return jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO',
      'message', 'caller sin staff activo');
  end if;

  -- B1 (SE Pass-2): derivación de seller_staff_id.
  -- vendedor → SIEMPRE su propia fila (jamás parámetro);
  -- encargado/dueño → opcional validado (tenant + active), default propia.
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
      -- anti-oráculo: staff ajeno == inexistente, mismo código.
      return jsonb_build_object('ok', false, 'error_code', 'PARAMS_INVALIDOS',
        'message', 'seller_staff_id invalido');
    end if;
  end if;

  -- ===== Salida: lock de la fila ancla (serializa reservas concurrentes y
  -- contiende con el UPDATE de capacity de la UI R1) =====
  select d.id, d.excursion_id, d.departure_date, d.departure_time,
         d.capacity, d.status
    into v_dep
    from public.excursion_departures d
   where d.id = p_departure_id
     and d.tenant_id = v_tenant
   for update;
  if not found then
    -- anti-oráculo: inexistente y cross-tenant = MISMO código.
    return jsonb_build_object('ok', false, 'error_code', 'SALIDA_INEXISTENTE',
      'message', 'salida inexistente');
  end if;

  if v_dep.status <> 'open' then
    return jsonb_build_object('ok', false, 'error_code', 'SALIDA_NO_DISPONIBLE',
      'message', 'la salida no admite reservas',
      'details', jsonb_build_object('status', v_dep.status));
  end if;

  -- B2 (SE Pass-2): deadline REAL de la salida en TZ del tenant. Sin esto,
  -- departure_date (DATE) promovido a medianoche UTC dejaba el hold de una
  -- reserva same-day NACIDO MUERTO → no contaba en el cupo → oversell físico.
  v_salida_ts := (v_dep.departure_date + coalesce(v_dep.departure_time, time '23:59'))
                   at time zone 'America/Argentina/Buenos_Aires';
  if v_salida_ts <= now() then
    return jsonb_build_object('ok', false, 'error_code', 'SALIDA_NO_DISPONIBLE',
      'message', 'la salida ya ocurrio');
  end if;

  v_hold := least(now() + make_interval(hours => v_hold_hours), v_salida_ts);
  if v_hold <= now() then
    -- invariante post-cómputo (regresión B2 de la matriz).
    return jsonb_build_object('ok', false, 'error_code', 'SALIDA_NO_DISPONIBLE',
      'message', 'hold invalido para esta salida');
  end if;

  -- ===== Tarifa VIGENTE (única garantizada por excursion_rates_one_current_idx
  -- de #23), leída dentro de la MISMA tx, filtro tenant explícito =====
  select r.base_price, r.provider_cost, r.currency
    into v_rate
    from public.excursion_rates r
   where r.excursion_id = v_dep.excursion_id
     and r.tenant_id = v_tenant
     and r.valid_to is null;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'TARIFA_NO_VIGENTE',
      'message', 'la excursion no tiene tarifa vigente');
  end if;
  if v_rate.currency <> 'ARS' then
    -- v1 hardcodea ARS/fx=1 (plan s51); otra moneda = sin tarifa usable.
    return jsonb_build_object('ok', false, 'error_code', 'TARIFA_NO_VIGENTE',
      'message', 'v1 solo opera tarifas ARS',
      'details', jsonb_build_object('currency', v_rate.currency));
  end if;

  -- ===== Categorías + pricing en CENTAVOS ENTEROS. Paridad EXACTA con la
  -- lib priceForFactor (half-up, dos pasos): cents = round(base*100);
  -- factor_bp = round(factor*10000); unit = round(cents*factor_bp/10000).
  -- Decisión CEO: provider_cost escala por factor, igual que el precio. =====
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
      -- anti-oráculo: categoría ajena == inexistente (lookup tenant-scoped).
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

  -- ===== Anti-oversell bajo el lock. Cupo tomado = Σ qty de confirmadas +
  -- pre_reservas con hold VIGENTE (hold vencido = liberado por filtro, el
  -- barredor C11 es higiene de UI, no de integridad). Decisión CEO: TODO
  -- qty ocupa asiento, infante (factor 0.0) incluido. =====
  -- B-1 (SE cold pre-ASK): filtro tenant EXPLÍCITO también acá — el DEFINER
  -- bypassa RLS y una fila plantada cross-tenant (FK simple sin atadura de
  -- tenant) contaminaría el count = DoS de inventario. rp.tenant_id es el
  -- cinturón contra denormalización inconsistente escrita por service_role.
  select coalesce(sum(rp.qty), 0) into v_tomado
    from public.reservas rv
    join public.reserva_pasajeros rp on rp.reserva_id = rv.id
   where rv.departure_id = v_dep.id
     and rv.tenant_id = v_tenant
     and rp.tenant_id = v_tenant
     and (rv.status = 'reserva'
          or (rv.status = 'pre_reserva' and rv.hold_expires_at > now()));

  if v_tomado + v_solicitado > v_dep.capacity then
    return jsonb_build_object('ok', false, 'error_code', 'CUPO_INSUFICIENTE',
      'message', 'cupo insuficiente para la salida',
      'details', jsonb_build_object(
        'solicitado', v_solicitado,
        'disponible', greatest(v_dep.capacity - v_tomado, 0)));
  end if;

  -- ===== reservation_code: 6 chars alfabeto sin ambiguos, único por tenant
  -- (UNIQUE ya en schema F1). Retry SOLO si el conflicto es de ESE
  -- constraint (un 23505 de otra fuente se propaga, no consume reintentos). =====
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
        (v_tenant, v_dep.id, v_seller,
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

  -- Pasajeros por categoría. full_name NULL en v1: el contrato no releva
  -- nombres (columna nullable verificada; los nombres llegan con C14/UI).
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

  -- Audit trail (recomendación SE Pass-2: el DEFINER bypassa RLS y congela
  -- snapshots financieros — la creación queda con rastro de actor).
  -- CATCH M1 de la matriz preview: una partición de audit_log faltante
  -- (mes sin rotación) abortaba la reserva ENTERA. El audit JAMÁS voltea
  -- una reserva ya escrita: falla de audit = WARNING ruidoso (observable
  -- en logs Postgres), nunca rollback del negocio, nunca silencio.
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
        'departure_id', v_dep.id,
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
    'cupo_restante', v_dep.capacity - v_tomado - v_solicitado,
    'pasajeros', v_out_pax);
end;
$$;

-- Grants en la MISMA tx del CREATE (B3): cerrar la ventana del default
-- EXECUTE-a-PUBLIC de Postgres.
revoke execute on function public.agency_crear_reserva(uuid, text, jsonb, text, text, text, integer, uuid, text) from public;
revoke execute on function public.agency_crear_reserva(uuid, text, jsonb, text, text, text, integer, uuid, text) from anon;
grant  execute on function public.agency_crear_reserva(uuid, text, jsonb, text, text, text, integer, uuid, text) to authenticated;

commit;