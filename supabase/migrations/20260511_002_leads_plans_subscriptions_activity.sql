create table public.leads_tenant (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index leads_tenant_tenant_idx on public.leads_tenant(tenant_id, created_at desc);

create table public.plans (
  key text primary key,
  name text not null,
  price_ars integer not null,
  features jsonb not null default '[]'::jsonb,
  mp_preapproval_plan_id text
);

insert into public.plans (key, name, price_ars, features) values
  ('trial',    'Trial 14 días',   0,     '["1 sitio","trial 14d"]'::jsonb),
  ('standard', 'Standard',        12000, '["1 sitio","leads ilimitados","soporte email"]'::jsonb),
  ('pro',      'Pro',             24000, '["custom domain","soporte priority","analytics"]'::jsonb);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid unique not null references public.tenants(id) on delete cascade,
  plan_key text not null references public.plans(key),
  status text not null check (status in ('trial','active','paused','cancelled','past_due')),
  mp_subscription_id text unique,
  mp_payer_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

create table public.activity_log (
  id bigserial primary key,
  tenant_id uuid references public.tenants(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_tenant_idx on public.activity_log(tenant_id, created_at desc);
