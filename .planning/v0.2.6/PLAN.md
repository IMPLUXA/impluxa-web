---
phase: v0.2.6
plan: 01
type: execute
version: v0.2.6
name: "RLS Burn + 2nd Tenant Onboarding (capability-only)"
status: draft
created: 2026-05-15
owner: Pablo (Rey Jota) + Lord Mano Claudia
spec_path: ./SPEC.md
research_path: ./RESEARCH.md
security_review_path: ./SECURITY-REVIEW.md
depends_on: [v0.2.5]
effort_estimate_days: 1.5-2 (excluye 24h observability gate humano)
branch: feature/v0.2.6-rls-burn-onboarding
hard_scope_locked: [FR-RLS-BURN-1, FR-RLS-BURN-2, FR-RLS-BURN-3]
candidate_scope_pending_rey: [CS-1 (OQ-3), CS-3 (OQ-8)]
candidate_scope_locked_consejo:
  [
    CS-2 (audits 1-3 done; audit 4 DB blocked by hook re-enable),
    CS-7 (T1 docs only),
  ]
decisions_locked_consejo_unanime:
  [
    OQ-1 Option B explicit rollback con frozen snapshot,
    OQ-2 hook re-enable OUTSIDE phase boundary,
    OQ-5 single atomic migration 4-DROP-POLICY 1-transaction,
    OQ-7 read-only telemetry script no-canary,
    OQ-9 REJECTED DB kill switch (5-layer mitigation stack),
    OQ-10 single PR squash-merge,
  ]
decisions_pending_rey:
  [
    OQ-3 CS-1a vs CS-1b (real vs dry-run),
    OQ-4 24h window T0 clock (BA tentative hook re-enable timestamp),
    OQ-8 CS-3 callback 410 data-dependent on Resend logs,
    Hard scope FR-RLS-BURN-2 burn-day OK,
    Pre-phase hook re-enable OK (Telegram msg_id=54 pending),
  ]
waves:
  W0: pre_phase_rey_gated_outside
  W1: instrumentation_audit_log_writers
  W2: burn_migration_draft_dry_run
  W3: observability_24h_gate_readiness_report
  W4: burn_apply_prod_post_burn_monitoring_adr
