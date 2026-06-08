-- Down migration for v0.3.0 F1 — Agency schema.
-- Drop en orden INVERSO de FKs. Tablas con `cascade` por seguridad (limpia policies + FKs entrantes).
-- NO toca: append_audit / audit_log / buckets storage / helpers current_active_tenant / is_admin
--   (todos preexistentes, fuera de scope de esta migración).
-- Recrear con 20260608_v030_001_agency_schema.sql.

begin;

-- Soltar FK diferido primero (defensivo; el drop table cascade igual lo limpiaría).
alter table if exists public.reservas
  drop constraint if exists reservas_commission_ruleset_fk;

-- Orden inverso de dependencias:
drop table if exists public.commission_splits cascade;
drop table if exists public.comprobantes cascade;
drop table if exists public.pagos cascade;
drop table if exists public.reserva_pasajeros cascade;
drop table if exists public.reservas cascade;
drop table if exists public.commission_rulesets cascade;
drop table if exists public.payment_methods cascade;
drop table if exists public.excursion_departures cascade;
drop table if exists public.excursion_rates cascade;
drop table if exists public.passenger_categories cascade;
drop table if exists public.excursions cascade;
drop table if exists public.providers cascade;
drop table if exists public.agency_staff cascade;

-- Helper nuevo de esta migración. CASCADE defensivo (resuelve flag SE): tras dropear las 13
-- tablas, las policies que lo referencian ya no existen -> el drop funciona sin CASCADE igual,
-- pero CASCADE lo hace robusto a cualquier orden/dependiente residual. Probado en preview.
drop function if exists public.current_agency_role() cascade;

commit;
