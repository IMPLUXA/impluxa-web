-- Migration: v0.3.0 F1 — Agency schema (Patagonia Viva / Sistema Gestión Agencia)
-- Tablas vacías + RLS claim-based RESTRICTIVE. NO seed (las 3 cuentas genéricas NO se hardcodean).
-- Replica patrón vivo: 20260514_v025_004_rls_claim_based_v2.sql (RLS) + 20260511_001 (create table) +
--   20260514_v025_005_audit_log.sql (append_audit ya existe, se referencia, NO se recrea) +
--   20260511_004_storage_buckets.sql (bucket privado 'tenant-media' ya existe, se reúsa).
--
-- Estado verificado empírico (fundado, no re-chequeado): 0 tablas de agencia existen.
--   tenant_members.role CHECK = (role = ANY (ARRAY['owner','editor'])). Postgres 17.
--   Helpers current_active_tenant() / is_admin() / append_audit() ya existen.
--
-- Helper nuevo: public.current_agency_role() -> text (security definer) para RLS role-scoped.
--
-- Correcciones cold-review marcadas inline:
--   [CR1] excursions.category (filtro 4-categorías terrestre/lacustre/aventura/nieve).
--   [CR2] moneda base del neto + FX congelado (commission_rulesets.currency_base,
--         reservas.snapshot_currency/snapshot_fx_rate).
--   [CR3] anti-oversell transaccional al confirmar + TTL pre-reserva (reservas.hold_expires_at);
--         NO contador duplicado de cupo en excursion_departures.
--
-- Rollback: ver 20260608_v030_001_agency_schema_down.sql (drop en orden inverso de FKs).

begin;

-- ============================================================================
-- 1. agency_staff
-- MIGRABLE a nominal: id estable, member_user_id se setea/cambia, is_generic flip.
-- NO se hardcodean las 3 cuentas genéricas (eso va en seed F-posterior, no acá).
-- ============================================================================
create table if not exists public.agency_staff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  member_user_id uuid references auth.users(id) on delete set null,
  agency_role text not null check (agency_role in ('vendedor','encargado','dueno_admin')),
  display_name text not null,
  is_generic boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);
create index if not exists agency_staff_tenant_idx on public.agency_staff(tenant_id);
create index if not exists agency_staff_member_user_idx
  on public.agency_staff(member_user_id) where member_user_id is not null;

-- ============================================================================
-- HELPER: current_agency_role()  (creado DESPUÉS de agency_staff: el body SQL
-- referencia esa tabla y Postgres valida el cuerpo en tiempo de creación —
-- por eso NO puede ir antes de la tabla).
-- security definer + search_path='' (mismo hardening que append_audit).
-- ============================================================================
create or replace function public.current_agency_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.agency_role
  from public.agency_staff s
  where s.member_user_id = auth.uid()
    and s.tenant_id = public.current_active_tenant()
    and s.active = true
  limit 1;
$$;

revoke execute on function public.current_agency_role() from public, anon;
grant execute on function public.current_agency_role() to authenticated;

-- ============================================================================
-- 2. providers
-- ============================================================================
create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  contact_json jsonb not null default '{}'::jsonb,
  payout_terms text not null default 'mensual',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists providers_tenant_idx on public.providers(tenant_id);

-- ============================================================================
-- 3. excursions
-- [CR1] category: el filtro 4-categorías necesita este campo. PV hoy todas 'terrestre'.
-- ============================================================================
create table if not exists public.excursions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_id uuid references public.providers(id),
  name text not null,
  description text,
  category text not null check (category in ('terrestre','lacustre','aventura','nieve')), -- [CR1]
  active boolean not null default true,
  default_currency text not null default 'ARS' check (default_currency in ('ARS','USD','BRL')),
  created_at timestamptz not null default now()
);
create index if not exists excursions_tenant_idx on public.excursions(tenant_id);
create index if not exists excursions_provider_idx on public.excursions(provider_id) where provider_id is not null;
create index if not exists excursions_category_idx on public.excursions(tenant_id, category); -- [CR1] filtro

-- ============================================================================
-- 4. passenger_categories
-- price_factor: adulto=1.0, nino=0.5, infante=0.0, 3ra_edad=NULL (hasta dato cliente).
-- ============================================================================
create table if not exists public.passenger_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  label text not null,
  price_factor numeric(7,4),
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index if not exists passenger_categories_tenant_idx on public.passenger_categories(tenant_id);

