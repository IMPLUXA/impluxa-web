-- supabase/migrations/20260511_001_tenants_members_sites.sql

create extension if not exists "pgcrypto";

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$'),
  name text not null,
  template_key text not null,
  custom_domain text unique,
  status text not null default 'draft' check (status in ('draft','published','suspended')),
  trial_ends_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenants_status_idx on public.tenants(status);
create index tenants_custom_domain_idx on public.tenants(custom_domain) where custom_domain is not null;

create table public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','editor')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index tenant_members_user_idx on public.tenant_members(user_id);

create table public.sites (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  content_json jsonb not null default '{}'::jsonb,
  design_json jsonb not null default '{}'::jsonb,
  media_json jsonb not null default '{}'::jsonb,
  seo_json jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger tenants_touch before update on public.tenants
  for each row execute function public.touch_updated_at();

create trigger sites_touch before update on public.sites
  for each row execute function public.touch_updated_at();
