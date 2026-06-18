-- v030_003 down — AUTORADO s56 (el _down original no se commiteó al repo; este
-- reconstruye el rollback estándar: dropear la función creada por el UP).
-- El UP nunca tuvo _down en prod (las migraciones se aplican forward); este
-- archivo existe por convención del repo (cada UP tiene su _down).
begin;
drop function if exists public.agency_crear_reserva(uuid, text, jsonb, text, text, text, integer, uuid, text);
commit;