-- ============================================================================
-- 5. excursion_rates — VERSIONADO (no UPDATE destructivo): valid_from / valid_to.
-- Plata SIEMPRE numeric.
-- ============================================================================
create table if not exists public.excursion_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  excursion_id uuid not null references public.excursions(id),
  base_price numeric(14,2) not null,
  provider_cost numeric(14,2) not null,
  currency text not null check (currency in ('ARS','USD','BRL')),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_by uuid references public.agency_staff(id),
  created_at timestamptz not null default now()
);
create index if not exists excursion_rates_tenant_idx on public.excursion_rates(tenant_id);
-- Tarifa vigente: filtro por excursion + ventana de validez (valid_to IS NULL = abierta).
create index if not exists excursion_rates_excursion_valid_idx
  on public.excursion_rates(excursion_id, valid_from desc);

-- ============================================================================
-- 6. excursion_departures
-- [CR3] anti-oversell / lock se maneja TRANSACCIONAL al confirmar reserva (SELECT ... FOR UPDATE
--       sobre esta fila + COUNT de reserva_pasajeros activas dentro de la misma tx). capacity es
--       el TOPE, NO un contador mutable: NO se desnormaliza un "seats_taken" acá (evita doble
--       fuente de verdad / drift). El TTL de pre-reserva (reservas.hold_expires_at) libera cupo
--       fantasma sin tocar esta tabla.
-- ============================================================================
create table if not exists public.excursion_departures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  excursion_id uuid not null references public.excursions(id),
  departure_date date not null,
  departure_time time,
  capacity int not null check (capacity >= 0),
  status text not null default 'open' check (status in ('open','closed','cancelled')),
  created_at timestamptz not null default now(),
  unique (tenant_id, excursion_id, departure_date, departure_time)
);
create index if not exists excursion_departures_tenant_idx on public.excursion_departures(tenant_id);
create index if not exists excursion_departures_excursion_date_idx
  on public.excursion_departures(excursion_id, departure_date);

-- ============================================================================
-- 7. payment_methods — tabla en vez de enum rígido (cold-review minor: "abiertos a sumar").
-- ============================================================================
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  label text not null,
  active boolean not null default true,
  unique (tenant_id, code)
);
create index if not exists payment_methods_tenant_idx on public.payment_methods(tenant_id);

-- ============================================================================
-- 12. commission_rulesets (creado antes que reservas para el FK; reservas FK-ea a rulesets).
-- [CR2] currency_base = moneda base del neto.
-- GATE FINANCIERO: is_provisional. Invariante de split (ver nota), enforce duro en F9.
-- ============================================================================
create table if not exists public.commission_rulesets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  net_commission_pct numeric(7,4) not null,
  split_vendedor_pct numeric(7,4) not null,
  split_dueno_pct numeric(7,4) not null,
  split_encargado_pct numeric(7,4) not null,
  currency_base text not null default 'ARS' check (currency_base in ('ARS','USD','BRL')), -- [CR2]
  is_provisional boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  notes text,
  created_at timestamptz not null default now()
  -- INVARIANTE (NO enforce duro acá; va en F9):
  --   split_vendedor_pct + 2*split_dueno_pct + split_encargado_pct = 1.0
  --   NO se puede marcar is_provisional=false sin cumplir esta igualdad.
  --   Se deja como comentario: el enforce (CHECK / trigger / app-gate) se codifica en F9.
);
create index if not exists commission_rulesets_tenant_idx on public.commission_rulesets(tenant_id);

