-- v030_004 down — AUTORADO s56 (el _down original no se commiteó al repo; este
-- reconstruye el rollback estándar de lo que crea el UP: la función + el índice
-- de idempotencia + la columna idempotency_key). El UP nunca tuvo _down en prod
-- (forward-only); existe por convención del repo.
-- CAVEAT: dropear la columna idempotency_key pierde los datos de esa columna —
-- rollback destructivo, solo seguro inmediato post-apply.
begin;
drop function if exists public.agency_confirmar_reserva(uuid, jsonb, boolean);
drop index if exists public.pagos_tenant_idem_uk;
alter table public.pagos drop column if exists idempotency_key;
commit;
