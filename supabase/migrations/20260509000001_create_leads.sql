-- supabase/migrations/20260509000001_create_leads.sql
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now() not null,
  name text not null,
  email text not null,
  phone text,
  whatsapp text,
  industry text not null check (industry in (
    'eventos','restaurante','distribuidora','gimnasio',
    'inmobiliaria','clinica','foodseller','otro'
  )),
  budget_range text check (budget_range in ('70-100','100-200','200+','unknown')),
  message text,
  source text default 'landing',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  language text default 'es-LA',
  status text default 'new' check (status in ('new','contacted','qualified','customer','lost')),
  contacted_at timestamptz,
  notes text
);

create index leads_created_at_idx on public.leads(created_at desc);
create index leads_status_idx on public.leads(status);
create index leads_industry_idx on public.leads(industry);

alter table public.leads enable row level security;
-- Sin policies = solo service_role puede operar.
