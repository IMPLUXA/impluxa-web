# ADR-0010: Sub-paso 5.B Cut B-truncado — deferred consumers, security-freeze invariants, migration discipline

- **Status:** Accepted
- **Date:** 2026-05-19 (sesion 15)
- **Deciders:** Claudia CoS + Squad caso #8 fresh Two-Pass extended (8 agents real). CEO Jota sign-off via session 15 directives.
- **Context tag:** v0.2.6 W1.T1 Sub-paso 5.B (Cut B-truncado SHIPPED s13 + 5B.7 SPEC synthesis s15)
- **Related:**
  - SPEC §10 (`D:\impluxa-web\.planning\v0.2.6\SPEC.md`)
  - RUNBOOK-5B.md (`D:\impluxa-web\.planning\v0.2.6\RUNBOOK-5B.md`)
  - BACKLOG (`D:\impluxa-web\.planning\BACKLOG.md`)
  - ADR-0005 auth re-architecture (claim-based session + APPROVAL_GATE break-glass)
  - ADR-0007 audit log partitioned + SHA-256 hash chain
  - ADR-0009 Sentinel allowlist bug workaround (analog for Array.join discipline)

## Context

Sub-paso 5.B (Cut B-truncado) ships under v0.2.6 W1.T1 a reduced-scope cut of the original W1.T1 spec. The Cut B work was completed across sessions 13 (code SHIPPED) and 15 (SPEC + ADR + tests synthesis). Two-Pass extended caso #8 fresh in s15 produced 8 dossiers (3 primer + 3 cold + 2 re-review C-H2) and surfaced 10 findings — 5 HIGH downgraded/resolved inline and 3 deferred to W1.T2 with explicit tripwire mechanisms.

This ADR records the architectural decisions implicit in those 5B.7 SPEC §10 findings that future contributors must respect to avoid silently breaking the security and operational properties they preserve.

The decisions below are not separable — they form a coherent design where (a) producer-side observability + consumer-side collapse handles signal-hygiene at the gate, (b) skeleton tables ship without consumers when scope discipline matters more than completeness, (c) module-load environment freeze is a security invariant not a performance choice, (d) migration rollback contracts MUST drop precedente when return types change, and (e) date-bound operational deadlines are first-class architectural commitments.

## Decisions

### D10.1 — APPROVAL_GATE module-load freeze is a security invariant (I1 + I9)

The `APPROVAL_GATE_ENABLED` environment variable is read **once** at module load in `src/lib/runtime-config.ts` and frozen for the lifetime of the Node.js process. Both guard entrypoints (`requireActiveTenantOrRedirect` and `requireActiveTenantOrResponse`) consult the same frozen value.

This is NOT a performance optimization (an environment-variable read is microseconds). It is an **explicit security property**: a future "fix" to per-call read would silently invalidate the break-glass intent declared in ADR-0005 §5. Under per-call read, an attacker who gains process-environment mutation capability (e.g., via a debugging tool or container injection) could flip the kill switch mid-runtime without restart. Module-load freeze pins the security posture to deploy boundary, where it is auditable.

**Enforcement**: invariant I9 in SPEC §10.3. Integration test in 5B.9 asserts that mutating the underlying variable post-module-load does NOT change the guard's behavior.

**Revisit trigger**: only if a use case emerges that requires legitimate runtime toggling (e.g., feature flag system). At that point, replace the read with a typed feature-flag SDK + ADR superseding D10.1. Do NOT change the freeze pattern silently.

### D10.2 — Producer-warn + consumer-collapse design for `audit_dedup` JTI-null bypass (C-H2)

When a `tenant-claim` action audit payload has `jwt_jti` null/empty, the `audit_dedup` SQL gate (`20260518_v026_001_audit_dedup.sql:143`) skips the dedup `if` block (it requires non-null `v_jti`) and `append_audit` inserts a fresh row per call. Without mitigation, a retry storm could inflate `claim_missing` counts surfaced by `scripts/observe-rls-burn-readiness.ts`.

The architectural choice is **producer-warn + consumer-collapse**, not producer-gate. Rationale captured by Two-Pass extended caso #8 fresh + internal re-review (BA `a874a47a54370a774` + SE `a7b8b19469251fd2f`):