-- ============================================================================
-- 8. reservas
-- [CR2] snapshot financiero congelado: snapshot_currency + snapshot_fx_rate (tipo de cambio
--       congelado si moneda de cobro != moneda base del neto) + montos snapshot.
-- [CR3] hold_expires_at: TTL de pre-reserva, libera cupo fantasma (un job/consulta filtra
--       pre_reserva con hold_expires_at < now() como expiradas; no agota cupo real).
-- ============================================================================
create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  departure_id uuid not null references public.excursion_departures(id),
  seller_staff_id uuid references public.agency_staff(id),
  holder_name text not null,
  holder_email text,
  holder_phone text,
  holder_lodging text,
  status text not null default 'pre_reserva' check (status in ('pre_reserva','reserva','cancelada')),
  reservation_code text not null,
  -- [CR2] snapshot financiero congelado:
  snapshot_currency text,
  snapshot_fx_rate numeric(18,6),
  snapshot_gross numeric(14,2),
  snapshot_provider_cost numeric(14,2),
  snapshot_net numeric(14,2),
  commission_ruleset_id uuid,            -- FK diferido (ver ALTER abajo)
  hold_expires_at timestamptz,           -- [CR3] TTL pre-reserva
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  unique (tenant_id, reservation_code)
);
create index if not exists reservas_tenant_idx on public.reservas(tenant_id);
create index if not exists reservas_departure_idx on public.reservas(departure_id);
create index if not exists reservas_seller_idx on public.reservas(seller_staff_id) where seller_staff_id is not null;
-- [CR3] barrido de holds expirados: pre_reserva con hold_expires_at vencido.
create index if not exists reservas_hold_expiry_idx
  on public.reservas(hold_expires_at) where status = 'pre_reserva' and hold_expires_at is not null;

-- FK DIFERIDO: reservas.commission_ruleset_id -> commission_rulesets(id)
alter table public.reservas
  drop constraint if exists reservas_commission_ruleset_fk;
alter table public.reservas
  add constraint reservas_commission_ruleset_fk
  foreign key (commission_ruleset_id) references public.commission_rulesets(id);

-- ============================================================================
-- 9. reserva_pasajeros — on delete cascade desde reservas. unit_price = snapshot.
-- ============================================================================
create table if not exists public.reserva_pasajeros (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  passenger_category_id uuid not null references public.passenger_categories(id),
  full_name text,
  unit_price numeric(14,2) not null,
  qty int not null default 1 check (qty > 0),
  created_at timestamptz not null default now()
);
create index if not exists reserva_pasajeros_tenant_idx on public.reserva_pasajeros(tenant_id);
create index if not exists reserva_pasajeros_reserva_idx on public.reserva_pasajeros(reserva_id);

-- ============================================================================
-- 10. pagos — multi-pago 1:N por reserva.
-- DECISIÓN method por code via FK COMPOSITE (tenant_id, method_code) -> payment_methods(tenant_id, code):
--   el UNIQUE vivo es (tenant_id, code), no (code) global; un FK simple a (code) sería inválido.
--   El composite respeta aislamiento por tenant.
-- ============================================================================
create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reserva_id uuid not null references public.reservas(id),
  method_code text not null,
  currency text not null check (currency in ('ARS','USD','BRL')),
  amount numeric(14,2) not null,
  status text not null default 'pendiente' check (status in ('pendiente','confirmado','rechazado')),
  mp_payment_id text,
  confirmed_at timestamptz,
  created_by uuid references public.agency_staff(id),
  created_at timestamptz not null default now(),
  constraint pagos_method_fk
    foreign key (tenant_id, method_code) references public.payment_methods(tenant_id, code)
);
create index if not exists pagos_tenant_idx on public.pagos(tenant_id);
create index if not exists pagos_reserva_idx on public.pagos(reserva_id);

-- ============================================================================
-- 11. comprobantes — bucket PRIVADO 'tenant-media' (ya existe, reúso). on delete cascade desde pagos.
-- ============================================================================
create table if not exists public.comprobantes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pago_id uuid not null references public.pagos(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references public.agency_staff(id),
  review_status text not null default 'pendiente' check (review_status in ('pendiente','ok','rechazado')),
  reviewed_by uuid references public.agency_staff(id),
  created_at timestamptz not null default now()
);
create index if not exists comprobantes_tenant_idx on public.comprobantes(tenant_id);
create index if not exists comprobantes_pago_idx on public.comprobantes(pago_id);

-- ============================================================================
-- 13. commission_splits — materializado al confirmar (F9). Plata numeric.
-- ============================================================================
create table if not exists public.commission_splits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reserva_id uuid not null references public.reservas(id),
  beneficiary_staff_id uuid not null references public.agency_staff(id),
  role_at_sale text not null,
  pct_applied numeric(7,4) not null,
  amount numeric(14,2) not null,
  ruleset_id uuid not null references public.commission_rulesets(id),
  created_at timestamptz not null default now()
);
create index if not exists commission_splits_tenant_idx on public.commission_splits(tenant_id);
create index if not exists commission_splits_reserva_idx on public.commission_splits(reserva_id);
create index if not exists commission_splits_beneficiary_idx on public.commission_splits(beneficiary_staff_id);

