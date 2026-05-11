-- Verify user A reads only their own site (and any published site for public read).

begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
values ('11111111-1111-1111-1111-111111111111', 'rls-a@test.invalid', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')
on conflict (id) do nothing;

insert into public.tenants (id, slug, name, template_key, status)
values
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rls-site-a', 'A', 'eventos', 'draft'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'rls-site-b', 'B', 'eventos', 'draft')
on conflict (id) do nothing;

insert into public.tenant_members values
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner')
on conflict do nothing;

insert into public.sites (tenant_id, content_json)
values
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"slogan":"A"}'::jsonb),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{"slogan":"B"}'::jsonb)
on conflict do nothing;

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.sites;
  assert v_count = 1, 'user A should see exactly 1 site (own draft), got ' || v_count;
end $$;

rollback;
