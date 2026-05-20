---
phase: v0.2.6
type: context
version: v0.2.6
name: "RLS Burn + 2nd Tenant Onboarding"
status: draft-locked
created: 2026-05-15
owner: Rey Jota + Lord Mano Claudia
depends_on: [v0.2.5-PR-2-merged]
spec_path: ./SPEC.md
consulted_council:
  - Senior Project Manager
  - Backend Architect
  - Security Engineer
  - Database Optimizer (pending W2 review gate)
  - Workflow Architect (pending CS-2 final removal)
---

# v0.2.6 CONTEXT.md — Decisiones de implementación lockeadas

Este archivo lockea decisiones de implementación (HOW) que SPEC.md (WHAT) no resuelve. Las 6 D-decisiones abajo fueron lockeadas por consejo unánime (Backend Architect + Security Engineer reales) en sesión 6ª 2026-05-15 bajo regla #25. Downstream tareas (W1 audit_log writers, W2 burn migration draft, W3 readiness report, W4 burn apply) usan este archivo como única fuente de verdad.

## Spec lock

Hard scope `FR-RLS-BURN-1/2/3` en `SPEC.md` son inmutables salvo amendment via Rey OK + nueva sesión SPEC. Candidate scope CS-1..CS-7 requiere Rey OK explícito antes de promover a PLAN.

## Canonical refs

Lectura OBLIGATORIA antes de implementing W1+:

- `.planning/v0.2.6/SPEC.md` — Hard scope + Candidate scope + Open Questions LOCKED status
- `.planning/v0.2.6/RESEARCH.md` — Patrones de burn, telemetry hypothesis, rollback options
- `.planning/v0.2.6/SECURITY-REVIEW.md` — 5-layer mitigation stack + GRAVE delta + CS-2 NO-GRAVE evidencia
- `.planning/v0.2.6/PLAN.md` — 5 Waves + 18 Tasks + dependencies
- `docs/adrs/0005-auth-re-architecture.md` — Será AMENDED por v0.2.6 con cutover record (FR-RLS-BURN-3)
- `docs/runbooks/v0.2.6-rls-burn-rollback.md` — Procedure si burn produce incident
- `scripts/observe-rls-burn-readiness.ts` — Readiness gate check tool

## Decisiones lockeadas (D1-D6, consejo unánime regla #25)

### D1 — Rollback shape: Option B (explicit migration with frozen snapshot)

**Decision:** Burn migration ships paired with a frozen rollback migration in `supabase/migrations/_rollback_snapshots/v0.2.6_v1_policies_FROZEN.sql`. The rollback file inlines exact `CREATE POLICY` DDL captured via `pg_dump --schema-only` at burn-migration-write-time.

**Rejected alternatives:**

- Option A (git revert) — DB-vs-git drift risk, no schema-drift detector for RLS in Postgres
- Option C (DB-side feature flag GUC) — keeps PERMISSIVE attack surface alive, GUC session-scoped bypassable

**Source:** Backend Architect agentId `ab0e469f56c0e28cc` + Security Engineer agentId `a2c80b58738bf0367` (matched verdict in SECURITY-REVIEW.md)

### D2 — Migration shape: Single atomic migration

**Decision:** All 4 tables (`sites`, `leads_tenant`, `subscriptions`, `activity_log`) get `DROP POLICY *_v1` in one transaction. Postgres DDL is transactional → atomicity for free. Pre-flight assertions in migration: `pg_policies WHERE policyname LIKE '%_v2'` count = 4 + `current_active_tenant()` exists + SECURITY DEFINER. Fail-closed if v0.2.5 v2 policies somehow rolled back.

**Rejected alternative:** 4-PR split (one PR per table, 24h gate between) — false comfort, same blast radius, +4 days of useless gates.

**Source:** Backend Architect agentId `ab0e469f56c0e28cc`

### D3 — DB-layer kill switch: REJECTED

**Decision:** v0.2.6 ships WITHOUT a DB-layer kill switch toggle. The 5-layer mitigation stack from Security Engineer is sufficient:

- L1 24h pre-burn observability gate (preventive)
- L2 Atomic transaction burn (<2 min revert)
- L3 Option B explicit rollback (D1) — total recovery <10 min
- L4 App-layer `APPROVAL_GATE_ENABLED` env (existing from ADR-0005)
- L5 Post-burn 1h intensive monitoring (detection <5 min)

**Rejected alternative:** GUC-based bypass policy (`app.bypass_v2_rls`) — increases attack surface (intentional backdoor invisible in `pg_policies`), session-scoped GUC has no audit_log trace, attacker with `SET LOCAL` can bypass.

**Source:** Security Engineer agentId `a2c80b58738bf0367` (5-layer stack design) + Backend Architect concur

### D4 — Hook re-enable timing: OUTSIDE phase boundary

