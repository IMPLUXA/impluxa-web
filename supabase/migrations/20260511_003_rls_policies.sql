-- RLS policies for FASE 1A multi-tenant isolation.

-- Helper: returns true if JWT has role=admin (custom app_metadata claim)
create or replace function public.is_admin()
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'admin'
$$;

-- ============================================================
-- tenants
-- ============================================================
alter table public.tenants enable row level security;

create policy tenants_member_read on public.tenants for select
  using (
    public.is_admin()
    or id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

create policy tenants_admin_all on public.tenants for all
  using (public.is_admin())
  with check (public.is_admin());

create policy tenants_public_read_published on public.tenants for select
  using (status = 'published');

-- ============================================================
-- tenant_members
-- ============================================================
alter table public.tenant_members enable row level security;

create policy members_self_read on public.tenant_members for select
  using (public.is_admin() or user_id = auth.uid());

create policy members_admin_all on public.tenant_members for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- sites
-- ============================================================
alter table public.sites enable row level security;

create policy sites_member_all on public.sites for all
  using (
    public.is_admin()
    or tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

create policy sites_public_read_published on public.sites for select
  using (
    tenant_id in (select id from public.tenants where status = 'published')
  );

-- ============================================================
-- leads_tenant
-- ============================================================
alter table public.leads_tenant enable row level security;

create policy leads_anyone_insert on public.leads_tenant for insert
  with check (
    tenant_id in (select id from public.tenants where status = 'published')
  );

create policy leads_member_read on public.leads_tenant for select
  using (
    public.is_admin()
    or tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

-- ============================================================
-- plans (read público, write solo admin)
-- ============================================================
alter table public.plans enable row level security;

create policy plans_public_read on public.plans for select using (true);

create policy plans_admin_write on public.plans for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- subscriptions (read miembros/admin, write solo service_role)
-- ============================================================
alter table public.subscriptions enable row level security;

create policy subs_member_read on public.subscriptions for select
  using (
    public.is_admin()
    or tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

-- No write policy → writes only via service_role bypass

-- ============================================================
-- activity_log (read miembros/admin, write via service_role)
-- ============================================================
alter table public.activity_log enable row level security;

create policy activity_member_read on public.activity_log for select
  using (
    public.is_admin()
    or tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

-- Revoke public EXECUTE on touch_updated_at (security advisory)
revoke execute on function public.touch_updated_at() from anon, authenticated, public;

-- Revoke public EXECUTE on is_admin (security advisory: SECURITY DEFINER callable by anon/authenticated)
revoke execute on function public.is_admin() from anon, authenticated, public;
