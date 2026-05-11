-- Storage buckets for tenant media.

insert into storage.buckets (id, name, public) values
  ('public-tenant-media', 'public-tenant-media', true),
  ('tenant-media', 'tenant-media', false)
on conflict (id) do nothing;

-- public-tenant-media: anyone can read, members write only under their tenant_id/ prefix
create policy "public read tenant media"
  on storage.objects for select
  using (bucket_id = 'public-tenant-media');

create policy "members write own tenant media (public)"
  on storage.objects for insert
  with check (
    bucket_id = 'public-tenant-media'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.tenant_members where user_id = auth.uid()
    )
  );

create policy "members update own tenant media (public)"
  on storage.objects for update
  using (
    bucket_id = 'public-tenant-media'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.tenant_members where user_id = auth.uid()
    )
  );

create policy "members delete own tenant media (public)"
  on storage.objects for delete
  using (
    bucket_id = 'public-tenant-media'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.tenant_members where user_id = auth.uid()
    )
  );

-- tenant-media (private): members read/write, same path convention
create policy "members read own tenant media (private)"
  on storage.objects for select
  using (
    bucket_id = 'tenant-media'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.tenant_members where user_id = auth.uid()
    )
  );

create policy "members write own tenant media (private)"
  on storage.objects for insert
  with check (
    bucket_id = 'tenant-media'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.tenant_members where user_id = auth.uid()
    )
  );

create policy "members update own tenant media (private)"
  on storage.objects for update
  using (
    bucket_id = 'tenant-media'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.tenant_members where user_id = auth.uid()
    )
  );
