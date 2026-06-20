-- Migration: v030_009 — mp_webhook_dead_letter (F4b build MP s56)
--
-- Registro DURABLE de notificaciones MercadoPago que el webhook YA VALIDADO (firma HMAC)
-- NO pudo procesar a confirmación: token vencido/401 (D2, sin refresh), refunded/charged_back
-- fuera del modelo de la RPC (D1, sin reversa), tenant irresoluble, rechazo de negocio de la
-- RPC, payment no encontrado, etc. Es la RED de seguridad de D3: un cobro que no se confirma
-- queda acá para revisión/acción manual (nunca se pierde en silencio). La alerta Telegram es
-- notificación best-effort encima; ESTA tabla es la verdad persistente.
--
-- RLS posture (idéntica a tenant_mp_credentials, v030_005): service_role ÚNICAMENTE. RLS
-- enabled SIN policies => default-deny para todo no-service_role (belt) + REVOKE ALL de
-- public/anon/authenticated (suspenders). El webhook (service client) inserta; la revisión
-- la hace un operador con service_role.
--
-- ALLOWLIST DE DATOS (seguridad — verificado en el diseño): esta tabla JAMÁS guarda el
-- access_token ni PII del pagador (email/doc/nombre/tarjeta). Solo ids públicos (payment id,
-- collector/mp_user_id, tenant_id) + un excerpt allowlist de la notificación (type/topic/
-- data.id/user_id). El body de /v1/payments (que trae PII del payer) NUNCA entra acá.
--
-- Aislamiento Hakuna: DDL ADITIVO (tabla nueva mp_webhook_dead_letter + índice unique
-- aditivo sobre tenant_mp_credentials, ver §2 al pie). No toca pagos/reservas/payment_methods/
-- agency_* ni el path de cobro de Hakuna (Hakuna no tiene fila en tenant_mp_credentials).
-- Cero filas al aplicar la tabla. Sin FK a tenants A PROPÓSITO:
-- un registro de error no debe fallar/borrarse por el ciclo de vida del tenant (tenant_id
-- informativo, nullable).
--
-- Rollback: ver _down.sql (drop index + drop table; tabla aditiva y vacía al aplicar).

begin;

create table if not exists public.mp_webhook_dead_letter (
  id              uuid primary key default gen_random_uuid(),
  received_at     timestamptz not null default now(),
  data_id         text,                 -- mp payment id (público)
  x_request_id    text,
  topic           text,
  reason          text not null,        -- token_unauthorized | unhandled_status:<s> | unresolved_tenant | rpc_business:<code> | payment_not_found | ...
  tenant_id       uuid,                 -- si se resolvió (informativo; sin FK a propósito)
  mp_user_id      text,                 -- collector/seller id (público)
  payment_status  text,                 -- status del payment fetched, si llegó a fetchearse
  notif_excerpt   jsonb,                -- SOLO allowlist de la notif (type/topic/data.id/user_id). NUNCA token ni PII.
  status          text not null default 'pending'
                    check (status in ('pending','resolved')),
  resolved_at     timestamptz,
  notes           text
);

create index if not exists mp_webhook_dead_letter_pending_idx
  on public.mp_webhook_dead_letter (received_at)
  where status = 'pending';

alter table public.mp_webhook_dead_letter enable row level security;

revoke all on public.mp_webhook_dead_letter from public, anon, authenticated;
grant select, insert, update, delete on public.mp_webhook_dead_letter to service_role;

comment on table public.mp_webhook_dead_letter is
  'F4b MP: registro durable de notificaciones MercadoPago no confirmadas (token-401, '
  'refunded/charged_back, tenant irresoluble, rechazo de negocio). RLS service_role only, '
  'sin policies (default deny) + REVOKE ALL. Allowlist: NUNCA token ni PII del payer. '
  'Red de seguridad D3 (la alerta Telegram es best-effort encima). v030_009 build MP s56.';

-- §2 — Blindaje multi-tenant (Two-Pass cold s56, finding "mp_user_id no único"):
-- una cuenta MP (mp_user_id) NO puede estar CONECTADA en 2 tenants a la vez. Índice UNIQUE
-- PARCIAL where status='connected': permite reconectar tras desconectar (filas revoked/
-- expired NO bloquean) y sirve además de índice de lookup para getTenantByMpUserId (que
-- filtra mp_user_id + status='connected'). Se incluye acá porque v030_009 aún NO está
-- aplicada (entra limpio; hoy solo PV conectado → cero conflicto). Complementa el índice
-- NO-unique de v030_005 (tenant_mp_credentials_mp_user_idx), que se conserva.
create unique index if not exists tenant_mp_credentials_mp_user_connected_uk
  on public.tenant_mp_credentials (mp_user_id)
  where status = 'connected';

commit;

-- ============================================================================
-- DOWN (pre-tipeado, ver _down.sql) — tabla aditiva + índice unique aditivo:
--   drop index if exists public.tenant_mp_credentials_mp_user_connected_uk;
--   drop index if exists public.mp_webhook_dead_letter_pending_idx;
--   drop table if exists public.mp_webhook_dead_letter;
-- ============================================================================
