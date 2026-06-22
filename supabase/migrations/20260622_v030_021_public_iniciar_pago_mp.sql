-- v030_021 — F4: iniciar pago MercadoPago ANONIMO (Checkout Pro) para una reserva publica.
--
-- Hermana ANON de agency_iniciar_pago_mp (v030_008). Crea la MISMA fila pagos mercadopago
-- PENDIENTE que el webhook (confirmar_pago_webhook, v030_007) voltea a 'confirmado' en
-- 'approved' y con la que transiciona pre_reserva->reserva. NO confirma ni transiciona aca
-- (eso es asincrono, lo hace el webhook). El webhook NO se toca: reusa esta fila tal cual.
--
-- DIFERENCIAS vs el molde authenticated (v030_008):
--   * Tenant DERIVADO de la reserva (reservas.tenant_id), NO de current_active_tenant()
--     (el anon no tiene JWT). Nunca viaja del cliente.
--   * SIN guard de rol/staff; created_by = NULL (no hay vendedor logueado).
--   * El cliente NO manda monto: amount = snapshot_gross de la reserva (server-side,
--     no-manipulable). El anon paga el total de una; en pre_reserva no hay pagos parciales.
--   * SECURITY DEFINER; GRANT SOLO service_role (NO anon, NO authenticated). El unico caller
--     es el endpoint Next.js server-side (que aplica rate-limit). Grantear a anon saltearia
--     el gate -> agujero (igual razonamiento que public_crear_reserva, v030_018).
--
-- Reusa la infra de v030_008 SIN crear nada: indice parcial pagos_pending_mp_per_reserva_uk
-- (idempotencia + anti-landmine del webhook: a lo sumo 1 pendiente MP abierta por reserva).
--
-- Two-Pass cold del build verifica: tenant no-manipulable (de la fila), monto no-manipulable
-- (= snapshot_gross, el cliente no lo pasa), hold respetado, output sin PII de otras reservas.

begin;

create or replace function public.public_iniciar_pago_mp(
  p_reserva_id uuid
) returns jsonb
  language plpgsql security definer set search_path to ''
as $function$
declare
  v_tenant   uuid;
  v_res      record;
  v_amount   numeric;
  v_currency text;
  v_pagado   numeric;
  v_pago_id  uuid;
  v_existing uuid;
begin
  -- ===== Params =====
  if p_reserva_id is null then
    return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS','message','reserva_id requerido');
  end if;

  -- ===== Lock fila reserva (MISMO anchor que el webhook -> sin deadlock). Tenant DERIVADO de la fila. =====
  select r.id, r.tenant_id, r.status, r.snapshot_gross, r.snapshot_currency, r.hold_expires_at
    into v_res
    from public.reservas r
   where r.id = p_reserva_id
   for update;
  if not found then
    return jsonb_build_object('ok',false,'error_code','RESERVA_INEXISTENTE','message','reserva inexistente');
  end if;
  v_tenant := v_res.tenant_id;

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
  v_currency := v_res.snapshot_currency;

  -- ===== B2: metodo mercadopago activo del tenant (la FK compuesta es backstop) =====
  if not exists (select 1 from public.payment_methods pm
                  where pm.tenant_id = v_tenant and pm.code = 'mercadopago' and pm.active = true) then
    return jsonb_build_object('ok',false,'error_code','METODO_PAGO_INVALIDO','message','metodo mercadopago inactivo');
  end if;

  -- ===== Monto NO-MANIPULABLE: total snapshot menos lo ya confirmado. El cliente no lo pasa.
  --       En pre_reserva no hay pagos 'confirmado' (la confirmacion voltea a 'reserva'), asi que
  --       v_pagado=0 y v_amount=snapshot_gross. El coalesce es defensa. =====
  select coalesce(sum(p.amount),0) into v_pagado
    from public.pagos p
   where p.reserva_id = v_res.id and p.tenant_id = v_tenant and p.status = 'confirmado';
  v_amount := v_res.snapshot_gross - v_pagado;
  if v_amount <= 0 then
    return jsonb_build_object('ok',false,'error_code','RESERVA_YA_PAGADA','message','la reserva no tiene saldo pendiente');
  end if;

  -- ===== INSERT pendiente (idempotente por pagos_pending_mp_per_reserva_uk). created_by NULL (anon). =====
  begin
    insert into public.pagos
      (tenant_id, reserva_id, method_code, currency, amount, status, created_by)
    values
      (v_tenant, v_res.id, 'mercadopago', v_currency, v_amount, 'pendiente', null)
    returning id into v_pago_id;
  exception when unique_violation then
    -- ya hay una pendiente MP abierta para esta reserva -> replay idempotente
    select p.id into v_existing
      from public.pagos p
     where p.tenant_id = v_tenant and p.reserva_id = v_res.id
       and p.method_code = 'mercadopago' and p.status = 'pendiente'
     limit 1;
    return jsonb_build_object('ok',true,'idempotent_replay',true,
      'pago_id', v_existing, 'reserva_id', v_res.id, 'tenant_id', v_tenant,
      'amount', v_amount, 'currency', v_currency, 'status', 'pendiente');
  end;

  -- ===== Audit defensivo (anon: actor null, role public_anon). Falla = warning, NUNCA voltea el negocio. =====
  begin
    perform public.append_audit(jsonb_build_object(
      'actor_user_id',       null,
      'acting_as_tenant_id', v_tenant::text,
      'acting_as_role',      'public_anon',
      'action',              'reserva_pago_mp_iniciado',
      'resource_type',       'reserva',
      'resource_id',         v_res.id::text,
      'metadata', jsonb_build_object('pago_id', v_pago_id, 'amount', v_amount, 'currency', v_currency)));
  exception when others then
    raise warning 'public_iniciar_pago_mp: append_audit fallo (%) — pago % conservado', sqlerrm, v_pago_id;
  end;

  -- tenant_id en el envelope: lo consume SOLO el endpoint server-side (para getMpAccessToken);
  -- la route NO lo reenvia al cliente (allowlist init_point/preference_id).
  return jsonb_build_object('ok',true,'pago_id',v_pago_id,'reserva_id',v_res.id,'tenant_id',v_tenant,
    'amount',v_amount,'currency',v_currency,'status','pendiente');
end;
$function$;

revoke all on function public.public_iniciar_pago_mp(uuid) from public, anon, authenticated;
grant execute on function public.public_iniciar_pago_mp(uuid) to service_role;

comment on function public.public_iniciar_pago_mp(uuid) is
  'F4: crea fila pagos mercadopago PENDIENTE para una reserva ANONIMA (no confirma; el webhook v030_007 la voltea). Tenant derivado de la reserva, monto = snapshot_gross (no-manipulable, el cliente no lo pasa). Idempotente por pagos_pending_mp_per_reserva_uk. Grant solo service_role (el gate es el endpoint Next.js).';

commit;
