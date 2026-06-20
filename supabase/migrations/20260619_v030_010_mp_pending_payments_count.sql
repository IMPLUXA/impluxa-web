-- Migration: v030_010 — RPC mp_pending_payments_count() (UI-connect MP, s57)
--
-- Surface read-only para el endpoint de DESCONEXIÓN MP: cuántos cobros MercadoPago
-- quedan PENDIENTES en el tenant activo. El UI lo usa para advertir ("hay N cobros MP
-- pendientes; si desconectás no se confirman solos hasta reconectar") antes de revocar.
-- SECURITY DEFINER + filtrado por current_active_tenant(): mismo patrón que
-- mp_connection_status (v030_006). NUNCA expone PII ni montos — sólo un conteo.
--
-- Role gate (Two-Pass cold S3/DB1): restringido a encargado|dueno_admin, IGUAL que el
-- write-path (agency_iniciar_pago_mp v030_008). Un vendedor no inicia/cancela cobros MP
-- → tampoco debe poder contar los pendientes tenant-wide. Cierra el cross-role read gap
-- en la capa DB (no solo en el route-level gate).
--
-- `pendiente` (no 'pending') y `method_code='mercadopago'` = esquema real verificado en
-- v030_008 (agency_iniciar_pago_mp inserta así).
--
-- Aislamiento Hakuna: aditivo (función nueva). No toca tablas/RLS existentes. Hakuna no
-- tiene cobros MP (sin fila en tenant_mp_credentials) → para Hakuna devuelve 0.
-- Rollback (DOWN pre-tipeado, ver _down.sql): drop function.
--
-- ESTADO: ARCHIVO. NO aplicada (gate prod ASK CEO, hakuna_live=true). El endpoint
-- /api/mp/oauth/disconnect la consume; activa junto con el apply + deploy del corte.

begin;

create or replace function public.mp_pending_payments_count()
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
as $function$
declare
  v_tenant uuid;
  v_role   text;
  v_count  integer;
begin
  v_tenant := public.current_active_tenant();
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO',
      'message', 'caller sin tenant activo');
  end if;
  -- Gate de rol explícito (alineado con el write-path encargado|dueno_admin).
  v_role := public.current_agency_role();
  if v_role is null or v_role not in ('encargado', 'dueno_admin') then
    return jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO',
      'message', 'rol sin acceso a cobros');
  end if;

  select count(*)
    into v_count
    from public.pagos
   where tenant_id = v_tenant
     and method_code = 'mercadopago'
     and status = 'pendiente';

  return jsonb_build_object('ok', true, 'pending', v_count);
end;
$function$;

revoke all on function public.mp_pending_payments_count() from public, anon;
grant execute on function public.mp_pending_payments_count() to authenticated;

comment on function public.mp_pending_payments_count() is
  'UI-connect MP: conteo de cobros mercadopago en estado pendiente del tenant activo. '
  'SECURITY DEFINER, filtrado por current_active_tenant(), gate encargado|dueno_admin. '
  'NUNCA PII ni montos, solo el conteo. Lo usa /api/mp/oauth/disconnect para el warn '
  'pre-revocar. v030_010 s57.';

commit;

-- ============================================================================
-- DOWN (pre-tipeado, ver _down.sql):
--   drop function if exists public.mp_pending_payments_count();
-- ============================================================================
