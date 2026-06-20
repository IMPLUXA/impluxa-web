-- v030_011 — F1a abierto-por-defecto: capacity_default por excursion.
-- Additivo + reversible. El cupo de una fecha VIRGEN (sin fila excursion_departures)
-- sale de aca. Las departures sembradas conservan su capacity propia (override por
-- fecha/hora). NULL = excursion NO configurada para open-booking (la RPC rechaza
-- reservar una fecha virgen de esa excursion). Backfill 50 para las existentes (CEO s59).
-- NO toca capacity de excursion_departures (los overrides quedan como estan).

alter table public.excursions
  add column if not exists capacity_default integer;

alter table public.excursions
  drop constraint if exists excursions_capacity_default_check;
alter table public.excursions
  add constraint excursions_capacity_default_check
  check (capacity_default is null or capacity_default >= 0);

-- Backfill: 50 para todas las excursiones existentes (decision CEO). Solo las que
-- estan en NULL (idempotente si se re-corre).
update public.excursions
   set capacity_default = 50
 where capacity_default is null;
