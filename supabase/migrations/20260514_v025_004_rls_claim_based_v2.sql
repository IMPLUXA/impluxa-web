-- Migration: v0.2.5 W2.T4 — RLS claim-based v2 RESTRICTIVE policies (SHADOW)
-- Implements D1, FR-AUTH-5.
-- SE-H2 fix: v2 policies are RESTRICTIVE so they AND with existing v1 PERMISSIVE.
-- This means BOTH v1 (member of tenant) AND v2 (active_tenant claim + membership)
-- must pass. v1 stays as backward-compat ceiling; v2 enforces claim-based scoping.
-- v1 policies are dropped in a separate migration in v0.2.6 after 24h validation.
-- DO-M2 fix: drop-if-exists for idempotent re-runs.
-- Rollback: drop policy ..._v2 on public.<table>; for each policy below.

-- ---------- sites ----------
-- Round 3 fix (SE-R3): v2 RESTRICTIVE for sites is split into SELECT (with public
-- read branch preserving v1 sites_public_read_published contract) and write ops
-- (INSERT/UPDATE/DELETE strict — public read does not imply public write).
drop policy if exists sites_member_select_v2 on public.sites;
create policy sites_member_select_v2 on public.sites
  as restrictive
  for select
  to authenticated
  using (
    -- Admin Impluxa: always
    public.is_admin()
    -- Member of the tenant with active claim
    or (
      tenant_id = public.current_active_tenant()
      and exists (
        select 1 from public.tenant_members tm
        where tm.user_id = auth.uid()
          and tm.tenant_id = sites.tenant_id
      )
    )
    -- Public read of sites whose tenant is published (preserves v1
    -- sites_public_read_published contract: `tenant_id IN tenants WHERE status='published'`).
    -- v2 RESTRICTIVE is `to authenticated` — anon already passes via v1 PERMISSIVE.
    or (
      sites.tenant_id in (
        select t.id from public.tenants t where t.status = 'published'
      )
    )
  );

drop policy if exists sites_member_insert_v2 on public.sites;
create policy sites_member_insert_v2 on public.sites
  as restrictive
  for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      tenant_id = public.current_active_tenant()
      and exists (
        select 1 from public.tenant_members tm
        where tm.user_id = auth.uid()
          and tm.tenant_id = sites.tenant_id
      )
    )
  );

drop policy if exists sites_member_update_v2 on public.sites;
create policy sites_member_update_v2 on public.sites
  as restrictive
  for update
  to authenticated
  using (
    public.is_admin()
    or (
      tenant_id = public.current_active_tenant()
      and exists (
        select 1 from public.tenant_members tm
        where tm.user_id = auth.uid()
          and tm.tenant_id = sites.tenant_id
      )
    )
  )
  with check (
    public.is_admin()
    or (
      tenant_id = public.current_active_tenant()
      and exists (
        select 1 from public.tenant_members tm
        where tm.user_id = auth.uid()
          and tm.tenant_id = sites.tenant_id
      )
    )
  );

drop policy if exists sites_member_delete_v2 on public.sites;
create policy sites_member_delete_v2 on public.sites
  as restrictive
  for delete
  to authenticated
  using (
    public.is_admin()
    or (
      tenant_id = public.current_active_tenant()
      and exists (
        select 1 from public.tenant_members tm
        where tm.user_id = auth.uid()
          and tm.tenant_id = sites.tenant_id
      )
    )
  );

-- Drop the previous monolithic `for all` v2 policy (replaced by 3 split policies above).
drop policy if exists sites_member_all_v2 on public.sites;

-- ---------- leads_tenant ----------
drop policy if exists leads_tenant_member_read_v2 on public.leads_tenant;
create policy leads_tenant_member_read_v2 on public.leads_tenant
  as restrictive
  for select
  to authenticated
  using (
    public.is_admin()
    or (
      tenant_id = public.current_active_tenant()
      and exists (
        select 1 from public.tenant_members tm
        where tm.user_id = auth.uid()
          and tm.tenant_id = leads_tenant.tenant_id
      )
    )
  );

-- ---------- subscriptions ----------
drop policy if exists subscriptions_member_read_v2 on public.subscriptions;
create policy subscriptions_member_read_v2 on public.subscriptions
  as restrictive
  for select
  to authenticated
  using (
    public.is_admin()
    or (
      tenant_id = public.current_active_tenant()
      and exists (
        select 1 from public.tenant_members tm
        where tm.user_id = auth.uid()
          and tm.tenant_id = subscriptions.tenant_id
      )
    )
  );

-- ---------- activity_log ----------
drop policy if exists activity_log_member_read_v2 on public.activity_log;
create policy activity_log_member_read_v2 on public.activity_log
  as restrictive
  for select
  to authenticated
  using (
    public.is_admin()
    or (
      tenant_id = public.current_active_tenant()
      and exists (
        select 1 from public.tenant_members tm
        where tm.user_id = auth.uid()
          and tm.tenant_id = activity_log.tenant_id
      )
    )
  );