-- ============================================================================
-- Índices cubridores de FKs (get_advisors performance: unindexed_foreign_keys).
-- Cubren las 8 FKs que no tenían índice propio. Algunas son columnas de auditoría
-- de bajo tráfico (created_by/reviewed_by/uploaded_by) pero el lint las marca igual;
-- el costo de indexarlas es marginal y silencia la categoría.
-- ============================================================================
create index if not exists commission_splits_ruleset_idx on public.commission_splits(ruleset_id);
create index if not exists comprobantes_reviewed_by_idx on public.comprobantes(reviewed_by) where reviewed_by is not null;
create index if not exists comprobantes_uploaded_by_idx on public.comprobantes(uploaded_by) where uploaded_by is not null;
create index if not exists excursion_rates_created_by_idx on public.excursion_rates(created_by) where created_by is not null;
create index if not exists pagos_created_by_idx on public.pagos(created_by) where created_by is not null;
create index if not exists pagos_method_idx on public.pagos(tenant_id, method_code);
create index if not exists reserva_pasajeros_category_idx on public.reserva_pasajeros(passenger_category_id);
create index if not exists reservas_commission_ruleset_idx on public.reservas(commission_ruleset_id) where commission_ruleset_id is not null;

-- ============================================================================
-- RLS — replica patrón v2 RESTRICTIVE (20260514_v025_004).
-- Base de TODAS: tenant_id = current_active_tenant() OR is_admin().
-- Capa de rol (vendedor/encargado/dueno_admin) vía current_agency_role().
-- service_role bypassa RLS → la API pública de reserva (pasajero sin login) usa service client
--   (igual que leads), NO policy 'authenticated'. Ver nota en reservas/reserva_pasajeros.
-- ============================================================================

-- providers
alter table public.providers enable row level security;
drop policy if exists providers_tenant_select on public.providers;
create policy providers_tenant_select on public.providers
  as restrictive for select to authenticated
  using ( public.is_admin() or tenant_id = public.current_active_tenant() );
drop policy if exists providers_tenant_write_ins on public.providers;
create policy providers_tenant_write_ins on public.providers
  as restrictive for insert to authenticated
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );
drop policy if exists providers_tenant_write_upd on public.providers;
create policy providers_tenant_write_upd on public.providers
  as restrictive for update to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) )
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );
drop policy if exists providers_tenant_write_del on public.providers;
create policy providers_tenant_write_del on public.providers
  as restrictive for delete to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );

-- excursions
alter table public.excursions enable row level security;
drop policy if exists excursions_tenant_select on public.excursions;
create policy excursions_tenant_select on public.excursions
  as restrictive for select to authenticated
  using ( public.is_admin() or tenant_id = public.current_active_tenant() );
drop policy if exists excursions_tenant_write_ins on public.excursions;
create policy excursions_tenant_write_ins on public.excursions
  as restrictive for insert to authenticated
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );
drop policy if exists excursions_tenant_write_upd on public.excursions;
create policy excursions_tenant_write_upd on public.excursions
  as restrictive for update to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) )
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );
drop policy if exists excursions_tenant_write_del on public.excursions;
create policy excursions_tenant_write_del on public.excursions
  as restrictive for delete to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );

-- passenger_categories
alter table public.passenger_categories enable row level security;
drop policy if exists passenger_categories_tenant_select on public.passenger_categories;
create policy passenger_categories_tenant_select on public.passenger_categories
  as restrictive for select to authenticated
  using ( public.is_admin() or tenant_id = public.current_active_tenant() );
drop policy if exists passenger_categories_tenant_write_ins on public.passenger_categories;
create policy passenger_categories_tenant_write_ins on public.passenger_categories
  as restrictive for insert to authenticated
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );
drop policy if exists passenger_categories_tenant_write_upd on public.passenger_categories;
create policy passenger_categories_tenant_write_upd on public.passenger_categories
  as restrictive for update to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) )
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );
drop policy if exists passenger_categories_tenant_write_del on public.passenger_categories;
create policy passenger_categories_tenant_write_del on public.passenger_categories
  as restrictive for delete to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );

-- excursion_rates
alter table public.excursion_rates enable row level security;
drop policy if exists excursion_rates_tenant_select on public.excursion_rates;
create policy excursion_rates_tenant_select on public.excursion_rates
  as restrictive for select to authenticated
  using ( public.is_admin() or tenant_id = public.current_active_tenant() );