- **Direction of corruption is fail-closed** (false NO-GO = safe; the only exploitable direction would be false GO which does not exist because the script verdict is binary `> 0` at `observe-rls-burn-readiness.ts:249-254`).
- **The real flip gate is human Rey sign-off** (SPEC.md:60), not the script auto-verdict. Count inflation does not amplify the verdict.
- **Producer-side rejection** (drop JTI-null at auth boundary) breaks T5 compat — the auth issuer occasionally emits JTI-null tokens during normal SDK rotation cycles (SE re-review S2 scenario).
- **Producer-side fail-closed** at `audit.ts` (drop warn, return without `append_audit`) reverses fail direction to UNSAFE — a successful claim with audit-write failure would silently succeed.
- **Schema change** (synthetic dedup PK including `(actor_user_id, action, day_bucket)`) is out of Cut B scope and would re-open partition machinery.

The producer side (in `src/lib/auth/audit.ts:80-110`) emits a `console.warn` with structured payload `{event: "audit_dedup_bypass_missing_jti", action, actor_user_id}` and lets `append_audit` proceed. The consumer side (in `scripts/observe-rls-burn-readiness.ts`, to be added in W1.T2) collapses `(actor_user_id, minute-bucket)` before counting against the gate, with a separate observability counter for "raw rows before collapse".

**Enforcement**:

- Producer TODO at `src/lib/auth/audit.ts:80` (committed s15).
- Consumer closure test in W1.T2: `tests/integration/observe-rls-burn-readiness-jti-null-collapse.test.ts` with 4 named assertions (a/b/c/d) — see BACKLOG entry C-H2.
- 3-tripwire mechanism per CEO directive s15 (TODO + SPEC ref + BACKLOG entry) keeps the defer auditable.

**Revisit trigger**: if telemetry shows JTI-null is more common than once-per-N-thousand tokens, or if a use case emerges where the consumer-collapse approach causes downstream readers to miss signals, escalate to schema-level dedup PK in v0.2.7+.

### D10.3 — `app_config` ships as skeleton with deferred consumer (DB-H1)

Migration `20260519_v026_002_app_config.sql` creates `public.app_config` as a generic key-value table with RLS enabled, zero policies (deny-all for `anon`/`authenticated`), `service_role` write/read. The migration documents `key='hook_reenable_ts'` as a reserved key but no script in HEAD `b7ed8d6` reads it.

Cold-round BA flagged this as "plumbing-dead" HIGH (C-H3 joint with DBO DB-H1). The architectural choice is **ship-as-skeleton with deferred consumer**, not wire-now-or-defer-table:

- **Scope discipline matters more than completeness** for Cut B. The original W1.T1 included `claim_missing` + `active_tenant_null` writers + observability consumer wiring; session 13 truncation deferred all three to W1.T2. Shipping the table alone preserves the migration footprint without expanding 5B.7 scope.
- **Future-proof migration ordering**. The table needs to exist before any consumer can read it; landing the migration in Cut B avoids a W1.T2 PR that touches migrations in addition to TypeScript (cleaner blast radius per PR).
- **OQ-4 LOCKED means the deprecated path is the only consumer scenario**. The script today uses `--since-first-claim-mint` anchor (OQ-4 LOCKED) which does NOT need `app_config`. The deprecated `--since-hook-reenable` flag is preserved for emergency rollback and is the natural consumer of `hook_reenable_ts`.

**Enforcement**:

- Code TODO at `scripts/observe-rls-burn-readiness.ts` immediately above `fetchFirstClaimMintT0` (committed s15).
- SPEC §10.5 reference.
- BACKLOG entry DB-H1.
- 3-tripwire mechanism per CEO directive s15.

**Revisit trigger**: if W1.T2 ships and the consumer wiring is NOT added there, escalate at next milestone cierre and treat as a regression on the defer commitment.

### D10.4 — pg_cron enable deadline is a first-class operational commitment (DB-H2)

Migration setup `20260514_v025_005_audit_log.sql` + `_006_audit_partition_rotation.sql` creates partitions `audit_log_2026_05/06/07` at apply (2026-05-14). The cron job `audit_log_rotate_partitions` is defined but only schedules when `pg_cron` extension is installed. **`pg_cron` is NOT installed in prod Hakuna at HEAD `b7ed8d6`**.

Mathematical derivation (RUNBOOK-5B.md §3):

- First INSERT failure date: `occurred_at >= '2026-08-01 00:00:00 UTC'`.
- Hard floor for pg_cron enable: **2026-07-24** (one day before the 2026-07-25 tick that creates `audit_log_2026_08`).
- Operational target: **2026-07-15** (10-day buffer).

This deadline is NOT a "nice to have" — it is an architectural commitment: the partition rotation design assumes pg_cron is enabled, and the migration explicitly emits a `raise warning` when it is not (`20260518_v026_001_audit_dedup.sql:99-101`). Operating past the hard floor causes production INSERT downtime until manual partition creation.

**Enforcement**:

