-- v030_014 down — dropea el read-model del calendario (wrapper + core). Read-only/additivo:
-- revertir no afecta datos ni el motor F1a (solo se pierde la lectura del calendario).
drop function if exists public.agency_calendario_salidas(uuid, date, date);
drop function if exists public._agency_calendario_core(uuid, uuid, date, date);
