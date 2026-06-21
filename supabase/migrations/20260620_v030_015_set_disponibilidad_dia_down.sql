-- v030_015 down — dropea la RPC de acciones del calendario. Additivo: revertir no afecta el
-- motor F1a ni el read-model F1b.1 (solo se pierden cerrar/limitar/reabrir desde el calendario;
-- la tabla CRUD/Lista sigue editando via el route POST/PATCH). Los overrides ya creados quedan.
drop function if exists public.agency_set_disponibilidad_dia(uuid, date, text, integer);
