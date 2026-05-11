-- Follow-up fixes for 20260511_001_tenants_members_sites.sql
-- Issues raised by database review.

-- 1. Lock down search_path on trigger function (security)
create or replace function public.touch_updated_at()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- 2. Replace tenants.slug check with stricter regex
alter table public.tenants drop constraint if exists tenants_slug_check;
alter table public.tenants add constraint tenants_slug_check check (
  slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
  and length(slug) between 2 and 42
  and slug !~ '--'
);

-- 3. Add ON DELETE SET NULL to created_by FK
alter table public.tenants drop constraint if exists tenants_created_by_fkey;
alter table public.tenants
  add constraint tenants_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
