-- v030_008: F3 — iniciar pago MercadoPago (Checkout Pro).
--
-- Crea la fila `pagos` mercadopago en estado PENDIENTE que el webhook
-- (confirmar_pago_webhook, v030_007) voltea a 'confirmado' en 'approved'. NO confirma
-- ni transiciona la reserva (eso es asincrono, lo hace el webhook).
--
-- Hermano de agency_confirmar_reserva (C7.2) pero CANONICO desde el arranque:
--   - role-gate INTERNO encargado|dueno_admin (NO arrastra la deuda deny-vendedor de C7.2;
--     un vendedor llamando el RPC directo por PostgREST es rechazado dentro del RPC).
--   - idempotencia por indice parcial pagos_pending_mp_per_reserva_uk (max 1 pendiente MP
--     abierta por reserva). Esto ADEMAS desarma el landmine del webhook: su
--     UPDATE ... WHERE method_code='mercadopago' AND status='pendiente' NO tiene LIMIT;
--     con 2+ pendientes voltearia ambas al mismo mp_payment_id -> unique_violation ->
--     el catch lo traga como replay PERO rollbackea la confirmacion -> 200 sin cobro.
--
-- Depende SOLO de objetos de v030_001 (pagos/reservas/payment_methods/agency_staff) +
-- helpers current_active_tenant()/current_agency_role()/append_audit. NO usa la columna
-- pagos.idempotency_key (existe en prod via v030_004 no-commiteado al repo; pieza drift
-- separada gateada antes del merge a main).
--
-- s56 F3. Squad Two-Pass cold (BA + Security + DB Optimizer). Esquema pagos verificado
-- empirico contra prod (NOT NULL: tenant_id/reserva_id/method_code/currency/amount/status;
-- status check incluye pendiente+cancelado; FK (tenant_id,method_code)->payment_methods).

begin;

-- Idempotencia + anti-landmine: como mucho 1 pendiente MP abierta por reserva.
create unique index if not exists pagos_pending_mp_per_reserva_uk
  on public.pagos (tenant_id, reserva_id)
  where method_code = 'mercadopago' and status = 'pendiente';

-- F3: iniciar pago MP (inserta la fila pendiente). authenticated + gate interno canonico.
create or replace function public.agency_iniciar_pago_mp(
  p_reserva_id uuid,
  p_pago jsonb            -- { amount: number, currency: text }  (SIN idempotency_key)
) returns jsonb
  language plpgsql security definer set search_path to ''
as $function$
declare
  v_tenant   uuid;
  v_role     text;
  v_staff    uuid;
  v_res      record;
  v_amount   numeric;
  v_currency text;
  v_pagado   numeric;
  v_pago_id  uuid;
  v_existing uuid;