drop policy if exists excursion_rates_tenant_write_ins on public.excursion_rates;
create policy excursion_rates_tenant_write_ins on public.excursion_rates
  as restrictive for insert to authenticated
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );
drop policy if exists excursion_rates_tenant_write_upd on public.excursion_rates;
create policy excursion_rates_tenant_write_upd on public.excursion_rates
  as restrictive for update to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) )
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );
drop policy if exists excursion_rates_tenant_write_del on public.excursion_rates;
create policy excursion_rates_tenant_write_del on public.excursion_rates
  as restrictive for delete to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );

-- excursion_departures
alter table public.excursion_departures enable row level security;
drop policy if exists excursion_departures_tenant_select on public.excursion_departures;
create policy excursion_departures_tenant_select on public.excursion_departures
  as restrictive for select to authenticated
  using ( public.is_admin() or tenant_id = public.current_active_tenant() );
drop policy if exists excursion_departures_tenant_write_ins on public.excursion_departures;
create policy excursion_departures_tenant_write_ins on public.excursion_departures
  as restrictive for insert to authenticated
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );
drop policy if exists excursion_departures_tenant_write_upd on public.excursion_departures;
create policy excursion_departures_tenant_write_upd on public.excursion_departures
  as restrictive for update to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) )
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );
drop policy if exists excursion_departures_tenant_write_del on public.excursion_departures;
create policy excursion_departures_tenant_write_del on public.excursion_departures
  as restrictive for delete to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );

-- payment_methods
alter table public.payment_methods enable row level security;
drop policy if exists payment_methods_tenant_select on public.payment_methods;
create policy payment_methods_tenant_select on public.payment_methods
  as restrictive for select to authenticated
  using ( public.is_admin() or tenant_id = public.current_active_tenant() );
drop policy if exists payment_methods_tenant_write_ins on public.payment_methods;
create policy payment_methods_tenant_write_ins on public.payment_methods
  as restrictive for insert to authenticated
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );
drop policy if exists payment_methods_tenant_write_upd on public.payment_methods;
create policy payment_methods_tenant_write_upd on public.payment_methods
  as restrictive for update to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) )
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );
drop policy if exists payment_methods_tenant_write_del on public.payment_methods;
create policy payment_methods_tenant_write_del on public.payment_methods
  as restrictive for delete to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() in ('encargado','dueno_admin')) );

-- agency_staff: lectura tenant; escritura solo dueno_admin (gestión de cuentas)
alter table public.agency_staff enable row level security;
drop policy if exists agency_staff_tenant_select on public.agency_staff;
create policy agency_staff_tenant_select on public.agency_staff
  as restrictive for select to authenticated
  using ( public.is_admin() or tenant_id = public.current_active_tenant() );
drop policy if exists agency_staff_admin_write_ins on public.agency_staff;
create policy agency_staff_admin_write_ins on public.agency_staff
  as restrictive for insert to authenticated
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() = 'dueno_admin') );
drop policy if exists agency_staff_admin_write_upd on public.agency_staff;
create policy agency_staff_admin_write_upd on public.agency_staff
  as restrictive for update to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() = 'dueno_admin') )
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() = 'dueno_admin') );
drop policy if exists agency_staff_admin_write_del on public.agency_staff;
create policy agency_staff_admin_write_del on public.agency_staff
  as restrictive for delete to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() = 'dueno_admin') );

-- reservas: capa de rol. vendedor SOLO las propias (seller_staff_id = su staff);
--   encargado/dueno_admin todas del tenant. Inserción pública (paso 1-3) vía service_role.
alter table public.reservas enable row level security;
drop policy if exists reservas_role_select on public.reservas;
create policy reservas_role_select on public.reservas
  as restrictive for select to authenticated
  using (
    public.is_admin()
    or (
      tenant_id = public.current_active_tenant()
      and (
        public.current_agency_role() in ('encargado','dueno_admin')
        or (
          public.current_agency_role() = 'vendedor'
          and seller_staff_id = (
            select s.id from public.agency_staff s
            where s.member_user_id = auth.uid()
              and s.tenant_id = public.current_active_tenant()
            limit 1
          )
        )
      )
    )
  );
