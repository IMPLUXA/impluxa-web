-- DOWN de v030_007 — F5 confirmar_pago_webhook (rollback build MP s55).
-- Reverso inmediato post-apply (antes de que existan filas 'cancelado'): el revert del
-- check a 3 valores solo es válido si NO hay pagos en estado 'cancelado'.

begin;

drop function if exists public.confirmar_pago_webhook(uuid, uuid, text, numeric, text, text);
drop index if exists public.pagos_tenant_mp_payment_uk;

alter table public.pagos drop constraint if exists pagos_status_check;
alter table public.pagos add constraint pagos_status_check
  check (status in ('pendiente','confirmado','rechazado'));

commit;
