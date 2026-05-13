-- Follow-up fixes for 20260511_003 RLS migration (security review feedback).

-- Fix 1: is_admin() must read app_metadata.role, NOT top-level role claim.
-- Top-level role is set by Supabase to authenticated/anon/service_role and is
-- never 'admin'. The custom claim lives in app_metadata.
create or replace function public.is_admin()
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
$$;

-- Revoke broad PUBLIC grant, then re-grant only to authenticated.
-- anon must NOT call is_admin() (landing form never needs it).
-- authenticated must be able to call it so RLS policies evaluate correctly.
revoke execute on function public.is_admin() from anon, public;
grant execute on function public.is_admin() to authenticated;

-- Fix 2: public.leads (FASE 0 landing) has RLS enabled with no policy.
-- The landing form must keep working: allow anon insert only.
create policy leads_anon_insert on public.leads for insert
  to anon, authenticated
  with check (true);

-- Optionally allow admins to read landing leads.
create policy leads_admin_read on public.leads for select
  using (public.is_admin());