- PR #6 description (5B.11 ASK CEO) MUST include the enable SQL block from RUNBOOK-5B.md §3.6 + both dates.
- RUNBOOK-5B.md §3 is the single source of truth for the math.
- Invariant I13 in SPEC §10.3.

**Revisit trigger**: at 2026-07-01 (mid-month before the operational target), Claudia checks pg_cron state via Supabase Management API; if not enabled, escalates to CEO with calendar-time pressure. If enabled before the operational target, this ADR section is closed.

### D10.5 — Migration rollback contract: `drop function if exists` precedente for return-type changes (I14, C-H1)

PostgreSQL rejects `CREATE OR REPLACE FUNCTION` when the new function has a different return type than the existing one (`ERROR 42P13: cannot change return type of existing function`). The Cut B up migration changes `append_audit` from `returns void` (v0.2.5 baseline) to `returns bigint` (the inserted row id). The original `_down.sql` rollback used `create or replace function ... returns void` without dropping first, which would fail with 42P13.

The architectural rule: **any migration that changes a function's return type MUST use `drop function if exists ... ; create function ...` in BOTH up and down migrations**, not `create or replace`.

This rule is the canonical analog of lesson `patches-operacionales-emergentes-durante-apply` patch #2 (caso fundacional s10a), where the same pattern surfaced during apply of a different migration.

**Enforcement**:

- C-H1 inline fix in `supabase/migrations/20260518_v026_001_audit_dedup_down.sql:28-35` (committed s15).
- Invariant I14 in SPEC §10.3.
- CI assertion: down migration applies without `42P13` error.

**Revisit trigger**: if PG ever supports `create or replace function ... overload return type`, the rule becomes a recommendation rather than a requirement. Track PG version notes; until then, the rule is mandatory.

### D10.6 — D-COLD-4 `pg_inherits` is the authoritative source for partition index propagation (DB-H3)

