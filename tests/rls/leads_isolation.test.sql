-- Verify user of tenant A cannot read leads of tenant B.

begin;

-- Setup test users (must use service-role context to bypass RLS for inserts)
-- We rely on auth.users having these test rows. If they don't exist, create them.
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
values
  ('11111111-1111-1111-1111-111111111111', 'rls-a@test.invalid', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('22222222-2222-2222-2222-222222222222', 'rls-b@test.invalid', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')
on conflict (id) do nothing;

insert into public.tenants (id, slug, name, template_key, status)
values
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rls-tenant-a', 'A', 'eventos', 'published'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'rls-tenant-b', 'B', 'eventos', 'published')
on conflict (id) do nothing;

insert into public.tenant_members values
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner')
on conflict do nothing;

insert into public.leads_tenant (tenant_id, name) values
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Lead A1'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Lead B1');

-- Impersonate user A
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.leads_tenant;
  assert v_count = 1, 'expected 1 lead visible for tenant A, got ' || v_count;
end $$;

rollback;
