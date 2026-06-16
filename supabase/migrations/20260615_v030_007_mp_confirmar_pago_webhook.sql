-- Migration: v030_007 — F5 confirmar_pago_webhook (MercadoPago) + 'cancelado' + idempotencia
--
-- El motor de cobro MP del lado webhook. La RPC es SERVICE-CONTEXT (sin auth.uid()):
-- la invoca ÚNICAMENTE el endpoint webhook YA VALIDADO (HMAC x-signature constant-time
-- + anti-replay + idempotencia). Sin esa validación previa NO se invoca. Es la HERMANA
-- service-context de agency_confirmar_reserva (path staff): comparten invariantes B1/B4,
-- difieren en el gate de identidad (staff autenticado vs webhook validado).
--
-- Aislamiento Hakuna: pagos/reservas/payment_methods son per-tenant (tenant_id);
-- Hakuna (716200ab) NO tiene agency_staff/agency_* (verificado s55) → este DDL no
-- afecta su path. ALTER de pagos.status = ADITIVO (superset; las filas/escrituras
-- existentes y el RPC vivo agency_confirmar_reserva que escribe 'confirmado' siguen válidos).
--
-- Rollback: ver _down.sql (drop function + drop index + revert check a 3 valores).

begin;

-- (1) ALTER ADITIVO: agregar 'cancelado' a pagos.status. Constraint actual confirmado:
--     pagos_status_check CHECK (status IN ('pendiente','confirmado','rechazado')).
alter table public.pagos drop constraint if exists pagos_status_check;
alter table public.pagos add constraint pagos_status_check
  check (status in ('pendiente','confirmado','rechazado','cancelado'));

-- (2) Idempotencia DURA del webhook: mp_payment_id único por tenant (ADEMÁS del
--     idempotency_key). Un mismo payment de MP puede notificar N veces (la doc MP manda
--     responder 200 y deduplicar) → este índice convierte el doble-confirm en replay.
create unique index if not exists pagos_tenant_mp_payment_uk
  on public.pagos (tenant_id, mp_payment_id)
  where mp_payment_id is not null;

-- (3) RPC service-context.
create or replace function public.confirmar_pago_webhook(
  p_tenant_id     uuid,
  p_reserva_id    uuid,
  p_mp_payment_id text,
  p_amount        numeric,
  p_currency      text,
  p_mp_status     text
) returns jsonb
  language plpgsql
  security definer
  set search_path to ''
as $function$
declare
  v_res      record;
  v_pagado   numeric;
  v_existing record;
  v_pago_id  uuid;
  v_rows     integer;