PG17 `pg_get_indexdef` displays partitioned indexes with `ON ONLY` syntax even when child partitions DO inherit the index. This caused a false alarm at session 13 (B1 in caso #7) that consumed ~2h of investigation before the cold round resolved it via `pg_inherits` query.

The architectural rule: **`pg_inherits` between parent index oid and child index oids is the authoritative source for partition index propagation**, NOT `pg_get_indexdef` or `pg_indexes` text.

The canonical verification block lives in RUNBOOK-5B.md §2 (copy-pasteable for any future investigation). Pass criterion: returns `(N_partitions × N_parent_indexes)` rows. For current state with 3 partitions × 3 parent indexes → expect **9 rows**.

**Enforcement**:

- RUNBOOK-5B.md §2 (committed s15).
- Any Squad cold round investigating `ON ONLY` MUST cite this block.
- Invariant I-meta: methodology reproducibility is required for caso fundacional verdicts (lesson `dossier-two-pass-extended-no-archivado-pre-cierre`).

**Revisit trigger**: if PG18 changes `pg_get_indexdef` to no longer display `ON ONLY` misleadingly, the rule becomes informational. Until then, mandatory.

### D10.7 — Empirically verified: COMMIT inside top-level DO block is legal on PG 17.6 Supabase managed (DBO-H5)

The cron `audit_dedup_gc` body at `20260518_v026_001_audit_dedup.sql:85-95` uses `commit;` between iterations of a DELETE-batching loop to release locks. Cold round DBO flagged this as version-dependent legality (pg_cron < 1.4 + `use_background_workers=off` historically rejected COMMIT in DO).

Empirical test session 15 on Supabase preview branch `v025-w2-preview` (project_ref `llyexugyuwwdqfarumbj`, PG 17.6, `cron.use_background_workers=off`, pg_cron NOT installed):

```sql
do $batch$
declare v_deleted bigint;
begin
  raise notice 'test commit-inside-do-block start';
  commit;
  raise notice 'test commit-inside-do-block survived commit';
end $batch$;
```

Returned empty result set with no error. **COMMIT inside top-level DO block is legal on PG 17.6 Supabase managed.**

The architectural rule: pg_cron in Supabase managed runs scheduled jobs as top-level SQL session executions where COMMIT in DO blocks is supported. The cron body pattern in migration 001 is correct as-is.

**Enforcement**:

- RUNBOOK-5B.md §5 documents the empirical test result.
- Final closure happens at pg_cron enable in prod (D10.4 deadline). At that point, an actual cron tick observation closes DBO-H5 to fully resolved.

**Revisit trigger**: if Supabase changes their pg_cron deployment topology (e.g., to use `use_background_workers=on` or to gate DO blocks differently), re-run the empirical test before re-enabling. Track Supabase platform notes.

## Consequences

### Positive

- **Security posture pinned to deploy boundary** (D10.1). Future contributors cannot silently weaken the kill-switch invariant by refactoring to per-call read; the invariant test in 5B.9 will fail.
- **Signal-hygiene controls split producer/consumer** (D10.2). The producer side is observable (warn logs) without breaking auth flow; the consumer side is the only enforcement point and lives in a single test-coverable script.
- **Scope discipline preserved** (D10.3). Cut B truncado ships exactly the minimum migrations needed; consumer wiring deferred with auditable tripwires.
- **Operational deadlines are first-class** (D10.4). Calendar-time risks have explicit math + RUNBOOK + invariant. The 2026-07-24 hard floor is not a vague "before summer" hand-wave.
- **Migration rollback contracts strengthened** (D10.5). The drop-precedente rule is now canonically documented; future migrations changing function signatures will follow it.
- **False alarm resilience** (D10.6). The pg_inherits methodology is a reusable artifact for any future partition-index investigation; no team will repeat the 2-hour B1 investigation.
- **Empirical verification over speculation** (D10.7). DBO-H5 was downgraded HIGH→LOW only after actual SQL execution on a real PG 17.6 Supabase instance.

### Negative

- **More cognitive load per migration**. Future contributors must remember D10.5 (drop precedente) when changing return types. Mitigated by RUNBOOK + ADR + lesson cross-reference; further mitigation: add a CI lint that flags `create or replace function .* returns` patterns where the function already exists.
- **Deferred consumers are a maintenance risk** (D10.2, D10.3). The 3-tripwire pattern (TODO + SPEC ref + BACKLOG) is the mitigation, but tripwires can rot if W1.T2 is itself deferred or fragmented. Mitigation: BACKLOG.md is reviewed at every milestone cierre.
- **Calendar-time architectural commitments are unusual** (D10.4). Most ADRs are deploy-time or code-time. The pg_cron deadline embeds operations into architecture explicitly. The trade-off is intentional: partition rotation is operationally fragile and treating its enable as an ordinary "we'll do it later" risks production downtime.
- **Empirical results are not contractual guarantees** (D10.7). Supabase's pg_cron deployment topology could change without notice. Mitigation: revisit trigger before re-enabling at any environment change.

## Verification

Compliance with this ADR is verified by:

1. **5B.9 integration tests** (next milestone) covering I3, I6, I9 (D10.1 + D10.2 enforcement).
2. **5B.10 Diff Two-Pass cold** (next sub-paso) auditing the synthesis SPEC + ADR + tests with 3 cold agents and 0 HIGH finding criterion.
3. **PR #6 description** including pg_cron enable SQL + both deadlines (D10.4 enforcement).
4. **BACKLOG.md cierre review** at every milestone (D10.2 + D10.3 tripwire reinforcement).
5. **W1.T2 SPEC** including the C-H2 closure test name and the DB-H1 consumer wiring as P0 items (D10.2 + D10.3 closure).

## References

- **Source synthesis**: `D:\impluxa-web\.planning\v0.2.6\SPEC.md` §10 (5B.7 SPEC synthesis sesion 15).
- **Squad dossiers**:
  - Primer pass: `W1.T1-5B-SPEC-PASS-1-{BA,DBO,PM}.md`
  - Cold round: `W1.T1-5B-SPEC-PASS-2-{BA,DBO,PM}.md`
  - C-H2 re-review: `W1.T1-5B-C-H2-REREVIEW-{BA,SE}-FRESH.md`
- **Operations runbook**: `RUNBOOK-5B.md`
- **Backlog**: `D:\impluxa-web\.planning\BACKLOG.md`
- **Lessons triangulated**:
  - `patches-operacionales-emergentes-durante-apply` (s10a) — analog of D10.5 drop precedente.
  - `two-pass-extended-validado-en-uso-real` (s9a) — methodology that surfaced these.
  - `dossier-two-pass-extended-no-archivado-pre-cierre` (s14) — discipline applied at s15 cierre.
- **Companion ADRs**:
  - ADR-0005 auth re-architecture (APPROVAL_GATE break-glass declared).
  - ADR-0007 audit log partitioned + hash chain (partition machinery base).
  - ADR-0009 Sentinel allowlist bug workaround (analog Array.join discipline).

## Change log

| Session | Author                                                | Change                                                                                                                                     |
| ------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| s15     | Claudia + Squad caso #8 fresh + re-review fresh BA+SE | Initial ADR-0010 documenting 7 decisions D10.1-D10.7 derived from SPEC §10. Cold synthesis post Two-Pass extended. 8 agent agentIds cited. |