**Decision:** The pending hook custom_access_token re-enable (Telegram msg_id=54 from sesión 6ª, gravedad #21.a) is a PRE-PHASE action, NOT v0.2.6 W0. v0.2.6 phase begins AFTER:

1. Hook re-enabled in Hakuna prod with explicit Rey ASK
2. 24h passes with zero `claim_missing` audit events from real users

The clean causal chain: hook re-enable (Rey ASK #1) → 24h gate (Lord Claudia observability) → burn-day OK (Rey ASK #2). No co-mingling.

**Source:** Security Engineer agentId `a2c80b58738bf0367` + Senior PM lean confirmed

### D5 — Telemetry: Read-only script (NO canary endpoint)

**Decision:** 24h gate readiness verified via `scripts/observe-rls-burn-readiness.ts` (committed `df9b319`). SELECT-only against Supabase REST API: token-mint denominator + `claim_missing` count + `active_tenant_null` count + instrumentation gap heuristic. Report GO/NO-GO. Optional `--require-zero-claim-missing` exits non-zero.

**Rejected alternative:** Synthetic canary endpoint exercising "v1 vs v2 explicit" — keeps v1 alive in code longer than necessary + injects synthetic events polluting audit_log signal + creates test-only auth code path needing its own threat model. Cost > value at Hakuna scale.

**Pre-condition:** v0.2.6 PLAN W1 task M0.5 adds audit_log writers for `claim_missing` + `active_tenant_null` action types. Without those rows, script reports `INSTRUMENTATION_GAP` and gates non-zero.

**Source:** Backend Architect agentId `ab0e469f56c0e28cc`

### D6 — PR merge strategy: Single PR squash-merge

**Decision:** v0.2.6 ships as ONE PR squash-merged to main. Bisectability axis is "before vs after burn migration applied", not "which of 4 tables burned first" — squash captures that exact axis. PR includes burn migration + rollback snapshot + readiness script + ADR-0005 v1.1 update + runbook update in ONE merge unit.

**NO auto-apply post-merge.** Rey pushes the apply button (gravedad #21.a). PR merge ≠ prod apply for this phase.

**Rejected alternative:** PR train (4 PRs, one per table) — see D2 rationale.

**Source:** Backend Architect agentId `ab0e469f56c0e28cc` (Workflow Architect veto deferred but no objection received)

## Decisiones PENDING Rey strategic (no lockeable autónomamente)

### OQ-3 — CS-1 sub-option (real vs dry-run)

CS-1a (real 2nd tenant LIVE) pulls forward DNS wildcard from v0.3.0. CS-1b (flag-gated dry-run admin route) hardens the capability without committing to a customer.

**Senior PM lean:** CS-1b. CS-1a belongs in v0.3.0.
**Awaiting:** Rey decision in W0.T2 bundled Telegram ASK.

### OQ-4 — 24h window T0 clock final

**BA tentative:** Hook re-enable timestamp = T0.
**Awaiting:** Rey OK + final SE concur in W0 round.

### OQ-8 — CS-3 callback `/api/auth/callback` 410 Gone

Data-dependent on Resend last-30d send-count query. If all = 0 OR all sent before TTL → SHIP CS-3 410. If any within 24h → defer v0.2.7.

**Awaiting:** Resend query data + Rey OK.

### Hard FR-RLS-BURN-2 burn-day OK

Apply burn migration to Hakuna prod is gravedad #21.a. Lord Claudia presents Readiness Report (W3.T3 output) → Rey reads + responds OK / NO-GO.

## Anti-patterns explicit (do NOT)

- **DO NOT** auto-apply burn migration after PR merge. Rey gate is mandatory per regla #21.a.
- **DO NOT** skip the 24h observability window even if Hakuna traffic is nominal. The gate is preventive (L1), not just informational.
- **DO NOT** ship burn migration without the frozen snapshot file. Snapshot is the contract enabling Option B rollback (D1).
- **DO NOT** reactivate Send Email Hook in v0.2.6 (per ADR-0008 §"When to revisit"). Defer to v0.2.7+ unless multi-tenant template variants become a Hakuna ask.
- **DO NOT** introduce a DB-layer kill switch GUC. D3 rejected explicit.

## Sign-off matrix

| Role                                                                             | Scope                                                                                          | Status                       |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| Senior PM (Lord Mano Claudia, agentId `a98f40340425bd1ec` / `a84a768a9960e8c36`) | Phase ranking + ranking + draft authoring                                                      | ✅ Done sesión 6ª 2026-05-15 |
| Backend Architect (agentId `ab0e469f56c0e28cc`)                                  | OQ-4 / OQ-5 / OQ-7 / OQ-10 LOCKED + CS-2 audits + W2 review gate                               | ⏳ W2 review pending         |
| Security Engineer (agentId `a2c80b58738bf0367`)                                  | OQ-1 / OQ-9 / CS-2 / OQ-2 LOCKED + 5-layer stack + W1+W2 review gates                          | ⏳ W1+W2 reviews pending     |
| Database Optimizer                                                               | W2 burn migration shape review                                                                 | ⏳ To convene                |
| Workflow Architect                                                               | OQ-10 PR convention veto (none received)                                                       | ⏳ optional                  |
| Rey Jota                                                                         | OQ-3 / OQ-4 final / OQ-8 + W0.T1 hook re-enable + W4.T6 burn-day OK + W4 squash-merge sign-off | ⏳ Pending                   |

## Reversibility

- Toda la phase reversible vía Option B rollback (D1) en <10 min para FR-RLS-BURN-1.
- ADR-0005 v1.1 cutover record (FR-RLS-BURN-3) reversible vía git revert.
- Snapshot files committed en repo permanecen disponibles indefinidamente.

---

**Updated:** 2026-05-15 sesión 6ª (post consejo BA+SE LOCKED). Próxima update post W0.T2 Rey responses + W4.T6 burn-day execution.