drop policy if exists reservas_role_ins on public.reservas;
create policy reservas_role_ins on public.reservas
  as restrictive for insert to authenticated
  with check (
    public.is_admin()
    or (
      tenant_id = public.current_active_tenant()
      and public.current_agency_role() in ('vendedor','encargado','dueno_admin')
    )
  );
drop policy if exists reservas_role_upd on public.reservas;
create policy reservas_role_upd on public.reservas
  as restrictive for update to authenticated
  using (
    public.is_admin()
    or (
      tenant_id = public.current_active_tenant()
      and (
        public.current_agency_role() in ('encargado','dueno_admin')
        or (
          public.current_agency_role() = 'vendedor'
          and seller_staff_id = (
            select s.id from public.agency_staff s
            where s.member_user_id = auth.uid()
              and s.tenant_id = public.current_active_tenant()
            limit 1
          )
        )
      )
    )
  )
  with check (
    public.is_admin()
    or (
      tenant_id = public.current_active_tenant()
      and public.current_agency_role() in ('vendedor','encargado','dueno_admin')
    )
  );
-- NOTA: insert/update público del flujo pasajero-sin-login (paso 1-3) NO pasa por estas policies;
--       la API pública usa el SERVICE CLIENT (service_role bypassa RLS), igual que leads_tenant.

-- reserva_pasajeros: hereda alcance de su reserva (vendedor solo las de sus reservas)
alter table public.reserva_pasajeros enable row level security;
drop policy if exists reserva_pasajeros_role_select on public.reserva_pasajeros;
create policy reserva_pasajeros_role_select on public.reserva_pasajeros
  as restrictive for select to authenticated
  using (
    public.is_admin()
    or (
      tenant_id = public.current_active_tenant()
      and (
        public.current_agency_role() in ('encargado','dueno_admin')
        or exists (
          select 1 from public.reservas r
          where r.id = reserva_pasajeros.reserva_id
            and r.seller_staff_id = (
              select s.id from public.agency_staff s
              where s.member_user_id = auth.uid()
                and s.tenant_id = public.current_active_tenant()
              limit 1
            )
        )
      )
    )
  );
drop policy if exists reserva_pasajeros_role_write on public.reserva_pasajeros;
create policy reserva_pasajeros_role_write on public.reserva_pasajeros
  as restrictive for all to authenticated
  using (
    public.is_admin()
    or ( tenant_id = public.current_active_tenant()
         and public.current_agency_role() in ('encargado','dueno_admin') )
  )
  with check (
    public.is_admin()
    or ( tenant_id = public.current_active_tenant()
         and public.current_agency_role() in ('encargado','dueno_admin') )
  );
-- NOTA: alta de pasajeros en el flujo público (paso 1-3) vía service client (service_role).

-- pagos: vendedor solo los de sus reservas; encargado/dueno_admin todos
alter table public.pagos enable row level security;
drop policy if exists pagos_role_select on public.pagos;
create policy pagos_role_select on public.pagos
  as restrictive for select to authenticated
  using (
    public.is_admin()
    or (
      tenant_id = public.current_active_tenant()
      and (
        public.current_agency_role() in ('encargado','dueno_admin')
        or exists (
          select 1 from public.reservas r
          where r.id = pagos.reserva_id
            and r.seller_staff_id = (
              select s.id from public.agency_staff s
              where s.member_user_id = auth.uid()
                and s.tenant_id = public.current_active_tenant()
              limit 1
            )
        )
      )
    )
  );
drop policy if exists pagos_role_write on public.pagos;
create policy pagos_role_write on public.pagos
  as restrictive for all to authenticated
  using (
    public.is_admin()
    or ( tenant_id = public.current_active_tenant()
         and public.current_agency_role() in ('encargado','dueno_admin') )
  )
  with check (
    public.is_admin()
    or ( tenant_id = public.current_active_tenant()
         and public.current_agency_role() in ('encargado','dueno_admin') )
  );
-- NOTA: registro de pago en flujo público vía service client (service_role).

-- comprobantes: vendedor solo los de sus reservas (vía pago->reserva); encargado/dueno_admin todos
alter table public.comprobantes enable row level security;
drop policy if exists comprobantes_role_select on public.comprobantes;
create policy comprobantes_role_select on public.comprobantes
  as restrictive for select to authenticated
  using (
    public.is_admin()
    or (
      tenant_id = public.current_active_tenant()
      and (
        public.current_agency_role() in ('encargado','dueno_admin')
        or exists (
          select 1 from public.pagos p
          join public.reservas r on r.id = p.reserva_id
          where p.id = comprobantes.pago_id
            and r.seller_staff_id = (
              select s.id from public.agency_staff s
              where s.member_user_id = auth.uid()
                and s.tenant_id = public.current_active_tenant()
              limit 1
            )
        )
      )
    )
  );
