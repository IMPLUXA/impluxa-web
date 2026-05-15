-- Migration: v0.2.5 W2.T3 — custom_access_token_hook function (fail-closed)
-- Implements D5, D20 (fail-closed per Security Engineer override of fail-open).
-- After apply, W1.T3 step 2 enables the hook in Supabase Dashboard.
-- Note (SE-M1 review): tenant_members_auth_admin_read uses using(true). Accepted
-- as least-privilege violation because supabase_auth_admin is a postgres role
-- locked by Supabase, not exposable to app code; scoping by JWT claim does not
-- apply (role has no JWT). Documented here, deferred to ROADMAP.
-- Rollback: drop function public.custom_access_token_hook(jsonb);

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_active_tenant uuid;
  v_claims jsonb;
begin
  -- D20 fail-closed: any exception bubbles up; login is rejected by Supabase Auth
  -- with a generic error. Healthcheck (W4.T7) monitors hook availability.
  -- We do NOT swallow exceptions — propagate them.

  v_user_id := (event ->> 'user_id')::uuid;
  v_claims := coalesce(event -> 'claims', '{}'::jsonb);

  -- 1. Try user_session_state (set by tenant-switch endpoint, default from backfill)
  select uss.active_tenant_id into v_active_tenant
  from public.user_session_state uss
  where uss.user_id = v_user_id;

  -- 2. Fallback: first membership by created_at (defensive, covers backfill races)
  if v_active_tenant is null then
    select tm.tenant_id into v_active_tenant
    from public.tenant_members tm
    where tm.user_id = v_user_id
    order by tm.created_at asc
    limit 1;
  end if;

  -- 3. Inject claim if we found one. If null (orphan user, no membership), no claim
  -- is injected — downstream RLS policies treat this as "no tenant", deny by default.
  if v_active_tenant is not null then
    v_claims := jsonb_set(v_claims, '{active_tenant_id}', to_jsonb(v_active_tenant::text));
  end if;

  -- Return event with mutated claims (Supabase Auth Hook contract).
  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- Grants (mandatory pattern from Supabase Auth Hooks docs):
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;

-- Auth admin needs to read tables the hook touches.
grant select on public.tenant_members to supabase_auth_admin;

drop policy if exists "tenant_members_auth_admin_read" on public.tenant_members;
create policy "tenant_members_auth_admin_read"
  on public.tenant_members
  as permissive
  for select
  to supabase_auth_admin
  using (true);
