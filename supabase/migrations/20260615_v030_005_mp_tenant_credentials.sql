-- Migration: v030_005 — tenant_mp_credentials (F1 del build MercadoPago, s55)
--
-- Cimiento del OAuth-connect MercadoPago multi-tenant. Guarda, POR TENANT, los
-- tokens OAuth del vendedor (access + refresh) CIFRADOS app-level (libsodium/
-- AES-256-GCM; la clave maestra vive en env Vercel, NUNCA en Postgres). Esta
-- tabla solo guarda el ciphertext (bytea); el cifrado/descifrado ocurre 100%
-- server-side (Route Handlers / Server Actions), nunca en cliente ni en RLS.
--
-- RLS posture (idéntica a public.app_config / public.audit_dedup):
--   service_role ÚNICAMENTE. authenticated y anon NO pueden SELECT/INSERT/UPDATE/
--   DELETE. RLS enabled SIN policies => default-deny para todo no-service_role
--   (belt). REVOKE ALL de public/anon/authenticated => sin privilegio de tabla
--   (suspenders). config.toml expone solo {public, graphql_public} y
--   auto_expose_new_tables está unset => la tabla NO se auto-expone igual.
--   El estado de conexión legible-por-el-dueño (booleano, sin token) NO vive
--   acá: se entrega en F2 vía RPC SECURITY DEFINER que jamás devuelve el token.
--
-- Aislamiento Hakuna: DDL ADITIVO (tabla nueva). No toca payment_methods/pagos/
--   agency_* ni el path de cobro de Hakuna. Cero filas al aplicar.
--
-- Rollback (DOWN pre-tipeado, ver al pie): drop index + drop table (tabla vacía).

begin;

create table if not exists public.tenant_mp_credentials (
  tenant_id                uuid primary key references public.tenants(id) on delete cascade,
  mp_user_id               text,                 -- collector/seller id de la cuenta MP conectada (no sensible)
  access_token_ciphertext  bytea not null,       -- access_token cifrado app-level
  access_token_nonce       bytea not null,
  refresh_token_ciphertext bytea not null,       -- refresh_token cifrado app-level
  refresh_token_nonce      bytea not null,
  key_version              smallint not null default 1,  -- rotación de clave maestra sin re-cifrar a ciegas
  scope                    text,                 -- scope concedido por MP (incluye offline_access)
  expires_at               timestamptz not null, -- vencimiento del access_token (now + 180d)
  refresh_expires_at       timestamptz,          -- vencimiento del refresh_token (now + 6m), si MP lo informa
  status                   text not null default 'connected'
                             check (status in ('connected','expired','revoked')),
  connected_at             timestamptz not null default now(),
  last_refresh_at          timestamptz,
  updated_at               timestamptz not null default now()
);

-- mapeo webhook->tenant por collector id (resolución de notificaciones MP)
create index if not exists tenant_mp_credentials_mp_user_idx
  on public.tenant_mp_credentials(mp_user_id)
  where mp_user_id is not null;

alter table public.tenant_mp_credentials enable row level security;

revoke all on public.tenant_mp_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.tenant_mp_credentials to service_role;

comment on table public.tenant_mp_credentials is
  'Tokens OAuth MercadoPago por-tenant, CIFRADOS app-level (clave maestra en env, '
  'no en Postgres). RLS: service_role only, sin policies (default deny) + REVOKE ALL '
  'de authenticated/anon. El cifrado/descifrado es server-side. Estado de conexion '
  'legible-por-dueno (sin token) se entrega via RPC en F2. v030_005 build MP s55.';

commit;

-- ============================================================================
-- DOWN (pre-tipeado, para rollback / ASK) — tabla aditiva y vacía al aplicar:
--   drop index if exists public.tenant_mp_credentials_mp_user_idx;
--   drop table if exists public.tenant_mp_credentials;
-- ============================================================================
