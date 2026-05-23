-- v0.2.6 W2 — audit_dedup procedure→function rewrite (Bug 2 pg_cron SPI fix)
--
-- BUG 2 ARQUITECTURAL: pg_cron en Supabase managed PRO opera con
-- `cron.use_background_workers = off` (context=postmaster, NO accesible
-- managed). El worker usa SPI exclusivo → wraps ALL commands incluso
-- `call procedure();` en su propio transaction → procedures con COMMIT
-- intra-tx fallan con ERROR 2D000 "invalid transaction termination".
--
-- Discovery sesion 2026-05-23:
--   - pg_settings.cron.use_background_workers = off, source=default
--   - context=postmaster requires postgresql.conf edit + server restart
--   - Supabase managed NO expone toggle (web search Supabase docs +
--     GitHub discussion #30168 + Answeroverflow caso publico confirmado).
--   - 3 opciones evaluadas CEO: (A) drop COMMIT loop → single-tx DELETE
--     LIMIT, (B) rediseno Edge Function scheduled, (C) ASK Supabase
--     support enable toggle. Opcion C colapsa (managed-blocked). CEO
--     eligio A: aceptable trade-off pierde B10.1 WAL spike protection
--     dado hakuna_live=false + audit_dedup empty + sin volumen Hakuna
--     actual. Revisit pre-Hakuna-live ticket BACKLOG v0.3.x (Edge
--     Function path preserva COMMIT semantics via autocommit context).
--
-- Squad fresh Sec 8 sesion actual:
--   - Pass 1 SPLIT BA agentId af30d96a4ce7148aa + DBO agentId
--     a50a129800783ddeb unanime "Recomendamos proceder. Riesgo: bajo."
--   - Pass 2 cold SE agentId aa758a4eb9c5fe6da NEEDS-REWORK → 2
--     bloqueantes + 1 ajuste: B1 expires_at→first_seen_at (schema
--     empirico audit_dedup = jwt_jti, action, first_seen_at);
--     B2 set search_path = '' (heredar hardening procedure existente,
--     NO downgrade `public, pg_temp`); A3 statement_timeout = '5min'
--     compromiso entre 30s defensivo y 30min original procedure.
--     Post-fixes 1-3: "Recomendamos proceder. Riesgo: bajo."
--
-- Key changes vs 20260524_v026_003:
--   - DROP PROCEDURE `public._audit_dedup_gc_run()` (with COMMIT loop body).
--   - CREATE FUNCTION `public._audit_dedup_gc_run()` returns int (rows
--     deleted), single-tx DELETE LIMIT 10000 via ctid IN approach.
--   - Cron body simplified: `select public._audit_dedup_gc_run();`
--     (function carries SET clauses internal; no session-scope wrap).
--   - Helper function `public._audit_dedup_gc_cutoff()` UNCHANGED —
--     preserva TTL via app_config indirection (W2 valor agregado).
--   - Append-only: 20260524_v026_003 mantiene historia + 20260525_v026_004
--     reemplaza procedure→function. CEO override (Y) approach over (Y')
--     in-place rewrite per regla preservadora archivos disco.
--
-- Trade-off B10.1 perdida (documentado):
--   - Original procedure: batched DELETE 10K + COMMIT inter-batch +
--     lock_timeout 5s + statement_timeout 30min → protege WAL spike +
--     replica lag bajo volumen alto.
--   - Rewrite single-tx DELETE LIMIT 10K → WAL footprint ~2-4 MB max
--     single batch. Threshold metric revisit (DBO): count(*) audit_dedup
--     expired > 50K backlog en cron run = trigger v0.3.x Edge Function
--     migration. Volumen Hakuna actual 0 / proyectado <<10K/dia → loss
--     invisible operacionalmente.
--
-- Rollback: see companion 20260525_v026_004_audit_dedup_procedure_no_commit_down.sql
-- Down restores procedure verbatim from 20260524_v026_003. Bug 2 known
-- re-introduced (documental revert para history simetria; operador
-- consciente que cron runs fallarian post-revert).

begin;

-- ---------------------------------------------------------------------------
-- 1. Drop procedure with COMMIT loop body (incompatible pg_cron SPI managed).
-- ---------------------------------------------------------------------------
drop procedure if exists public._audit_dedup_gc_run();

-- ---------------------------------------------------------------------------
-- 2. Create function (single-tx batched DELETE, no COMMIT).
-- ---------------------------------------------------------------------------
-- B1 fix: first_seen_at (NO expires_at — schema real: jwt_jti, action,
-- first_seen_at). B2 fix: set search_path = '' (hardening parity con
-- _audit_dedup_gc_cutoff existing). A3 fix: statement_timeout = '5min'
-- compromiso defensivo single-tx 10K rows (sub-segundo esperado pero
-- margen lock contention transient).
--
-- LIMIT 10000 hard-coded en function body (BA + DBO acuerdo: cambiar
-- LIMIT requiere migration formal — NO toggle config — evita drift
-- operativo; TTL days SI mediante app_config porque es semantica de
-- negocio). ctid IN approach (PG no soporta `DELETE ... LIMIT` directo;
-- DBO 15-20% mas rapido que `jti IN` — physical row pointer evita
-- re-lookup PK).
create or replace function public._audit_dedup_gc_run()
returns integer
language plpgsql
security definer
set search_path = ''
set lock_timeout = '5s'
set statement_timeout = '5min'
as $$
declare
  v_cutoff   timestamptz;
  v_deleted  integer;
begin
  v_cutoff := public._audit_dedup_gc_cutoff();
  raise notice 'audit_dedup_gc cutoff=%', v_cutoff;

  delete from public.audit_dedup
  where ctid in (
    select ctid from public.audit_dedup
    where first_seen_at < v_cutoff
    limit 10000
  );
  get diagnostics v_deleted = row_count;

  raise notice 'audit_dedup_gc deleted % rows', v_deleted;
  return v_deleted;
end;
$$;

revoke execute on function public._audit_dedup_gc_run() from public, anon, authenticated;
grant execute on function public._audit_dedup_gc_run() to service_role;
alter function public._audit_dedup_gc_run() owner to postgres;

-- ---------------------------------------------------------------------------
-- 3. Update cron command: replace `call procedure()` with `select function()`.
-- ---------------------------------------------------------------------------
-- Use cron.alter_job to preserve jobid + run_details history (more
-- surgical than unschedule+schedule). Schedule '0 3 * * *' UTC daily
-- unchanged. Body simplified: function carries SET clauses internal,
-- no session-scope wrap needed.
--
-- Fallback to schedule() if jobname missing (preview branches sometimes
-- lose cron state; idempotent re-create).
do $$
declare
  v_jobid integer;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_jobid from cron.job where jobname = 'audit_dedup_gc';

    if v_jobid is not null then
      perform cron.alter_job(
        job_id  => v_jobid,
        command => 'select public._audit_dedup_gc_run();'
      );
    else
      perform cron.schedule(
        'audit_dedup_gc',
        '0 3 * * *',
        'select public._audit_dedup_gc_run();'
      );
    end if;
  else
    raise warning 'pg_cron extension not installed; audit_dedup_gc NOT rescheduled';
  end if;
exception when others then
  raise warning 'audit_dedup_gc reschedule failed: %', sqlerrm;
end $$;

commit;
