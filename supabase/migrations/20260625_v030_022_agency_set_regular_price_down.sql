-- #24 v030_022_agency_set_regular_price (DOWN)
-- No-destructivo de datos: solo retira la capacidad de escritura. Los
-- price_regular_ars ya seteados en content_json quedan como esten (no se revierten;
-- eran editables a mano antes de esta RPC). Dropea solo la funcion.
begin;

drop function if exists public.agency_set_regular_price(uuid, numeric);

commit;
