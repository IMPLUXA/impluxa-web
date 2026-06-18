-- C7 migration — agency_confirmar_reserva (pago + transición pre_reserva→reserva)
-- s54 corregida (anon-ACL). Patrón fuente: agency_crear_reserva (#24). Validado 8/8 + anon_exec=FALSE local. SHA fuente 874DDE15.

alter table public.pagos add column if not exists idempotency_key text;
create unique index if not exists pagos_tenant_idem_uk
  on public.pagos (tenant_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.agency_confirmar_reserva(
  p_reserva_id uuid,
  p_pago       jsonb   default null,
  p_confirm    boolean default false
) returns jsonb
  language plpgsql
  security definer
  set search_path to ''
as $function$
declare
  v_tenant           uuid;
  v_role             text;
  v_caller_staff     uuid;
  v_res              record;
  v_has_pago         boolean;
  v_method           text;
  v_currency         text;
  v_idem             text;
  v_amount           numeric;
  v_pagado           numeric;
  v_pago_id          uuid;
  v_existing_id      uuid;
  v_existing_reserva uuid;
  v_constraint       text;
  v_rows             integer;
begin
  -- ===== Params fail-fast (antes del lock; cero estado parcial) =====
  if p_reserva_id is null then
    return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS','message','reserva_id requerido');
  end if;

  v_has_pago := p_pago is not null;
  if not v_has_pago and not coalesce(p_confirm,false) then
    return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS',
      'message','nada para hacer: sin pago y sin confirmar');
  end if;

  if v_has_pago then
    if jsonb_typeof(p_pago) <> 'object' then
      return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS','message','p_pago debe ser objeto');
    end if;
    v_method   := p_pago->>'method_code';
    v_currency := p_pago->>'currency';
    v_idem     := p_pago->>'idempotency_key';
    if v_method is null or length(btrim(v_method)) < 1 or length(v_method) > 50 then
      return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS','message','method_code requerido (1..50)');
    end if;
    if (p_pago ->> 'amount') is null or jsonb_typeof(p_pago -> 'amount') <> 'number' then
      return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS','message','amount requerido (number)');
    end if;
    v_amount := (p_pago ->> 'amount')::numeric;
    if v_amount is null or v_amount <= 0 or v_amount <> round(v_amount, 2) then
      return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS','message','amount > 0 con escala 2');
    end if;
    if v_idem is not null and (length(v_idem) < 1 or length(v_idem) > 200) then
      return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS','message','idempotency_key 1..200');
    end if;
  end if;

  -- ===== Guards identidad (tenant del guard, JAMÁS del body) =====
  v_tenant := public.current_active_tenant();
  if v_tenant is null then
    return jsonb_build_object('ok',false,'error_code','NO_AUTORIZADO','message','caller sin tenant activo');
  end if;
  v_role := public.current_agency_role();
  if v_role is null or v_role not in ('vendedor','encargado','dueno_admin') then
    return jsonb_build_object('ok',false,'error_code','NO_AUTORIZADO','message','caller sin rol de agencia');
  end if;
  select s.id into v_caller_staff
    from public.agency_staff s
   where s.member_user_id = auth.uid()
     and s.tenant_id = v_tenant
     and s.active = true
   limit 1;
  if v_caller_staff is null then
    return jsonb_build_object('ok',false,'error_code','NO_AUTORIZADO','message','caller sin staff activo');
  end if;

  -- ===== Lock fila ancla (TODOS los modos; serializa pagos/confirm concurrentes) =====
  select r.id, r.status, r.seller_staff_id, r.snapshot_gross, r.snapshot_currency, r.hold_expires_at
    into v_res
    from public.reservas r
   where r.id = p_reserva_id and r.tenant_id = v_tenant
   for update;
  if not found then
    return jsonb_build_object('ok',false,'error_code','RESERVA_INEXISTENTE','message','reserva inexistente');
  end if;

  -- ===== Matriz autz por rol (vendedor solo propias; anti-oráculo: ajena == inexistente) =====
  if v_role = 'vendedor' and v_res.seller_staff_id is distinct from v_caller_staff then
    return jsonb_build_object('ok',false,'error_code','RESERVA_INEXISTENTE','message','reserva inexistente');
  end if;

  -- ===== Estado base =====
  if v_res.status = 'cancelada' then
    return jsonb_build_object('ok',false,'error_code','ESTADO_INVALIDO','message','reserva cancelada');
  end if;
  -- hold vencido (solo aplica a pre_reserva): rechazar en v1
  if v_res.status = 'pre_reserva'
     and v_res.hold_expires_at is not null
     and v_res.hold_expires_at <= now() then
    return jsonb_build_object('ok',false,'error_code','HOLD_VENCIDO','message','el hold de la reserva vencio');
  end if;

  -- ===== PAGO (si hay): B1 saldo + B2 método + B3 idempotencia. INSERT PRIMERO. =====
  if v_has_pago then
    -- B1: snapshot leído de la fila (no del body)
    if v_res.snapshot_gross is null or v_res.snapshot_currency is null then
      return jsonb_build_object('ok',false,'error_code','RESERVA_SIN_SNAPSHOT','message','reserva sin total snapshot');
    end if;
    if v_currency is null or v_currency <> v_res.snapshot_currency then
      return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS','message','currency no coincide con la reserva');
    end if;
    -- B2: método activo del tenant (FK compuesta tenant-safe; envelope limpio)
    if not exists (select 1 from public.payment_methods pm
                    where pm.tenant_id = v_tenant and pm.code = v_method and pm.active = true) then
      return jsonb_build_object('ok',false,'error_code','METODO_PAGO_INVALIDO','message','metodo de pago invalido');
    end if;
    -- B1: tope de saldo (OVERPAY OFF en v1)
    select coalesce(sum(p.amount),0) into v_pagado
      from public.pagos p
     where p.reserva_id = v_res.id and p.tenant_id = v_tenant and p.status = 'confirmado';
    if v_amount > (v_res.snapshot_gross - v_pagado) then
      return jsonb_build_object('ok',false,'error_code','MONTO_EXCEDE_SALDO',
        'message','el monto excede el saldo pendiente',
        'details', jsonb_build_object('saldo_pendiente', v_res.snapshot_gross - v_pagado));
    end if;
    -- B3: INSERT en sub-bloque solo-insert; captura idempotencia
    begin
      insert into public.pagos
        (tenant_id, reserva_id, method_code, currency, amount, status, confirmed_at, created_by, idempotency_key)
      values
        (v_tenant, v_res.id, v_method, v_currency, v_amount, 'confirmado', now(), v_caller_staff, v_idem)
      returning id into v_pago_id;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint is distinct from 'pagos_tenant_idem_uk' then
        raise;  -- un 23505 de otra fuente NO es replay idempotente
      end if;
      select p.id, p.reserva_id into v_existing_id, v_existing_reserva
        from public.pagos p
       where p.tenant_id = v_tenant and p.idempotency_key = v_idem;
      if v_existing_reserva is distinct from p_reserva_id then
        return jsonb_build_object('ok',false,'error_code','IDEMPOTENCY_CONFLICT',
          'message','idempotency_key ya usado para otra reserva');
      end if;
      -- replay legítimo: mismo tenant+key+reserva → devolver el pago existente, NO re-procesar
      return jsonb_build_object('ok',true,'idempotent_replay',true,
        'reserva_id', v_existing_reserva, 'pago_id', v_existing_id, 'status', v_res.status);
    end;
  end if;

  -- ===== CONFIRMAR (si corresponde): compare-and-set DESPUÉS del pago =====
  if coalesce(p_confirm,false) then
    update public.reservas
       set status = 'reserva', confirmed_at = now()
     where id = v_res.id and status = 'pre_reserva';
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      return jsonb_build_object('ok',false,'error_code','ESTADO_INVALIDO',
        'message','la reserva no estaba en pre_reserva',
        'details', jsonb_build_object('status', v_res.status));
    end if;
    v_res.status := 'reserva';
    -- Gancho splits F9 (Q4 DIFERIDO): STUB v1 — no inserta commission_splits.
    -- TODO C7-F9: insertar splits cuando ruleset/% estén definidos (Q4).
  end if;

  -- ===== Audit defensivo (falla = warning, NUNCA voltea el negocio) =====
  begin
    perform public.append_audit(jsonb_build_object(
      'actor_user_id',       auth.uid()::text,
      'acting_as_tenant_id', v_tenant::text,
      'acting_as_role',      v_role,
      'action', case when v_has_pago and coalesce(p_confirm,false) then 'reserva_pago_y_confirmada'
                     when v_has_pago then 'reserva_pago_registrado'
                     else 'reserva_confirmada' end,
      'resource_type',       'reserva',
      'resource_id',         v_res.id::text,
      'metadata', jsonb_build_object(
        'pago_id', v_pago_id, 'amount', v_amount, 'method_code', v_method,
        'confirmada', coalesce(p_confirm,false), 'new_status', v_res.status)));
  exception when others then
    raise warning 'agency_confirmar_reserva: append_audit fallo (%) — operacion % conservada', sqlerrm, v_res.id;
  end;

  return jsonb_build_object(
    'ok', true,
    'reserva_id', v_res.id,
    'status', v_res.status,
    'pago_id', v_pago_id,
    'pago_amount', v_amount,
    'pago_currency', v_currency,
    'confirmada', coalesce(p_confirm,false));
end;
$function$;

revoke all on function public.agency_confirmar_reserva(uuid, jsonb, boolean) from public, anon;
grant execute on function public.agency_confirmar_reserva(uuid, jsonb, boolean) to authenticated;