begin
  -- ===== Guards identidad (tenant del guard, JAMAS del body) =====
  v_tenant := public.current_active_tenant();
  if v_tenant is null then
    return jsonb_build_object('ok',false,'error_code','NO_AUTORIZADO','message','caller sin tenant activo');
  end if;
  v_role := public.current_agency_role();
  -- Gate CANONICO encargado|dueno_admin (vendedor NO inicia cobro MP). Cierra la deuda
  -- deny-vendedor para este RPC nuevo (a diferencia de agency_confirmar_reserva).
  if v_role is null or v_role not in ('encargado','dueno_admin') then
    return jsonb_build_object('ok',false,'error_code','NO_AUTORIZADO','message','rol sin permiso de cobro');
  end if;
  select s.id into v_staff
    from public.agency_staff s
   where s.member_user_id = auth.uid() and s.tenant_id = v_tenant and s.active = true
   limit 1;
  if v_staff is null then
    return jsonb_build_object('ok',false,'error_code','NO_AUTORIZADO','message','caller sin staff activo');
  end if;

  -- ===== Params (amount numero > 0 escala 2) =====
  if jsonb_typeof(p_pago) <> 'object' then
    return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS','message','p_pago debe ser objeto');
  end if;
  if (p_pago ->> 'amount') is null or jsonb_typeof(p_pago -> 'amount') <> 'number' then
    return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS','message','amount requerido (number)');
  end if;
  v_amount := (p_pago ->> 'amount')::numeric;
  if v_amount is null or v_amount <= 0 or v_amount <> round(v_amount, 2) then
    return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS','message','amount > 0 con escala 2');
  end if;
  v_currency := p_pago ->> 'currency';

  -- ===== Lock fila reserva (MISMO anchor que el webhook -> sin deadlock) =====
  select r.id, r.status, r.snapshot_gross, r.snapshot_currency, r.hold_expires_at
    into v_res
    from public.reservas r
   where r.id = p_reserva_id and r.tenant_id = v_tenant
   for update;
  if not found then
    return jsonb_build_object('ok',false,'error_code','RESERVA_INEXISTENTE','message','reserva inexistente');
  end if;
  if v_res.status <> 'pre_reserva' then
    return jsonb_build_object('ok',false,'error_code','ESTADO_INVALIDO',
      'message','la reserva no esta en pre_reserva','details',jsonb_build_object('status',v_res.status));
  end if;
  if v_res.hold_expires_at is not null and v_res.hold_expires_at <= now() then
    return jsonb_build_object('ok',false,'error_code','HOLD_VENCIDO','message','el hold de la reserva vencio');
  end if;
  if v_res.snapshot_gross is null or v_res.snapshot_currency is null then
    return jsonb_build_object('ok',false,'error_code','RESERVA_SIN_SNAPSHOT','message','reserva sin total snapshot');
  end if;

  -- ===== Currency autoridad = snapshot (la route igual la deriva server-side) =====
  if v_currency is null or v_currency <> v_res.snapshot_currency then
    return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS','message','currency no coincide con la reserva');
  end if;

  -- ===== B2: metodo mercadopago activo del tenant (la FK compuesta es backstop) =====
  if not exists (select 1 from public.payment_methods pm
                  where pm.tenant_id = v_tenant and pm.code = 'mercadopago' and pm.active = true) then
    return jsonb_build_object('ok',false,'error_code','METODO_PAGO_INVALIDO','message','metodo mercadopago inactivo');
  end if;

  -- ===== B1: tope de saldo (OVERPAY OFF; solo confirmados cuentan; el webhook re-valida) =====
  select coalesce(sum(p.amount),0) into v_pagado
    from public.pagos p
   where p.reserva_id = v_res.id and p.tenant_id = v_tenant and p.status = 'confirmado';
  if v_amount > (v_res.snapshot_gross - v_pagado) then
    return jsonb_build_object('ok',false,'error_code','MONTO_EXCEDE_SALDO',
      'message','el monto excede el saldo pendiente',
      'details', jsonb_build_object('saldo_pendiente', v_res.snapshot_gross - v_pagado));
  end if;

  -- ===== INSERT pendiente (idempotente por pagos_pending_mp_per_reserva_uk) =====
  begin
    insert into public.pagos
      (tenant_id, reserva_id, method_code, currency, amount, status, created_by)
    values
      (v_tenant, v_res.id, 'mercadopago', v_currency, v_amount, 'pendiente', v_staff)
    returning id into v_pago_id;
  exception when unique_violation then
    -- ya hay una pendiente MP abierta para esta reserva -> replay idempotente
    select p.id into v_existing
      from public.pagos p
     where p.tenant_id = v_tenant and p.reserva_id = v_res.id
       and p.method_code = 'mercadopago' and p.status = 'pendiente'
     limit 1;
    return jsonb_build_object('ok',true,'idempotent_replay',true,
      'pago_id', v_existing, 'reserva_id', v_res.id,
      'amount', v_amount, 'currency', v_currency, 'status', 'pendiente');
  end;

  -- ===== Audit defensivo (falla = warning, NUNCA voltea el negocio) =====
  begin
    perform public.append_audit(jsonb_build_object(
      'actor_user_id',       auth.uid()::text,
      'acting_as_tenant_id', v_tenant::text,
      'acting_as_role',      v_role,
      'action',              'reserva_pago_mp_iniciado',
      'resource_type',       'reserva',
      'resource_id',         v_res.id::text,
      'metadata', jsonb_build_object('pago_id', v_pago_id, 'amount', v_amount, 'currency', v_currency)));
  exception when others then
    raise warning 'agency_iniciar_pago_mp: append_audit fallo (%) — pago % conservado', sqlerrm, v_pago_id;
  end;

  return jsonb_build_object('ok',true,'pago_id',v_pago_id,'reserva_id',v_res.id,
    'amount',v_amount,'currency',v_currency,'status','pendiente');
end;
$function$;

-- F3 cleanup-on-MP-fail: cancela una fila pendiente MP especifica (scoped por pago_id +
-- tenant). Idempotente (0 filas = ya no estaba pendiente). El barredor de holds es backstop.
create or replace function public.agency_cancelar_pago_mp_pendiente(
  p_pago_id uuid
) returns jsonb
  language plpgsql security definer set search_path to ''
as $function$
declare
  v_tenant uuid;
  v_role   text;
  v_rows   integer;
begin
  v_tenant := public.current_active_tenant();
  if v_tenant is null then
    return jsonb_build_object('ok',false,'error_code','NO_AUTORIZADO','message','caller sin tenant activo');
  end if;
  v_role := public.current_agency_role();
  if v_role is null or v_role not in ('encargado','dueno_admin') then
    return jsonb_build_object('ok',false,'error_code','NO_AUTORIZADO','message','rol sin permiso');
  end if;
  update public.pagos
     set status = 'cancelado'
   where id = p_pago_id and tenant_id = v_tenant
     and method_code = 'mercadopago' and status = 'pendiente';
  get diagnostics v_rows = row_count;
  return jsonb_build_object('ok',true,'cancelled',v_rows);
end;
$function$;

revoke all on function public.agency_iniciar_pago_mp(uuid, jsonb) from public, anon;
grant execute on function public.agency_iniciar_pago_mp(uuid, jsonb) to authenticated;
revoke all on function public.agency_cancelar_pago_mp_pendiente(uuid) from public, anon;
grant execute on function public.agency_cancelar_pago_mp_pendiente(uuid) to authenticated;

comment on function public.agency_iniciar_pago_mp(uuid, jsonb) is
  'F3: crea fila pagos mercadopago PENDIENTE (no confirma; el webhook v030_007 la voltea). Gate canonico encargado|dueno_admin. Idempotente por pagos_pending_mp_per_reserva_uk.';
comment on function public.agency_cancelar_pago_mp_pendiente(uuid) is
  'F3 cleanup: cancela una fila pagos mercadopago pendiente especifica si el POST a MP falla.';

commit;