drop policy if exists comprobantes_role_write on public.comprobantes;
create policy comprobantes_role_write on public.comprobantes
  as restrictive for all to authenticated
  using (
    public.is_admin()
    or ( tenant_id = public.current_active_tenant()
         and public.current_agency_role() in ('encargado','dueno_admin') )
  )
  with check (
    public.is_admin()
    or ( tenant_id = public.current_active_tenant()
         and public.current_agency_role() in ('encargado','dueno_admin') )
  );
-- NOTA: bucket PRIVADO 'tenant-media' (ya existe, 20260511_004); storage_path bajo prefijo tenant_id/.

-- commission_rulesets: solo dueno_admin RW (resto deny).
alter table public.commission_rulesets enable row level security;
drop policy if exists commission_rulesets_admin_select on public.commission_rulesets;
create policy commission_rulesets_admin_select on public.commission_rulesets
  as restrictive for select to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() = 'dueno_admin') );
drop policy if exists commission_rulesets_admin_write on public.commission_rulesets;
create policy commission_rulesets_admin_write on public.commission_rulesets
  as restrictive for all to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() = 'dueno_admin') )
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() = 'dueno_admin') );

-- commission_splits: vendedor SOLO su renglón (beneficiary = su staff_id), nunca el de otros.
--   encargado/dueno_admin ven todo el tenant. Write materializado en F9 (service_role).
alter table public.commission_splits enable row level security;
drop policy if exists commission_splits_role_select on public.commission_splits;
create policy commission_splits_role_select on public.commission_splits
  as restrictive for select to authenticated
  using (
    public.is_admin()
    or (
      tenant_id = public.current_active_tenant()
      and (
        public.current_agency_role() in ('encargado','dueno_admin')
        or (
          public.current_agency_role() = 'vendedor'
          and beneficiary_staff_id = (
            select s.id from public.agency_staff s
            where s.member_user_id = auth.uid()
              and s.tenant_id = public.current_active_tenant()
            limit 1
          )
        )
      )
    )
  );
drop policy if exists commission_splits_admin_write on public.commission_splits;
create policy commission_splits_admin_write on public.commission_splits
  as restrictive for all to authenticated
  using ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() = 'dueno_admin') )
  with check ( public.is_admin() or (tenant_id = public.current_active_tenant()
    and public.current_agency_role() = 'dueno_admin') );
-- NOTA: el materializado de comisiones (F9) corre típicamente vía service_role (bypassa RLS).

-- ============================================================================
-- [FIX C5] PERMISSIVE base por tabla — IMPRESCINDIBLE.
-- Postgres RLS = (OR de PERMISSIVE) AND (AND de RESTRICTIVE). Las 41 policies de arriba son
-- RESTRICTIVE (recortan, no conceden). Sin PERMISSIVE base, el OR-set es vacio => deny-all para
-- authenticated => back-office inaccesible (blocker C5, cazado por SE cold). Patron v2 vivo
-- (leads_tenant.leads_member_read / sites): la PERMISSIVE concede acceso tenant-scoped, la
-- RESTRICTIVE lo recorta por rol. Aca: PERMISSIVE FOR ALL concede acceso a filas del tenant
-- activo (o admin); las RESTRICTIVE de arriba lo recortan a rol/own-rows. service_role bypassa
-- RLS (seed / API publica), no depende de esto.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'agency_staff','providers','excursions','passenger_categories','excursion_rates',
    'excursion_departures','payment_methods','commission_rulesets','reservas',
    'reserva_pasajeros','pagos','comprobantes','commission_splits'
  ] loop
    execute format('drop policy if exists %I on public.%I', t||'_tenant_base', t);
    execute format(
      'create policy %I on public.%I as permissive for all to authenticated '
      || 'using ( public.is_admin() or tenant_id = public.current_active_tenant() ) '
      || 'with check ( public.is_admin() or tenant_id = public.current_active_tenant() )',
      t||'_tenant_base', t);
  end loop;
end$$;

commit;
