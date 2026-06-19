-- v030_009 down — drop de la tabla dead-letter (aditiva). Rollback seguro inmediato
-- post-apply (tabla vacía al aplicar; si ya tuviera registros de dead-letter, dropearla
-- los pierde — exportar antes si hace falta auditoría).
begin;
-- índice unique aditivo de §2 (blindaje multi-tenant) — se dropea primero
drop index if exists public.tenant_mp_credentials_mp_user_connected_uk;
drop index if exists public.mp_webhook_dead_letter_pending_idx;
drop table if exists public.mp_webhook_dead_letter;
commit;
