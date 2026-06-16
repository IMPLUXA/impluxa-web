-- Migration: v030_006 — RPC mp_connection_status() (F2 build MercadoPago, s55)
--
-- Surface de estado de conexión MP legible por el DUEÑO (booleano + metadata no
-- sensible), que F1 difirió. SECURITY DEFINER: lee public.tenant_mp_credentials
-- (tabla service-role-only, RLS niega a authenticated) pero expone ÚNICAMENTE
-- columnas no-token (status / connected / connected_at / mp_user_id), filtrado por
-- el tenant activo del caller. JAMÁS devuelve access_token/refresh_token/ciphertext.
--
-- Gate: mismo patrón que el resto del panel (tenant activo + rol de agencia).
-- Un caller solo ve su PROPIO tenant (where tenant_id = current_active_tenant()).
--
-- Aislamiento Hakuna: aditivo (función nueva). No toca tablas/RLS existentes.
-- Rollback (DOWN pre-tipeado, ver _down.sql): drop function.

begin;

create or replace function public.mp_connection_status()
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
as $function$
declare
  v_tenant uuid;
  v_row    record;
begin
  v_tenant := public.current_active_tenant();
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO',
      'message', 'caller sin tenant activo');
  end if;
  if public.current_agency_role() is null then
    return jsonb_build_object('ok', false, 'error_code', 'NO_AUTORIZADO',
      'message', 'caller sin rol de agencia');
  end if;

  select status, connected_at, mp_user_id
    into v_row
    from public.tenant_mp_credentials
   where tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('ok', true, 'connected', false);
  end if;

  -- NUNCA se devuelve token/ciphertext: solo estado + metadata no sensible.
  return jsonb_build_object(
    'ok', true,
    'connected', (v_row.status = 'connected'),
    'status', v_row.status,
    'connected_at', v_row.connected_at,
    'mp_user_id', v_row.mp_user_id);
end;
$function$;

revoke all on function public.mp_connection_status() from public, anon;
grant execute on function public.mp_connection_status() to authenticated;

comment on function public.mp_connection_status() is
  'Estado de conexión MercadoPago del tenant activo (connected/status/connected_at/'
  'mp_user_id). SECURITY DEFINER, lee tenant_mp_credentials pero NUNCA devuelve el '
  'token. Filtrado por current_active_tenant(). v030_006 build MP s55.';

commit;

-- ============================================================================
-- DOWN (pre-tipeado): drop function if exists public.mp_connection_status();
-- ============================================================================
