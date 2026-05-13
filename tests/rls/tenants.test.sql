-- Verify user A sees only their tenant (plus any published tenants per public read policy).

begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
values ('11111111-1111-1111-1111-111111111111', 'rls-a@test.invalid', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')
on conflict (id) do nothing;

insert into public.tenants (id, slug, name, template_key, status)
values
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rls-tenant-a-draft', 'A', 'eventos', 'draft'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'rls-tenant-b-draft', 'B', 'eventos', 'draft')
on conflict (id) do nothing;

insert into public.tenant_members values
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner')
on conflict do nothing;

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare
  v_has_a boolean;
  v_has_b boolean;
begin
  select exists(select 1 from public.tenants where slug='rls-tenant-a-draft') into v_has_a;
  select exists(select 1 from public.tenants where slug='rls-tenant-b-draft') into v_has_b;
  assert v_has_a, 'user A should see own draft tenant A';
  assert not v_has_b, 'user A should NOT see draft tenant B';
end $$;

rollback;
