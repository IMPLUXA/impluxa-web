-- DOWN v030_018 — quita la RPC pública + el índice + la columna idempotency_key.
-- La columna es additiva/nullable; el motor agency_crear_reserva no la usa -> drop seguro
-- (rollback en ventana sin reservas anon; si hubiera reservas anon con key, conservarlas
-- implica no dropear la columna — evaluar en su momento).
begin;
drop function if exists public.public_crear_reserva(uuid, date, text, jsonb, text, text, text, text);
drop index if exists public.reservas_tenant_idempotency_idx;
alter table public.reservas drop column if exists idempotency_key;
commit;
