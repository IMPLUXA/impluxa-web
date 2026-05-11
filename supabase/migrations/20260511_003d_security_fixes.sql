-- Security fixes: split sites_member_all + explicit deny leads_tenant writes.

-- ============================================================
-- sites: split 'member_all' so editors cannot DELETE
-- ============================================================
drop policy if exists sites_member_all on public.sites;

create policy sites_member_select on public.sites for select
  using (
    public.is_admin()
    or tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

create policy sites_member_insert on public.sites for insert
  with check (
    public.is_admin()
    or tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

create policy sites_member_update on public.sites for update
  using (
    public.is_admin()
    or tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

-- DELETE: admin or owner-role member only
create policy sites_owner_delete on public.sites for delete
  using (
    public.is_admin()
    or tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- ============================================================
-- leads_tenant: explicit restrictive deny for UPDATE / DELETE
-- Rationale: tenant members can INSERT (via public form) and
-- SELECT (their own leads), but must never mutate or purge records.
-- ============================================================
create policy leads_no_update on public.leads_tenant as restrictive for update
  using (false);

create policy leads_no_delete on public.leads_tenant as restrictive for delete
  using (false);