begin
  -- ===== Params fail-fast =====
  if p_tenant_id is null or p_reserva_id is null
     or p_mp_payment_id is null or length(btrim(p_mp_payment_id)) < 1 then
    return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS',
      'message','tenant_id, reserva_id y mp_payment_id requeridos');
  end if;
  if p_mp_status is null or p_mp_status not in ('approved','rejected','cancelled') then
    return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS',
      'message','mp_status invalido (approved|rejected|cancelled)');
  end if;

  -- ===== Lock fila reserva (ancla; serializa confirm/cancel concurrentes del mismo pago) =====
  select r.id, r.status, r.snapshot_gross, r.snapshot_currency
    into v_res
    from public.reservas r
   where r.id = p_reserva_id and r.tenant_id = p_tenant_id
   for update;
  if not found then
    return jsonb_build_object('ok',false,'error_code','RESERVA_INEXISTENTE','message','reserva inexistente');
  end if;

  -- ===== Idempotencia (pre-check): mp_payment_id ya procesado => replay, no-op =====
  select p.id, p.status, p.reserva_id into v_existing
    from public.pagos p
   where p.tenant_id = p_tenant_id and p.mp_payment_id = p_mp_payment_id;
  if found then
    return jsonb_build_object('ok',true,'idempotent_replay',true,
      'pago_id', v_existing.id, 'pago_status', v_existing.status,
      'reserva_id', v_existing.reserva_id, 'reserva_status', v_res.status);
  end if;

  if p_mp_status = 'approved' then
    if v_res.status = 'cancelada' then
      return jsonb_build_object('ok',false,'error_code','ESTADO_INVALIDO','message','reserva cancelada');
    end if;
    -- B1: el monto autoritativo es el SNAPSHOT de la reserva, NO el payload del webhook.
    if v_res.snapshot_gross is null or v_res.snapshot_currency is null then
      return jsonb_build_object('ok',false,'error_code','RESERVA_SIN_SNAPSHOT','message','reserva sin snapshot');
    end if;
    if p_currency is null or p_currency <> v_res.snapshot_currency then
      return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS','message','currency no coincide con la reserva');
    end if;
    if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
      return jsonb_build_object('ok',false,'error_code','PARAMS_INVALIDOS','message','amount > 0 escala 2');
    end if;
    -- B2: método mercadopago activo del tenant
    if not exists (select 1 from public.payment_methods pm
                    where pm.tenant_id = p_tenant_id and pm.code = 'mercadopago' and pm.active = true) then
      return jsonb_build_object('ok',false,'error_code','METODO_PAGO_INVALIDO','message','metodo mercadopago inactivo');
    end if;
    -- B1: tope de saldo (OVERPAY OFF). El monto verificado por MP debe caber en el saldo.
    select coalesce(sum(p.amount),0) into v_pagado
      from public.pagos p
     where p.reserva_id = v_res.id and p.tenant_id = p_tenant_id and p.status = 'confirmado';
    if p_amount > (v_res.snapshot_gross - v_pagado) then
      return jsonb_build_object('ok',false,'error_code','MONTO_EXCEDE_SALDO',
        'message','el monto excede el saldo pendiente',
        'details', jsonb_build_object('saldo_pendiente', v_res.snapshot_gross - v_pagado));
    end if;

    -- Confirmar: reusar la fila pendiente de F3 si existe; si no, insertar. unique_violation
    -- sobre mp_payment_id (concurrente) => replay idempotente.
    begin
      update public.pagos
         set status='confirmado', mp_payment_id=p_mp_payment_id, amount=p_amount,
             currency=p_currency, confirmed_at=now()
       where tenant_id=p_tenant_id and reserva_id=v_res.id
         and method_code='mercadopago' and status='pendiente'
       returning id into v_pago_id;
      if v_pago_id is null then
        insert into public.pagos
          (tenant_id, reserva_id, method_code, currency, amount, status, confirmed_at, mp_payment_id)
        values
          (p_tenant_id, v_res.id, 'mercadopago', p_currency, p_amount, 'confirmado', now(), p_mp_payment_id)
        returning id into v_pago_id;
      end if;
    exception when unique_violation then
      select p.id, p.status, p.reserva_id into v_existing
        from public.pagos p where p.tenant_id=p_tenant_id and p.mp_payment_id=p_mp_payment_id;
      return jsonb_build_object('ok',true,'idempotent_replay',true,
        'pago_id', v_existing.id, 'pago_status', v_existing.status,
        'reserva_id', v_existing.reserva_id, 'reserva_status', v_res.status);
    end;

    -- B4: TOCTOU compare-and-set pre_reserva -> reserva (idempotente: row_count 0 = ya estaba)
    update public.reservas set status='reserva', confirmed_at=now()
     where id=v_res.id and status='pre_reserva';
    get diagnostics v_rows = row_count;
    -- approved + no-cancelada (chequeado arriba) => estado final SIEMPRE 'reserva': haya
    -- transicionado ahora (row_count=1) o ya estuviera en 'reserva' (row_count=0, ej. 2do
    -- pago parcial). El FOR UPDATE ya garantiza read==estado-al-UPDATE; esto es defensa
    -- explícita + future-proof del response (Two-Pass cold P1).
    v_res.status := 'reserva';

    -- Atribución OQ1 (dueño 9% / vendedor-encargado 5% / web-anónimo -> dueños 9%): implícita
    -- en reservas.seller_staff_id + commission_ruleset_id. La MATERIALIZACIÓN de splits + el
    -- reparto entre 2 dueños es F9 (GATEADA) — STUB acá, idéntico al hermano agency_confirmar_reserva.

    -- Audit defensivo (falla = warning, nunca voltea el negocio)
    begin
      perform public.append_audit(jsonb_build_object(
        'actor_user_id', null, 'acting_as_tenant_id', p_tenant_id::text,
        'acting_as_role', 'service_webhook_mp',
        'action', 'reserva_pago_mp_confirmado',
        'resource_type', 'reserva', 'resource_id', v_res.id::text,
        'metadata', jsonb_build_object('pago_id', v_pago_id, 'mp_payment_id', p_mp_payment_id,
          'amount', p_amount, 'new_status', v_res.status)));
    exception when others then
      raise warning 'confirmar_pago_webhook: append_audit fallo (%) — operacion % conservada', sqlerrm, v_res.id;
    end;

    return jsonb_build_object('ok', true, 'reserva_id', v_res.id, 'reserva_status', v_res.status,
      'pago_id', v_pago_id, 'pago_status', 'confirmado', 'amount', p_amount);

  else
    -- rejected -> 'rechazado' (MP declinó) ; cancelled -> 'cancelado' (abandono/void OQ3).
    -- Marca la fila pendiente; NO toca la reserva (expira por hold_expires_at + barredor).
    update public.pagos
       set status = case when p_mp_status='rejected' then 'rechazado' else 'cancelado' end,
           mp_payment_id = p_mp_payment_id
     where tenant_id=p_tenant_id and reserva_id=p_reserva_id
       and method_code='mercadopago' and status='pendiente'
     returning id into v_pago_id;
    get diagnostics v_rows = row_count;
    return jsonb_build_object('ok', true,
      'pago_status', case when p_mp_status='rejected' then 'rechazado' else 'cancelado' end,
      'updated', v_rows, 'reserva_id', p_reserva_id, 'reserva_status', v_res.status,
      'note', 'reserva intacta; pre_reserva expira por hold + barredor');
  end if;
end;
$function$;

revoke all on function public.confirmar_pago_webhook(uuid, uuid, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.confirmar_pago_webhook(uuid, uuid, text, numeric, text, text) to service_role;

comment on function public.confirmar_pago_webhook(uuid, uuid, text, numeric, text, text) is
  'F5 MP: confirma (approved) / rechaza (rejected) / cancela (cancelled) un pago MercadoPago '
  'disparado por el webhook YA VALIDADO. SERVICE-CONTEXT (grant solo service_role). B1 monto '
  'del snapshot (no del payload) + B2 metodo activo + B4 TOCTOU pre_reserva->reserva + '
  'idempotencia por mp_payment_id. Splits/atribucion materializados en F9. v030_007 build MP s55.';

commit;

-- ============================================================================
-- DOWN (pre-tipeado, ver _down.sql):
--   drop function if exists public.confirmar_pago_webhook(uuid,uuid,text,numeric,text,text);
--   drop index if exists public.pagos_tenant_mp_payment_uk;
--   alter table public.pagos drop constraint if exists pagos_status_check;
--   alter table public.pagos add constraint pagos_status_check
--     check (status in ('pendiente','confirmado','rechazado'));
-- ============================================================================