review_gates:
  - after_W1: Backend Architect + Security Engineer (audit_log writers don't break invariants)
  - after_W2: Database Optimizer + Security Engineer (migration shape + rollback snapshot freshness)
  - between_W3_W4: Rey OK explicit gravedad #21.a (burn-day apply)
  - after_W4: gsd-secure-phase + gsd-verify-work
sentinel_risk_summary:
  HIGH:
    [
      W0.T1 hook re-enable (Rey-gated outside),
      W4.T1 burn migration apply prod (Rey-gated),
      W4.T2 post-burn 1h intensive monitoring,
    ]
  MED:
    [
      W2.T1 burn migration SQL draft,
      W2.T2 rollback snapshot capture,
      W2.T3 dry-run preview branch apply,
    ]
  LOW:
    [
      W1 audit_log writers,
      W3 observability dashboard render,
      W4.T3 ADR-0005 v1.1 amend,
      CS-2 doc-only update,
      CS-7 partition runbook,
    ]
threat_model_layer_stack:
  L1: pre_burn_24h_gate
  L2: atomic_transaction_burn_migration
  L3: option_b_explicit_rollback_frozen_snapshot
  L4: app_layer_kill_switch_APPROVAL_GATE_ENABLED
  L5: post_burn_1h_intensive_monitoring
---

# v0.2.6 PLAN.md — RLS Burn + 2nd Tenant Onboarding

## Goal

Burn legacy v1 PERMISSIVE RLS policies on 4 tenant-owned tables (`sites`, `leads_tenant`, `subscriptions`, `activity_log`) per ADR-0005 commitment, **gated by 24h prod observability** with `custom_access_token_hook` re-enabled and zero `claim_missing` events from real users. Ship under 5-layer mitigation stack (pre-burn gate + atomic burn + explicit rollback snapshot + app-layer kill switch + post-burn monitoring). Update ADR-0005 → v1.1 with cutover record. Optional: bundle CS-2 docs deprecation closure + CS-7 partition runbook (T1).

**This phase has 2 explicit Rey choke points (gravedad #21.a, prod Hakuna):**

1. **W0.T1 hook re-enable** (pre-phase, OUTSIDE boundary per OQ-2) — Telegram msg_id=54 pending.
2. **W4.T1 burn apply** (post-W3 24h gate Rey OK) — separate Telegram ASK with telemetry summary attached.

**Non-goals this phase:** CS-1a (real 2nd tenant LIVE = v0.3.0), CS-4 (Send Email Hook reactivation = v0.2.7+), CS-5 (fuzz extension = bundle if cycles), CS-6 (hook re-enable IS the W0.T1, not v0.2.6 new work). DNS wildcard, custom domains, MercadoPago, LGPD compliance — explicitly NOT v0.2.6.

## Source artifact coverage audit

**GOAL** — Cubierto por W0..W4 (pre-phase gate → instrumentation → migration draft → observability gate → apply + ADR amend).

**REQ (FR-RLS-BURN-1..3)** — Mapeo task-level:

| REQ                                    | Plan tasks                                               |
| -------------------------------------- | -------------------------------------------------------- |
| FR-RLS-BURN-1 (drop v1 PERMISSIVE x4)  | W2.T1, W2.T3 (dry-run), W4.T1 (apply)                    |
| FR-RLS-BURN-2 (24h observability gate) | W0.T1 (precondition), W3.T1, W3.T2, W3.T3 (gate verdict) |
| FR-RLS-BURN-3 (ADR-0005 v1.1 amend)    | W4.T3                                                    |

**Open questions LOCKED by consejo unánime regla #25** (mapped to where they bind):

| OQ    | Locked decision                                         | Binding wave/task  |
| ----- | ------------------------------------------------------- | ------------------ |
| OQ-1  | Option B explicit rollback migration + frozen snapshot  | W2.T2              |
| OQ-2  | Hook re-enable OUTSIDE phase boundary                   | W0 (pre-phase ASK) |
| OQ-5  | Single atomic migration, 4 DROP POLICY in 1 transaction | W2.T1              |
| OQ-7  | Read-only telemetry script, no canary endpoint          | W1.T1, W3.T1       |
| OQ-9  | REJECTED DB kill switch — confiar en 5-layer stack      | W4.T2 (L5 monitor) |
| OQ-10 | Single PR squash-merge                                  | W4.T4              |

**OQs PENDING Rey strategic** (do NOT execute without Rey OK):

| OQ                          | Question                                                    | Blocks task                                                       |
| --------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| OQ-3                        | CS-1a (real 2nd tenant) vs CS-1b (dry-run flag-gated)       | (CS-1 deferred — Senior PM lean = CS-1b → v0.2.6; CS-1a → v0.3.0) |
| OQ-4                        | 24h window T0 clock — hook re-enable ts vs first claim mint | W3.T2 (gate clock semantics)                                      |
| OQ-8                        | CS-3 callback 410 — depends on Resend last-30d send logs    | (CS-3 deferred — bundled iff zero recent magic links)             |
| Hard FR-RLS-BURN-2 burn-day | Burn apply OK after W3 readiness report                     | W4.T1                                                             |
| Pre-phase hook re-enable    | KING_SIGNED required (msg_id=54)                            | W0.T1                                                             |

**SECURITY-REVIEW additions baked in:**

- SPEC §5 STRIDE table updated (Hook fail = critical Availability) — covered by W0.T1 precondition.
- 5-layer stack (L1-L5 from SECURITY-REVIEW Veredicto 2) — explicit in §"Threat model expansion" below.
- Negative test (forged session no claim → 0 rows) — covered by W2.T1 acceptance.

**CONTEXT** — No new CONTEXT.md needed; reusing v0.2.5 CONTEXT + ADR-0005 §"When to revisit". v0.2.6 SPEC.md already captures phase-specific context.

**Coverage status:** COMPLETO. No items missing. CS-4 / CS-5 / CS-6 / DNS / custom domains / MercadoPago explicitly out-of-scope per SPEC §3.

## Pre-execute gates (BEFORE W1)

- [ ] **W0.T1 — Rey OK on hook re-enable (Telegram msg_id=54 unblock).** Sin esto W0.T1 bloqueada → todo phase bloqueado. Failing-securely: NO autoprommote, NO push.
- [ ] **W0.T1 EXECUTED — hook re-enabled in Hakuna prod**, `custom_access_token_hook` health-check verde (claim mint sample manual). Lord Mano Claudia ejecuta con `KING_SIGNED=true` per regla #21 hook hint.
- [ ] **W0.T1 timestamp captured** → annotated in `D:\segundo-cerebro\wiki\meta\session-boot.md` `last_session_end` field as `hook_reenabled_at_utc`. Tentative T0 for OQ-4 24h window (Rey to confirm or override).
- [ ] **OQ-3 resolved by Rey** → CS-1 sub-option chosen (default CS-1b dry-run). Affects whether W4 includes CS-1b admin route hardening or strips CS-1 entirely.
- [ ] **OQ-4 resolved by Rey or BA+SE next council round** → 24h window T0 clock semantics locked.
- [ ] **OQ-8 resolved** → query Resend last-30d send count for `magic-link` + `recovery` + `signup_confirmation`. Lord Mano Claudia executes via Resend dashboard or API. If all=0 OR all sent before TTL → CS-3 410 ships in W4. If any recent → defer to v0.2.7.
- [ ] **Branch confirmed** → `git branch --show-current` returns `feature/v0.2.6-rls-burn-onboarding`. (Already true at PLAN draft time; 5 commits over `986830d`.)
- [ ] **Backup current Supabase snapshot via dashboard** — extra safety beyond Option B rollback file.
- [ ] **Verify Pablo (Rey Jota) tiene acceso vigente** a Supabase dashboard + Vercel project + Telegram bot polling.

## Threat model summary + 5-layer mitigation stack

**Trust boundary delta vs. v0.2.5:** zero. Burn does not move boundaries. Burn changes the **policy ceiling** on 4 tables.

**STRIDE delta (full table per SECURITY-REVIEW Veredicto 1, replacing SPEC §5 entry):**

| Threat                             | Pre-burn (v0.2.5)                                                     | Post-burn hook OK     | Post-burn hook FAIL                                    | Mitigation layer               |
| ---------------------------------- | --------------------------------------------------------------------- | --------------------- | ------------------------------------------------------ | ------------------------------ |
| Confused deputy (missing claim)    | v2 RESTRICTIVE denies; v1 PERMISSIVE permitted-but-AND'd → v2 binding | v2 RESTRICTIVE denies | v2 denies (intended fail-closed)                       | L1, L2                         |
| Hidden bug v2 predicate            | v1 PERMISSIVE = ceiling, app degrades gracefully                      | Equivalent (v2 sound) | **Total lockout for affected rows** — REGRESSION       | L1 (24h gate) + L3 (rollback)  |
| **DoS / Availability (Hook fail)** | Bajo: hook crash → v1 ceiling permite reads stale-but-correct         | Bajo                  | **Crítico: app muere para todo usuario authenticated** | L1 (gate) + L4 (app kill) + L5 |
| Tampering (forged JWT no claim)    | v2 chequea (negative test pasa); v1 redundante                        | v2 sigue chequeando   | Sin cambio                                             | W2.T1 acceptance test          |
| Hook fail-closed token mint        | Same                                                                  | Same                  | Same — unaffected by burn                              | n/a                            |
| Cross-tenant cookie leak           | Mitigated by v0.2.5 W3.G7 proxy hardening                             | Same                  | Same                                                   | n/a                            |
| Audit log integrity (hash chain)   | Holds                                                                 | Holds                 | Holds                                                  | n/a                            |

**5-layer mitigation stack (L1-L5 explicit):**

| Layer | Mechanism                                                                                                                                                                        | Time-to-recovery    | Plan binding                             |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------- |
| L1    | Pre-burn 24h observability gate with hard telemetry (FR-RLS-BURN-2 acceptance: zero `claim_missing` from real Hakuna users)                                                      | Preventive          | W0.T1 + W3.T1 + W3.T3                    |
| L2    | Atomic transaction burn migration (BEGIN; DROP x4; COMMIT;) — Postgres DDL transactional → all-or-nothing                                                                        | <2 min table revert | W2.T1 + W4.T1                            |
| L3    | Option B explicit rollback migration shipped same PR — `_rollback_snapshots/v0.2.6_v1_policies_FROZEN.sql` from `pg_policies` snapshot pre-burn captured at migration-write time | <10 min total       | W2.T2 + W4.T1 (snapshot freshness check) |
| L4    | App-layer escape: `APPROVAL_GATE_ENABLED` env var (per ADR-0005, ya existe) for "no permitir nuevos signups mientras debuggeamos"                                                | Inmediato           | W0 pre-phase verify env present prod     |
| L5    | Post-burn 1h intensive monitoring — dashboard with `claim_missing` rate + 401/403 rate + RLS deny rate per table                                                                 | Detection <5 min    | W4.T2                                    |

**Net assessment:** burn is **NOT** a confidentiality regression. It IS an availability regression IF hook re-enable fails or 24h gate is skipped. L1 is the load-bearing layer. L3 is the recovery primitive. L4 + L5 are insurance. **Kill switch DB-side rejected** per OQ-9 (attack surface increase, no audit trace).

**Gravedad classification (per SECURITY-REVIEW Veredicto 5):**

- W0.T1 hook re-enable: **T4, #21.a Rey-gated unilateral.**
- W4.T1 burn apply prod: **T4, #21.a Rey-gated unilateral, separate Telegram ASK.**
- W4.T4 squash-merge → main: **T3, #21.f Rey-gated.**
- All other internal tasks: **T1-T2 autonomous** with consejo (Backend Architect + Security Engineer + Database Optimizer convened on review gates).

---

## Wave 0 — Pre-phase Rey-gated actions (OUTSIDE phase boundary per OQ-2)

**Goal:** Resolve the 2 strategic Rey blockers and execute the 1 prod precondition before W1 starts. **Phase v0.2.6 cannot start until W0 fully green.**

**Why outside phase:** OQ-2 LOCKED — hook re-enable es pre-condition, not v0.2.6 new work. Bundling it inside risks "phase stalled mid-execution" semantics confusion. Each #21.a Rey-gate = its own Telegram msg_id with discrete sign-off.

### W0.T1 — Re-enable `custom_access_token_hook` in Hakuna prod [Rey-gated, OUTSIDE phase]

- **Action (per SPEC §0 + SECURITY-REVIEW Veredicto 4):** Lord Mano Claudia ejecuta via Supabase dashboard Auth → Hooks → "Custom Access Token" → select `public.custom_access_token_hook` (function ya existe per v0.2.5 W2.T3 commit `f5ac2b9`-vecino). Health-check post-enable: provoke 1 token mint manual (e.g. test login) and verify JWT decoded contains `active_tenant_id` claim populated.
- **Files:** ninguno (dashboard).
- **Acceptance:**
  - `auth.config` (or equivalent introspect query) shows `hook_custom_access_token_enabled: true`.
  - Sample fresh-mint JWT contains non-null `active_tenant_id`.
  - Timestamp `hook_reenabled_at_utc` captured + saved to `session-boot.md`.
- **Deps:** Rey OK on Telegram msg_id=54 (open since sesión 6ª).
- **Type:** `checkpoint:human-action` requires `KING_SIGNED=true` per CLAUDE.md regla #21 hook hint.
- **Reversibility:** disable hook in dashboard (1 click). Trivial.
- **Time:** 10 min Lord Mano Claudia + (Rey reaction time on Telegram).
- **Owner:** Rey Jota (sign-off) + Lord Mano Claudia (execute).
- **Sentinel risk:** HIGH (prod Hakuna config change, gravedad #21.a).
- **Commit:** none (dashboard config).

### W0.T2 — Resolve OQ-3 (CS-1 sub-option) + OQ-4 (24h T0 clock) + OQ-8 (CS-3 magic-link safety) [Rey decisions]

- **Action:** Lord Mano Claudia drafts Telegram message bundling 3 strategic OQs:
  1. OQ-3: "CS-1a real 2do tenant en v0.2.6 (pulls DNS wildcard de v0.3.0) o CS-1b dry-run admin route flag-gated? Senior PM recommendation: CS-1b."
  2. OQ-4: "24h window T0 = hook re-enable timestamp `<from W0.T1>` (BA tentative)? Confirm o override."
  3. OQ-8 data: "Resend last-30d sends `magic-link/recovery/signup_confirmation` count = `<query result>`. Si zero → CS-3 410 ships in W4. Si recent → defer v0.2.7."
- **Files:** Telegram outbound + mirror chat per CLAUDE.md regla #15.b. NO repo files.
- **Acceptance:** Rey responds with 3 explicit decisions. Logged to `session-boot.md` decisions_log.
- **Deps:** OQ-8 sub-action: Resend logs query (Resend dashboard or API GET `/emails?from=auth@impluxa.com&since=<30d>`) executed by Lord Mano Claudia BEFORE drafting Telegram (so message includes data, not "please query").
- **Type:** `checkpoint:human-action` (strategic decisions).
- **Reversibility:** Rey can override later between W3 and W4.
- **Time:** 15 min Lord Mano Claudia draft + Resend query + (Rey reaction).
- **Owner:** Rey Jota (decide) + Lord Mano Claudia (assemble + ask).
- **Sentinel risk:** LOW (no code, no prod change).
- **Commit:** `docs(v0.2.6/W0): log Rey decisions OQ-3/4/8 to session-boot` after Rey responds.

**W0 EXIT CRITERIA:** W0.T1 green + W0.T2 all 3 OQs resolved → unlock W1.

---

## Wave 1 — Instrumentation (audit_log writers for telemetry sources)

**Goal:** Ship the read-only telemetry sources the W3 24h gate will consume. Per OQ-7 LOCKED: no canary endpoint, just audit_log writers + a script that queries them.

**Review gate after W1:** Backend Architect + Security Engineer mini-review (audit_log writers don't break hash-chain invariants from v0.2.5 W2.T5). Scope = `src/lib/audit-log/*` + `supabase/migrations/2026*_v026_audit*.sql` (if any new migrations).

### W1.T1 — Verify `scripts/observe-rls-burn-readiness.ts` is wired correctly [BA artifact already shipped]

- **Action (per SPEC §4 OQ-7 LOCKED):** Read existing `scripts/observe-rls-burn-readiness.ts` (commit `df9b319`). Verify queries:
  1. `SELECT count(*) FROM auth.users WHERE last_sign_in_at > <T0>;` — token mint count window.
  2. `SELECT count(*) FROM public.audit_log WHERE event_type = 'claim_missing' AND created_at > <T0>;` — fail-closed event count.
  3. `SELECT count(*) FROM public.audit_log WHERE event_type = 'active_tenant_null' AND created_at > <T0>;` — hook misfire count.
- **Files:** `scripts/observe-rls-burn-readiness.ts` (read-only verify).
- **Acceptance:**
  - Script runs against dev DB without error (`tsx scripts/observe-rls-burn-readiness.ts --t0 <iso8601>`).
  - Output is JSON `{token_mints, claim_missing, active_tenant_null}` parseable.
- **Deps:** none (artifact already shipped commit `df9b319`).
- **Type:** `auto`.
- **Reversibility:** trivial — read-only script.
- **Verify:** `tsx scripts/observe-rls-burn-readiness.ts --t0 2026-05-15T00:00:00Z` against dev.
- **Time:** 10 min.
- **Owner:** Lord Mano Claudia.
- **Sentinel risk:** LOW (read-only, dev DB).
- **Commit:** if any tweak needed: `chore(v0.2.6/W1): polish observe-rls-burn-readiness CLI args`. Else none.

### W1.T2 — Add audit_log writers for `claim_missing` + `active_tenant_null` [if missing]

- **Action (per SECURITY-REVIEW Veredicto 1 + OQ-7 LOCKED):** Audit `src/lib/auth/` and `supabase/functions/` for existing emitters of `claim_missing` and `active_tenant_null` events.
  - If hook re-enable in W0.T1 already emits via existing `audit_log_write()` helper from v0.2.5 W2.T5 → no code change, document call-sites in W3 dashboard doc.
  - If missing → add minimal writer in `src/lib/audit-log/burn-readiness-events.ts`:
    - `emitClaimMissing(userId: string, jwtSummary: object)` — called from middleware fail-closed branch.
    - `emitActiveTenantNull(userId: string)` — called from `current_active_tenant()` SQL fn wrapper or middleware claim-decode.
  - Both writers use existing v0.2.5 `audit_log_write()` with `event_type` enum extended (migration if enum constrained).
- **Files (potential):**
  - `src/lib/audit-log/burn-readiness-events.ts` (new, ~40 LOC).
  - `supabase/migrations/20260515_v026_001_audit_event_types.sql` (only if event_type column has enum constraint to extend).
  - Touch-points where to invoke writers (middleware claim-decode + fail-closed branch).
- **Analog:** v0.2.5 W2.T5 audit_log table + writer pattern + hash-chain invariant.
- **Acceptance:**
  - Hash chain integrity test (`tests/integration/audit-log-hash-chain.test.ts` from v0.2.5) still passes.
  - New unit test: emit one `claim_missing` and one `active_tenant_null`, verify rows in audit_log with correct `event_type` and prev-hash linkage.
- **Deps:** W1.T1 (script ready to consume).
- **Type:** `auto` con `tdd="true"`.
- **Reversibility:** revert commit + drop migration (if any).
- **Verify:** `npm test -- audit-log` pass + manual emit call returns row in dev DB.
- **Time:** 45 min (if writers missing). If already exist via W0.T1 hook re-enable side-effect → 5 min doc-only.
- **Owner:** Lord Mano Claudia + Backend Architect review.
- **Sentinel risk:** MED (audit log writes, hash chain sensitivity).
- **Commit:** `feat(v0.2.6/W1): audit_log writers for burn-readiness telemetry (claim_missing, active_tenant_null)`.

### W1.T3 — Smoke-test telemetry sources end-to-end against dev DB

- **Action:**
  1. Manually trigger 1 `claim_missing` in dev (forge JWT sin claim, hit protected endpoint via curl with cookie).
  2. Manually trigger 1 `active_tenant_null` in dev (similar, with claim present but null value).
  3. Run `tsx scripts/observe-rls-burn-readiness.ts --t0 <recent>` → verify JSON shows `claim_missing: >=1, active_tenant_null: >=1`.
- **Files:** none (smoke test script exists).
- **Acceptance:** counts match emitted events. Document smoke-test outputs in W1 SUMMARY commit message.
- **Deps:** W1.T2.
- **Type:** `auto`.
- **Reversibility:** clean dev audit_log rows manually.
- **Verify:** as above.
- **Time:** 20 min.
- **Owner:** Lord Mano Claudia.
- **Sentinel risk:** LOW (dev DB only).
- **Commit:** `chore(v0.2.6/W1): smoke-test burn-readiness telemetry e2e (dev)`.

**W1 REVIEW GATE:** invoke Backend Architect + Security Engineer with scope `src/lib/audit-log/burn-readiness-events.ts` + new migration (if any) + `scripts/observe-rls-burn-readiness.ts`. Confirm: (a) hash chain not broken, (b) writers idempotent, (c) script does NOT have write side-effects.

---

## Wave 2 — Burn migration draft + dry-run preview branch

**Goal:** Write the burn SQL + Option B rollback snapshot. Apply against Supabase preview branch (NOT prod). Verify migration shape is atomic and rollback restores exact pre-state.

**Review gate after W2:** Database Optimizer + Security Engineer convened. Scope = `supabase/migrations/2026*_v026_002_burn_v1_policies.sql` + `supabase/migrations/_rollback_snapshots/v0.2.6_v1_policies_FROZEN.sql`. Sign-off required: rollback snapshot is byte-for-byte equivalent to current prod policies.

### W2.T1 — Draft single atomic burn migration SQL [4 DROP POLICY in 1 transaction] (OQ-5 LOCKED)

- **Action (per OQ-5 LOCKED + FR-RLS-BURN-1):** Create `supabase/migrations/20260516_v026_002_burn_v1_policies.sql`:

  ```sql
  -- v0.2.6 RLS BURN: drop legacy v1 PERMISSIVE policies on 4 tenant-owned tables.
  -- Preconditions verified separately (24h observability gate, hook re-enabled).
  -- Rollback: see _rollback_snapshots/v0.2.6_v1_policies_FROZEN.sql.

  begin;

  drop policy if exists "<v1_policy_name>" on public.sites;
  drop policy if exists "<v1_policy_name>" on public.leads_tenant;
  drop policy if exists "<v1_policy_name>" on public.subscriptions;
  drop policy if exists "<v1_policy_name>" on public.activity_log;

  -- Sanity check: verify only v2 policies remain on these tables.
  do $$
  begin
    if exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename in ('sites', 'leads_tenant', 'subscriptions', 'activity_log')
        and policyname not like '%_v2%'
    ) then
      raise exception 'v0.2.6 burn: non-v2 policy remains on tenant-owned table';
    end if;
  end $$;

  commit;
  ```

  Resolve `<v1_policy_name>` placeholders by querying `pg_policies WHERE policyname LIKE '%_v1%'` against current dev DB AND prod (read-only) before locking strings.

- **Files:** `supabase/migrations/20260516_v026_002_burn_v1_policies.sql` (new).
- **Analog:** v0.2.5 W2.T4 commit `f5ac2b9` (RLS v2 RESTRICTIVE shadow policies — same tables).
- **Acceptance:**
  - SQL parses (`supabase db diff` no errors).
  - Comment block references rollback snapshot path explicitly.
  - DO-block sanity check fires raise on artificial bad-state simulated test.
  - All 4 v1 policy names verified against `pg_policies` query output (committed in PR description).
- **Deps:** W1 complete (telemetry ready) + read-only `pg_policies` query against prod (Lord Mano Claudia executes via Supabase MCP, T1 read).
- **Type:** `auto`.
- **Reversibility:** trivial pre-apply (just delete file). Post-apply = W2.T2 rollback file.
- **Verify:** `supabase db diff --linked` parses; manual `BEGIN; <migration>; ROLLBACK;` against dev passes.
- **Time:** 60 min.
- **Owner:** Lord Mano Claudia + Database Optimizer review (W2 gate).
- **Sentinel risk:** MED (migration SQL, NOT applied to prod yet).
- **Commit:** `db(v0.2.6/W2): atomic burn v1 PERMISSIVE policies on 4 tables (FR-RLS-BURN-1, OQ-5)`.

### W2.T2 — Capture frozen `pg_policies` snapshot for Option B rollback (OQ-1 LOCKED)

- **Action (per OQ-1 LOCKED + SECURITY-REVIEW L3):** Capture exact `CREATE POLICY` DDL for the 4 v1 PERMISSIVE policies from PROD (not dev — prod is the recovery source of truth). Save to `supabase/migrations/_rollback_snapshots/v0.2.6_v1_policies_FROZEN.sql`.
  - Source query: `pg_policies` filtered to v1 names + `pg_get_policydef()` (or equivalent reconstructive query — Supabase docs / Postgres `pg_get_policydefs` extension).
  - Output file structure:

    ```sql
    -- FROZEN snapshot of v1 PERMISSIVE policies pre-v0.2.6 burn.
    -- Captured: <iso8601 utc>
    -- Source: prod Hakuna pg_policies query
    -- Rollback usage: psql -f this_file applies CREATE POLICY x4.
    -- DO NOT EDIT manually post-capture.

    begin;
    create policy "<v1_name>" on public.sites <full DDL>;
    -- ... x3 more
    commit;
    ```

- **Files:** `supabase/migrations/_rollback_snapshots/v0.2.6_v1_policies_FROZEN.sql` (new).
- **Acceptance:**
  - Apply snapshot to fresh dev DB (after W2.T3 dry-run apply burn) → `pg_policies` query post-rollback returns rows byte-equivalent to pre-burn prod snapshot diff.
  - File header has captured timestamp + source identifier.
  - File is committed with `noedit` annotation.
- **Deps:** W2.T1 (burn SQL drafted, knows policy names).
- **Type:** `auto`.
- **Reversibility:** the file IS the reversibility tool.
- **Verify:** dry-run apply burn on preview branch → apply rollback file → diff `pg_policies` pre-burn vs. post-rollback = empty.
- **Time:** 45 min (incl. capture query + verify cycle).
- **Owner:** Lord Mano Claudia + Database Optimizer review.
- **Sentinel risk:** MED (snapshot accuracy is load-bearing for L3 recovery).
- **Commit:** `db(v0.2.6/W2): frozen v1 policies snapshot for Option B rollback (OQ-1 LOCKED)`.

### W2.T3 — Apply burn migration to Supabase preview branch (dry-run, NOT prod)

- **Action (per OQ-9 L1+L2 stack):**
  1. Create Supabase preview branch via MCP (`mcp__supabase__create_branch` with `name: "v0.2.6-burn-dryrun"`).
  2. Apply burn migration via `mcp__supabase__apply_migration` to preview branch only.
  3. Run integration test suite (subset: RLS isolation tests + new negative test from FR-RLS-BURN-1 acceptance) against preview branch DSN.
  4. Apply rollback file (W2.T2) → verify `pg_policies` matches pre-burn snapshot.
  5. Re-apply burn → verify acceptance still green.
  6. DELETE preview branch via `mcp__supabase__delete_branch` post-verification (cleanup).
- **Files:** none modified in repo (preview branch is ephemeral).
- **Acceptance:**
  - Burn migration applies clean.
  - Integration tests green (no row-leak, no hook-fail false-positive).
  - Negative test passes: forged session sin `active_tenant_id` → `select count(*) from sites` returns 0.
  - Rollback restores byte-equivalent state.
  - Preview branch deleted.
- **Deps:** W2.T1 + W2.T2.
- **Type:** `auto` (preview branch is non-prod sandbox).
- **Reversibility:** preview branch is ephemeral; trivial.
- **Verify:** integration test exit code 0; manual `pg_policies` diff post-rollback empty.
- **Time:** 60 min.
- **Owner:** Lord Mano Claudia + Database Optimizer review.
- **Sentinel risk:** MED (migration apply, sandbox only).
- **Commit:** `chore(v0.2.6/W2): dry-run burn + rollback verified on Supabase preview branch`.

### W2.T4 — Update `docs/runbooks/v0.2.6-rls-burn-rollback.md` from DRAFT → READY

- **Action:** Promote runbook from DRAFT (commit `3238d6d`) to READY by:
  1. Replace `<snapshot-pending>` references with actual frozen snapshot path from W2.T2.
  2. Add concrete `psql` commands (with placeholders for prod connection string).
  3. Add timing estimates per step (capture from W2.T3 dry-run measurements).
  4. Add Telegram contact protocol: who to ping if rollback fires (Rey Jota first, Backend Architect second).
- **Files:** `docs/runbooks/v0.2.6-rls-burn-rollback.md` (modify).
- **Acceptance:** runbook readable end-to-end without `TBD`/`<pending>` markers; tested against dry-run timings from W2.T3.
- **Deps:** W2.T2 + W2.T3.
- **Type:** `auto`.
- **Reversibility:** trivial doc edit.
- **Verify:** Lord Mano Claudia reads runbook end-to-end; checks no placeholders remain.
- **Time:** 30 min.
- **Owner:** Lord Mano Claudia.
- **Sentinel risk:** LOW (docs).
- **Commit:** `runbook(v0.2.6/W2): RLS burn rollback READY with verified snapshot + timings`.

**W2 REVIEW GATE:** invoke Database Optimizer + Security Engineer. Scope: `supabase/migrations/20260516_v026_002_burn_v1_policies.sql` + `supabase/migrations/_rollback_snapshots/v0.2.6_v1_policies_FROZEN.sql` + `docs/runbooks/v0.2.6-rls-burn-rollback.md`. Sign-off required: snapshot byte-equivalence + atomic transaction shape + rollback runbook completeness.

---

## Wave 3 — Observability 24h gate + readiness report

**Goal:** Run the 24h prod observability window. Aggregate telemetry. Produce a Readiness Report that goes to Rey as the burn-day decision input.

**No code changes in this wave** — pure data collection + reporting. Time = 24h human-clock + ~1h Lord Mano Claudia analysis.

### W3.T1 — Start 24h observability window [Rey-confirmed T0]

- **Action (per FR-RLS-BURN-2 + OQ-4 pending Rey):**
  1. Once Rey confirms T0 clock (W0.T2 OQ-4 resolution): hook re-enable timestamp `<hook_reenabled_at_utc>` OR first prod token-mint with claim, whichever Rey picks.
  2. Annotate T0 in `session-boot.md` `last_session_end.observability_window_t0`.
  3. Schedule end-of-window check at T0 + 24h via `loop` skill or cron monitor (whichever is operative).
  4. NO Hakuna prod changes during window — purely observe.
- **Files:** `D:\segundo-cerebro\wiki\meta\session-boot.md` (annotate T0).
- **Acceptance:** T0 logged + scheduled wake-up captured.
- **Deps:** W0.T1 done + W0.T2 OQ-4 resolved.
- **Type:** `auto`.
- **Reversibility:** trivial annotation edit.
- **Verify:** session-boot.md reflects T0; cron/loop scheduled.
- **Time:** 5 min Lord Mano Claudia + 24h human-clock wait.
- **Owner:** Lord Mano Claudia.
- **Sentinel risk:** LOW (observation only).
- **Commit:** `docs(v0.2.6/W3): annotate observability window T0 in session-boot`.

### W3.T2 — Mid-window spot-check [T0 + 12h]

- **Action:** At T0+12h, run `tsx scripts/observe-rls-burn-readiness.ts --t0 <T0>` and inspect output.
  - **If `claim_missing > 0` from real Hakuna user (filter by user_id NOT IN test users)** → CLOCK RESETS per OQ-5 default; alert Rey via Telegram + chat per #15.b; investigate root cause; reschedule new T0 post-fix.
  - **If `claim_missing > 0` only from synthetic test events** → log + continue window; document in Readiness Report.
  - **If `active_tenant_null > 0` AND token mint count > 0 in same period** → hook misfire signal; alert Rey; investigate.
  - **If clean** → continue window silently (no Telegram, just chat log).
- **Files:** ad-hoc telemetry output captured to chat (NOT committed; ephemeral).
- **Acceptance:** spot-check executed at ~T0+12h; verdict captured.
- **Deps:** W3.T1.
- **Type:** `auto` (read-only script).
- **Reversibility:** n/a (read-only).
- **Verify:** script ran; output inspected; no action taken if clean.
- **Time:** 15 min Lord Mano Claudia.
- **Owner:** Lord Mano Claudia.
- **Sentinel risk:** LOW.
- **Commit:** none (ephemeral).

### W3.T3 — End-of-window readiness report → Rey [T0 + 24h]

- **Action:**
  1. Run `tsx scripts/observe-rls-burn-readiness.ts --t0 <T0>` final.
  2. Compose Readiness Report: token mint count, `claim_missing` count (with breakdown real vs synthetic), `active_tenant_null` count, hook health-check repeat (1 fresh manual JWT mint + claim verify).
  3. Write report to `D:/impluxa-web/.planning/v0.2.6/READINESS-REPORT.md` with sections:
     - T0 + window duration
     - Telemetry counts table
     - 5-layer stack readiness (L1..L5 individually checked: gate met, atomic SQL ready, snapshot frozen + verified, APPROVAL_GATE_ENABLED present in prod, monitoring dashboard URL ready)
     - Recommendation: SHIP / DEFER / RESET
  4. Send Telegram to Rey per regla #16 format with Readiness Report summary + ASK explicit: "Burn apply OK?" — gravedad #21.a.
- **Files:** `.planning/v0.2.6/READINESS-REPORT.md` (new).
- **Acceptance:**
  - Readiness Report contains all 4 sections.
  - Telegram outbound msg_id captured + mirrored chat per #15.b.
  - Rey responds with explicit OK / DEFER / questions.
- **Deps:** W3.T1 + 24h elapsed + W2 review gate green.
- **Type:** `checkpoint:human-action` (Rey ASK).
- **Reversibility:** Rey can DEFER → re-enter W3.T1 with new T0.
- **Verify:** report file exists; Telegram msg_id logged; Rey response captured.
- **Time:** 1h Lord Mano Claudia + (Rey reaction).
- **Owner:** Rey Jota (sign-off) + Lord Mano Claudia (compose).
- **Sentinel risk:** LOW (report itself); HIGH downstream gate.
- **Commit:** `docs(v0.2.6/W3): readiness report + Rey ASK for burn-day OK`.

**W3 EXIT CRITERIA:** Rey explicit OK on burn-day. If DEFER → loop W3 with new T0. If RESET (claim_missing real user) → triage in fix branch, re-enter from W2 gate as needed.

---

## Wave 4 — Burn apply prod + post-burn monitoring + ADR amend

**Goal:** Apply the burn migration to prod under L4+L5 monitoring, capture cutover record, update ADR-0005 → v1.1, ship single squash-merge PR per OQ-10.

### W4.T1 — Apply burn migration to Hakuna prod [Rey-gated, gravedad #21.a]

- **Action (per FR-RLS-BURN-2 + OQ-9 L2):**
  1. Confirm `KING_SIGNED=true` set for this command (per CLAUDE.md regla #21 hook).
  2. Verify W2.T2 frozen snapshot is current (re-run `pg_policies` query against prod, diff vs. snapshot file → must be byte-equivalent OR refresh snapshot if v1 policies somehow changed in 24h window).
  3. Apply migration: `supabase db push --linked` (or equivalent MCP `apply_migration` against prod project ID).
  4. Immediately post-apply: verify `pg_policies` shows only `*_v2` policies on 4 tables (sanity check inside migration's DO-block already does this; verify it didn't raise).
  5. Capture cutover commit SHA + timestamp + observability summary → input for W4.T3 ADR amend.
- **Files:** none (migration already in repo from W2.T1).
- **Acceptance:**
  - Migration applies clean to prod.
  - `pg_policies` post-apply: zero v1 rows on 4 tables; v2 rows intact.
  - Hakuna prod alive (smoke: 1 admin login + 1 tenant member login both succeed).
  - Audit_log shows zero `claim_missing` in 5 min post-apply window.
- **Deps:** W3.T3 Rey OK + W2 gate green.
- **Type:** `checkpoint:human-action` requires `KING_SIGNED=true`. Branch protection hook enforces.
- **Reversibility:** L3 rollback file (W2.T2) — `psql -f _rollback_snapshots/v0.2.6_v1_policies_FROZEN.sql` against prod. <10 min recovery per SECURITY-REVIEW Veredicto 2 L3.
- **Verify:** `pg_policies` query + smoke logins + 5-min audit_log scan.
- **Time:** 15 min Lord Mano Claudia (apply + verify cycle).
- **Owner:** Rey Jota (sign-off via KING_SIGNED) + Lord Mano Claudia (execute).
- **Sentinel risk:** **HIGH** (prod apply, gravedad #21.a).
- **Commit:** marker only (migration file already committed in W2.T1). Annotate post-apply with `chore(v0.2.6/W4): burn migration applied to Hakuna prod at <iso8601> SHA <sha>` if any annotation file changed.

### W4.T2 — Post-burn 1h intensive monitoring [L5 layer]

- **Action (per OQ-9 L5):**
  1. Start 1h timer post-W4.T1 apply.
  2. Every 10 min: run `tsx scripts/observe-rls-burn-readiness.ts --t0 <burn_apply_ts>`.
  3. Watch for: `claim_missing > 0`, `active_tenant_null > 0`, 401/403 spike (Vercel logs), `RLS deny` rate spike per table (Supabase logs).
  4. **If any anomaly fires** → execute rollback per `docs/runbooks/v0.2.6-rls-burn-rollback.md` immediately; alert Rey via Telegram urgent + chat.
  5. **If clean for 60 min** → close incident-window; post Telegram "✅ Burn ship clean, 60min monitoring green" + mirror chat per #15.b.
- **Files:** ad-hoc telemetry captures to chat (ephemeral); incident log to `D:/impluxa-web/.planning/v0.2.6/POST-BURN-MONITORING.md` if anything noteworthy.
- **Acceptance:** 60 min elapsed, no rollback triggered, Telegram clean-green sent.
- **Deps:** W4.T1.
- **Type:** `auto` (script reads) + `checkpoint:human-action` (Lord Mano Claudia stays present).
- **Reversibility:** L3 rollback (same as W4.T1).
- **Verify:** monitoring log captures all 6+ checks (10-min cadence).
- **Time:** 1h elapsed + ~15 min Lord Mano Claudia active engagement.
- **Owner:** Lord Mano Claudia (with Rey on standby for rollback decision if needed).
- **Sentinel risk:** **HIGH** (monitoring window post-prod-change).
- **Commit:** `docs(v0.2.6/W4): post-burn monitoring summary + close incident window`.

### W4.T3 — Update ADR-0005 → v1.1 with cutover record (FR-RLS-BURN-3)

- **Action (per FR-RLS-BURN-3):** Edit `docs/adrs/0005-auth-re-architecture.md`:
  1. Bump version: `## v1.1` section appended.
  2. Append "Cutover record" section:
     - Cutover date: `<iso8601 from W4.T1>`
     - Cutover commit SHA: `<from W4.T1 annotation>`
     - PR link: `<from W4.T4>`
     - Observability summary: `<token mint count, claim_missing count = 0, active_tenant_null count from W3.T3 report>`
     - Rollback fired: `no` (assumed) OR `yes — recovery time <X> min` (if W4.T2 triggered rollback).
  3. Mark `§"When to revisit"` v0.2.6 commitment as **DONE**.
- **Files:** `docs/adrs/0005-auth-re-architecture.md`.
- **Acceptance:** v1.1 section appended; cutover record complete; commitment marked done.
- **Deps:** W4.T1 + W4.T2 cleanup.
- **Type:** `auto`.
- **Reversibility:** trivial doc edit revert.
- **Verify:** read ADR end-to-end; v1.1 section visible.
- **Time:** 20 min.
- **Owner:** Lord Mano Claudia.
- **Sentinel risk:** LOW (docs).
- **Commit:** `docs(v0.2.6/W4): ADR-0005 v1.1 cutover record (FR-RLS-BURN-3)`.

### W4.T4 — Optional bundle: CS-2 docs deprecation closure (audits 1-3 done; audit 4 done at W0.T1)

- **Action (per SPEC §2 CS-2 + SECURITY-REVIEW Veredicto 3, conditional on audit 4 result):**
  - Audit 4 = DB sites query: `SELECT id, host, slug FROM sites WHERE host LIKE '%.impluxa.com' OR host = '*.impluxa.com';` against prod (read-only via Supabase MCP).
  - **If returns 0 rows (expected)** → Update `ROADMAP.md` §D2: mark `withCrossDomain` deprecation **completed in v0.2.6**, link this PR. NO code change (CS-2 audits 1-3 already proved no code uses helper).
  - **If returns rows** → ABORT CS-2; defer to v0.2.7 with migration plan; document in commit message.
- **Files:** `.planning/ROADMAP.md` §D2 (modify), `D:/impluxa-web/CHANGELOG.md` if exists (annotate v0.2.6 closes CS-2 docs-only).
- **Acceptance:** ROADMAP §D2 updated; PR description references audit 4 result.
- **Deps:** W4.T1 (so CS-2 ships in same merge as burn).
- **Type:** `auto`.
- **Reversibility:** trivial doc edit revert.
- **Verify:** ROADMAP renders correctly; references this PR.
- **Time:** 15 min.
- **Owner:** Lord Mano Claudia.
- **Sentinel risk:** LOW (docs).
- **Commit:** `docs(v0.2.6/W4): close CS-2 withCrossDomain deprecation in ROADMAP §D2`.

### W4.T5 — Optional bundle: CS-7 audit log partition runbook (T1, docs-only)

- **Action (per SPEC §2 CS-7):** Write `docs/runbooks/audit-log-partition-surgery.md` covering:
  - Manual pruning (corruption recovery)
  - GDPR right-to-erasure: surgical row delete with hash chain re-stitch
  - Audit subpoena: extract partition to immutable archive
  - Coordination: Backend Architect + Security Engineer sign-off pre-surgery
- **Files:** `docs/runbooks/audit-log-partition-surgery.md` (new, ~200 LOC markdown).
- **Acceptance:** runbook end-to-end readable, all 3 scenarios covered, contact protocol explicit.
- **Deps:** none (parallelizable with W4.T3 + W4.T4).
- **Type:** `auto`.
- **Reversibility:** trivial.
- **Verify:** Lord Mano Claudia read-through.
- **Time:** 1h.
- **Owner:** Lord Mano Claudia.
- **Sentinel risk:** LOW (docs).
- **Commit:** `docs(v0.2.6/W4): audit log partition surgery runbook (CS-7)`.

### W4.T6 — Squash-merge PR to main (OQ-10 LOCKED) + tag v0.2.6 [Rey-gated]

- **Action (per OQ-10 LOCKED + CLAUDE.md regla #21.f):**
  1. Push branch (already pushed at intermediate commits; final push for W4 commits).
  2. Open PR `feature/v0.2.6-rls-burn-onboarding` → `main`.
  3. PR description includes: phase summary, FR-RLS-BURN-1/2/3 acceptance evidence, 5-layer stack verification, observability summary, cutover record link to ADR-0005 v1.1.
  4. Request Rey review on PR (Telegram ASK msg #21.f gravedad).
  5. Rey approves → squash-merge with `KING_SIGNED=true` per branch-protection-main.sh hook.
  6. Tag `v0.2.6` on resulting main commit. Annotated tag with cutover summary.
- **Files:** PR (GitHub).
- **Acceptance:** PR squash-merged; tag `v0.2.6` exists on main.
- **Deps:** W4.T1 + W4.T2 + W4.T3 (+ W4.T4 + W4.T5 if bundled).
- **Type:** `checkpoint:human-action` requires `KING_SIGNED=true` for both merge and tag.
- **Reversibility:** revert merge commit on main + retag (high friction, but git-recoverable).
- **Verify:** `git tag -l v0.2.6` returns; `git log main` shows squash commit.
- **Time:** 30 min Lord Mano Claudia + (Rey review reaction).
- **Owner:** Rey Jota (approve + KING_SIGNED) + Lord Mano Claudia (open + drive).
- **Sentinel risk:** **HIGH** (merge to main, gravedad #21.f).
- **Commit:** the squash-merge IS the commit. Tag annotation captured separately.

**W4 REVIEW GATE:** `gsd-secure-phase` + `gsd-verify-work` skills run post-merge for retroactive validation. Findings logged to `.planning/v0.2.6/PHASE-AUDIT.md` (created post-tag).

---

## Critical path identification

**Critical path** (longest dependency chain, time-driving):

```
W0.T1 (10 min Lord + Rey reaction)
  ↓
W0.T2 OQ-3/4/8 resolved (15 min Lord + Rey reaction)
  ↓
W1.T1 + W1.T2 + W1.T3 (audit_log writers + smoke) — ~75 min
  ↓
W1 review gate (Backend + Security, ~30 min)
  ↓
W2.T1 + W2.T2 + W2.T3 + W2.T4 — ~195 min (3.25h)
  ↓
W2 review gate (DB Optimizer + Security, ~30 min)
  ↓
W3.T1 (5 min) → 24h elapsed → W3.T2 (15 min) → W3.T3 (1h + Rey reaction)
  ↓
W4.T1 (15 min) → W4.T2 (1h monitoring) → W4.T3 (20 min) → W4.T6 (30 min + Rey)
```

**Total critical path estimated time:**

- Active Lord Mano Claudia work: **~9-10h** (across multiple sessions, NOT contiguous).
- Human-clock waits: **24h observability window** + Rey reaction times (3 explicit Rey ASKs: hook re-enable, OQ-3/4/8 strategic, burn-day; plus PR merge approve).
- Total wall-clock: **~2 sessions over 2-3 calendar days**, gated by 24h window.

**Parallelization opportunities:**

- W1.T1 verify can run while W0.T2 Telegram pending Rey response.
- W4.T3 (ADR amend) + W4.T4 (CS-2 docs) + W4.T5 (CS-7 runbook) all parallelizable post-W4.T2.
- W2.T2 (snapshot capture) can start once W2.T1 names are known (parallel write).

**Bottleneck:** the 24h observability window. Cannot compress. L1 layer is load-bearing.

---

## Open questions remaining for Rey

These MUST be resolved before W0/W1 can fully proceed. Lord Mano Claudia bundles in W0.T2 Telegram message:

| Question                                                        | Default Senior PM lean                                                            | Impact if Rey overrides                                |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **OQ-3** CS-1a (real 2do tenant) vs CS-1b (dry-run)             | CS-1b dry-run (capability hardening only); CS-1a → v0.3.0                         | CS-1a pulls DNS wildcard work forward; +5-7 days scope |
| **OQ-4** 24h window T0 clock                                    | Hook re-enable timestamp (BA tentative)                                           | First-claim-mint alternative: T0 slips ~few hours      |
| **OQ-8** CS-3 callback 410 — Resend last-30d send safety        | Data-driven: query Resend → if zero recent magic → ship; if recent → defer v0.2.7 | Defer doesn't block phase; just bundles in v0.2.7      |
| **Hard FR-RLS-BURN-2 burn-day OK** (W3.T3 → W4.T1 transition)   | (No lean — Rey's call based on Readiness Report)                                  | DEFER → loop W3 with new T0; BLOCK = phase pauses      |
| **Pre-phase hook re-enable OK** (Telegram msg_id=54 still open) | (No lean — gravedad #21.a unilateral Rey)                                         | NOT PROCEED → entire phase blocked indefinitely        |

**Lord Mano Claudia commitment per CLAUDE.md regla #20:** do NOT execute W0.T1 / W4.T1 / W4.T6 without explicit Rey OK with `KING_SIGNED=true`. All other tasks (W1, W2, W3.T1, W3.T2, W4.T2 monitoring, W4.T3-T5 docs) are T1-T2 autonomous under consejo unánime per regla #25.

---

## References

- `.planning/v0.2.6/SPEC.md` (FR-RLS-BURN-1/2/3 + 7 candidate scopes + 10 OQs).
- `.planning/v0.2.6/RESEARCH.md` (Option A/B/C rollback analysis; Option B locked).
- `.planning/v0.2.6/SECURITY-REVIEW.md` (5 verdicts incl. 5-layer mitigation stack + gravedad classification).
- `docs/adrs/0005-auth-re-architecture.md` §"When to revisit" (commitment v0.2.6 burn).
- `docs/adrs/0008-smtp-resend-disable-email-hook.md` (2nd tenant deferral hint).
- `.planning/v0.2.5/PATTERNS.md` §3.18 (RLS v2 shadow policy pattern + "Drop v1 24h later" note).
- `.planning/v0.2.5/PLAN.md` W2.T4 commit `f5ac2b9` (RLS v2 RESTRICTIVE shadow policies).
- `.planning/ROADMAP.md` v0.3.0 §B (downstream phase v0.2.6 unblocks).
- `scripts/observe-rls-burn-readiness.ts` (commit `df9b319`, BA artifact #1).
- `docs/runbooks/v0.2.6-rls-burn-rollback.md` (commit `3238d6d` DRAFT, promoted to READY in W2.T4).
- `D:\segundo-cerebro\wiki\meta\session-boot.md` (T0 annotation target + decisions_log target).
- CLAUDE.md regla #21 (gravedad criteria, branch-protection-main.sh hook).
- CLAUDE.md regla #25 (consejo unánime ejecuta directo).
- CLAUDE.md regla #15.b (Telegram mirror chat).
- CLAUDE.md regla #16 (cierre sesión format with % avance).

---

## Sign-off matrix

| Role                                 | Sign-off required for                                                                                 | Status                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Rey Jota                             | OQ-3, OQ-4 (or BA+SE locks), OQ-8; W0.T1 hook re-enable; W4.T1 burn apply; W4.T6 squash-merge to main | ⏳ Pending (W0.T2 bundled Telegram ASK)                    |
| Backend Architect (Agent tool real)  | W1 review gate (audit_log invariants); W2 review gate (migration shape)                               | ⏳ To convene W1 + W2 gates                                |
| Security Engineer (Agent tool real)  | W1 review gate; W2 review gate (rollback snapshot byte-equivalence); W4 final                         | ⏳ To convene W1 + W2 + post-W4                            |
| Database Optimizer (Agent tool real) | W2 review gate (migration shape OQ-6 originally; subsumed by OQ-5)                                    | ⏳ To convene W2 gate                                      |
| Senior PM (Lord Mano Claudia)        | This PLAN drafting                                                                                    | ✅ DRAFT 2026-05-15 sesión 6ª, agentId `a98f40340425bd1ec` |
| `gsd-secure-phase` skill             | Post-tag retroactive security audit                                                                   | ⏳ Post W4.T6                                              |
| `gsd-verify-work` skill              | Post-tag UAT                                                                                          | ⏳ Post W4.T6                                              |

---

## Status of this PLAN

- ✅ Wave structure (W0..W4) drafted per ADR-0005 + SECURITY-REVIEW 5-layer stack.
- ✅ Task IDs (W{n}.T{m}) with description + acceptance + reversibility + time + deps + owner + Sentinel risk.
- ✅ Threat model expansion w/ 5-layer mitigation stack explicit table.
- ✅ Critical path identified + parallelization opportunities surfaced.
- ✅ NO migration SQL written (deferred to W2.T1 post-PLAN-OK Rey).
- ✅ NO prod changes proposed for autonomous execution (W0.T1, W4.T1, W4.T6 all explicit Rey-gated).
- ✅ Open questions for Rey enumerated with Senior PM leans.
- ❌ NO LOCK on FR-RLS-BURN-2 burn-day OK (Rey's call post-W3.T3 readiness report).
- ❌ NO LOCK on OQ-3/4/8 (Rey strategic).
- ❌ NO LOCK on pre-phase hook re-enable (Rey #21.a unilateral).

**Next action post-PLAN-OK from Rey:**

1. Rey reads PLAN + responds to W0.T2 bundled Telegram with OQ-3/4/8 decisions + hook re-enable OK.
2. W0.T1 executed (gravedad #21.a) → 24h window starts.
3. Lord Mano Claudia executes W1 + W2 autonomously under consejo (regla #25 unánime), reports post-hoc per regla #20.
4. W3 24h gate concludes → Readiness Report → Rey burn-day OK.
5. W4 ships → tag v0.2.6 → ADR-0005 v1.1 cutover.
