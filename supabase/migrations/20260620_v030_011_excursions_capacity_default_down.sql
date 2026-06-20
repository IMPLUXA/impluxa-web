-- v030_011 down — revierte capacity_default. Reversible total (columna additiva).
alter table public.excursions
  drop constraint if exists excursions_capacity_default_check;
alter table public.excursions
  drop column if exists capacity_default;
