-- Migration: v0.2.5 W2.T2 — helper SQL fns (current_active_tenant)
-- Implements D5, D20. Reusable from RLS v2 policies (W2.T4).
-- Rollback: drop function public.current_active_tenant();

-- Helper to read active_tenant_id claim from JWT (server-side, RLS-safe).
create or replace function public.current_active_tenant()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'active_tenant_id', '')::uuid
$$;

grant execute on function public.current_active_tenant() to authenticated;
grant execute on function public.current_active_tenant() to service_role;

-- public.is_admin() already exists in 20260511_003_rls_policies.sql:4-11 (no-op here).
-- Verification only: this migration MUST NOT modify is_admin (CLAUDE.md edit-not-rewrite).
