# v0.2.6 — RLS Burn + 2nd Tenant Onboarding (DRAFT, research-only)

**Status:** DRAFT — research-only. **No decisions locked.** Rey OK explicit required before promoting any item to PLAN.md.
**Owner:** Senior PM (Lord Claudia)
**Created:** 2026-05-15
**Branch:** `feature/v0.2.6-rls-burn-onboarding` (off `origin/main` `986830d`)
**Council convened (citations from v0.2.5 sign-offs, not new Agent calls in this draft):** Backend Architect, Security Engineer, Database Optimizer (per `PLAN-REVIEW.md` v0.2.5 W2 round 3) + Senior PM ranking layer.
**Time-box:** 75-90 min draft window. Locking decisions = next session with Rey present.

---

## 0. Why this phase exists

`v0.2.5` (`PR #2`, currently 18 commits over `986830d`) ships RLS v2 RESTRICTIVE shadow policies (commit `f5ac2b9`) **alongside** the legacy v1 PERMISSIVE policies. This was deliberate per ADR-0005 ("two policy layers per table for 1-2 releases"): if v2 had a regression, v1 would still permit reads — degrading instead of locking out every authenticated user.

ADR-0005 §"When to revisit" commits to **v0.2.6** as the cutover that drops the v1 ceiling. Quote:

> **v0.2.6: burn v1 PERMISSIVE policies** after 24h of prod observability with v2 RESTRICTIVE active. ADR-0005 v1.1 will record the cutover date.

That commitment is the only **hard scope** of this phase. Everything else below is candidate scope to be locked under Rey OK.

The "+ 2nd Tenant Onboarding" half of the phase title comes from v0.2.5 ADR-0008 hint:

> Send Email Hook surface adds operational complexity disproportionate to the stage of the SaaS (Hakuna single-tenant, second tenant onboarding deferred to v0.2.6+).

→ Open question: is "2nd tenant onboarding" actual scope of v0.2.6, or v0.2.7? See §6.

---

## 1. Hard scope (locked by ADR-0005 commitment)

### FR-RLS-BURN-1 — Drop v1 PERMISSIVE policies on tenant-owned tables

**Tables in scope** (per ADR-0005 §4):

- `public.sites`
- `public.leads_tenant`
- `public.subscriptions`
- `public.activity_log`

**Acceptance:**

- `\d+ <table>` shows only `*_v2` policies after migration applied to prod.
- `pg_policies` query verifies zero rows where `policyname LIKE '%_v1' OR (policyname NOT LIKE '%_v2' AND tablename IN (...))`.
- Existing v0.2.5 integration test `tests/integration/rls-claim-isolation.test.ts` continues to pass (v2 alone is enough).
- New negative test: a forged session lacking `active_tenant_id` claim returns 0 rows on every tenant-owned table SELECT (proves v1 PERMISSIVE was the only thing letting unsafe reads through; with it gone, fail-closed is enforced).

**Reversibility:** rollback migration restores v1 from saved DDL snapshot. Snapshot must be captured at migration-write time (see §4 Open Question OQ-1).

### FR-RLS-BURN-2 — 24h prod-observability gate before applying burn migration

**Pre-condition:** `custom_access_token_hook` re-enabled in Hakuna prod for ≥24h continuous (`hook_custom_access_token_enabled: true`) with zero `claim_missing` audit events from real users (not synthetic).

**Telemetry required during the window:**

- Count of `auth.users` token-mints with `active_tenant_id` claim populated.
- Count of `claim_missing` fail-closed events (must trend to zero or stay zero).
- Count of `current_active_tenant() returns null` events (proxy for hook-misfire rate).

**Acceptance:** burn migration is gated by an explicit Rey sign-off after the 24h window, NOT by Lord Claudia auto-promotion. (Gravedad #21.a: prod Hakuna live.)

### FR-RLS-BURN-3 — Update ADR-0005 to v1.1 with cutover date

Per ADR-0005 commitment. Append a "Cutover record" section: date, commit SHA of burn migration, observability summary (#claim-mints, #claim_missing).

---

## 2. Candidate scope (REQUIRES REY OK to promote to PLAN)

These items are _natural neighbors_ of the burn but are NOT locked. Listed for Rey decision.

### CS-1 — 2nd tenant onboarding (flag-gated vs. real)

**The ambiguity (per task instruction):** Is "onboarding 2do tenant" real provisioning of a new live tenant in v0.2.6, or just the _infrastructure_ to do so (admin wizard, CLI script, env vars) without an actual tenant?

**Two sub-options:**

- **CS-1a (real):** provision tenant `<TBD>` (Rey to name) live. Requires DNS wildcard `*.impluxa.com` (currently DEFERRED to v0.3.0 per ROADMAP §B3), Resend domain verified, payment-collection path. **Likely scope-creep into v0.3.0 territory.**
- **CS-1b (flag-gated dry-run):** add admin self-serve route `/admin/tenants/new` (already exists per ROADMAP A2 review) that creates a tenant row + owner membership + RLS isolation E2E test, but _does not_ expose subdomain publicly. Resolves "can the platform support 2nd tenant" without committing to a customer.

**Recommendation (Senior PM):** CS-1b. CS-1a belongs in v0.3.0 (FASE 1B activation). v0.2.6 should harden the _capability_, not the _act_.

**Confidence:** medium. Rey may reasonably override if there's a real 2nd tenant lined up.

### CS-2 — Drop deprecated `withCrossDomain` helper

ADR-0005 references `withCrossDomain` as deprecated post-v0.2.5. Burn it from the codebase (removal + deprecation note). T1 reversible.

**Pre-removal audits (sesión 6ª 2026-05-15, 3/4 done):**

- ✅ Audit 1 (grep usage): `withCrossDomain` aparece SOLO en docs de planning (`SPEC.md`, `SECURITY-REVIEW.md`, `ROADMAP.md` §D2). NO HAY usage en `src/` ni `supabase/` ni `scripts/`. Helper YA fue removido del código o nunca implementado más allá del flag deprecation.
- ✅ Audit 2 (env COOKIE_DOMAIN check): NO HAY `COOKIE_DOMAIN` ni `cookieDomain` ni `NEXT_PUBLIC_COOKIE_DOMAIN` en código. Solo aparece en SECURITY-REVIEW.md.
- ✅ Audit 3 (cookie Domain= literal hardcoded): grep `domain:\s*['"]\.` retorna NO MATCHES. Cero cookie con Domain explícito set.
- ⏳ Audit 4 (DB sites query — host_pattern distribution): pendiente Hook re-enable + Rey OK, requiere SELECT contra prod Hakuna. Esperado: solo `path-based` rows para Hakuna.

**Veredicto preliminar:** CS-2 puede CLOSED sin cambio de código real, solo update docs (`ROADMAP.md` §D2 marcar deprecation completed). Valid pendiente Audit 4 DB query (próxima sesión post hook reenable).

### CS-3 — Burn `/api/auth/callback` route

ROADMAP v0.2.5 §E4: "Deprecate `/api/auth/callback` route (queda como redirect de seguridad temporal)". v0.2.6 candidate: actually remove the route. **Risk:** any cached email link from pre-OTP era still points at this URL. Mitigation: keep route as 410 Gone with logging for 1 release, then remove in v0.2.7.

### CS-4 — Send Email Hook reactivation reconsideration (per ADR-0008 §"When to revisit")

ADR-0008 disabled the Send Email Hook in v0.2.5. v0.2.6 should _not_ auto-reactivate; should revisit **only if** branded per-tenant templates become a Hakuna or 2nd-tenant ask. **Recommendation: leave deferred to v0.2.7+.**

### CS-5 — Property-based fuzz tests for additional parsers

PLAN.md M12 identified candidates: cookie-domain stripper, JWT verifier, hostname parser. v0.2.5 only fuzzed `safeNextPath`. v0.2.6 candidate: extend fuzz coverage. T2, low risk, isolated to test code.

### CS-6 — Re-enable `custom_access_token_hook` in Hakuna prod (PRE-condition for burn)

This is technically not v0.2.6 _new work_ — it's the pending Telegram msg_id=54 ASK from sesión 6ª. But it's the precondition for FR-RLS-BURN-2. Open question §OQ-2: does v0.2.6 SPEC own the hook re-enable, or does it stay as a pre-phase action item?

### CS-7 — Audit log retention + partition pruning runbook

v0.2.5 W2.T6 shipped partition rotation cron (commit `8f0addf`). v0.2.6 candidate: write the operator runbook for when a partition needs manual surgery (corruption, GDPR right-to-erasure, audit subpoena). T1 documentation only.

---

## 3. Out of scope (explicitly NOT v0.2.6)

- Custom domains v0.6.0 work.
- New templates beyond `eventos`.
- LGPD/AAIP full compliance — deferred to v0.4.0 per ROADMAP.
- MercadoPago integration.
- Passkeys, device management, capability tokens.
- Per-region claim assembly (ADR-0005 §"When to revisit" — only triggered by multi-region prod, not a v0.2.6 driver).

---

## 4. Open questions — STATUS POST CONSEJO (sesión 6ª 2026-05-15)

**Updated 2026-05-15 ~09:30** tras invocación REAL Backend Architect (agentId `ab0e469f56c0e28cc`) + Security Engineer (agentId `a2c80b58738bf0367`) en main Lord Claudia context. Veredictos LOCKED por unanimidad regla #25 marcados ✅. OQs estratégicas o pendientes de Rey marcados ⏳.

| OQ                                 | Status                                                               | Decision LOCKED                                                                                                                                                                                                                                                                                                                      | Sign-off                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| OQ-1 (rollback approach)           | ✅ LOCKED                                                            | Option B explicit rollback migration con `CREATE POLICY` from `pg_dump` snapshot at migration-write time, frozen en `supabase/migrations/_rollback_snapshots/v0.2.6_v1_policies_FROZEN.sql`. Reject A (git revert — drift risk) + C (DB feature flag — keeps PERMISSIVE alive).                                                      | BA `ab0e469f56c0e28cc` + SE `a2c80b58738bf0367` (matched verdict via SECURITY-REVIEW.md) |
| OQ-2 (hook re-enable timing)       | ✅ LOCKED                                                            | OUTSIDE phase boundary. Hook re-enable es pre-v0.2.6 action gated by Rey ASK separado. v0.2.6 PLAN NO incluye M0=hook.                                                                                                                                                                                                               | SE `a2c80b58738bf0367` + Senior PM `a98f40340425bd1ec` lean confirmed                    |
| OQ-3 (CS-1 real vs dry-run)        | ⏳ Rey strategic                                                     | Senior PM lean: CS-1b (dry-run); real onboarding va a v0.3.0. Awaiting Rey OK                                                                                                                                                                                                                                                        | Rey Jota                                                                                 |
| OQ-4 (24h window start clock)      | ⏳ → BA propuso: hook re-enable timestamp como T0. Verificar con SE. | Tentative: hook re-enable timestamp. Senior PM next-session lock                                                                                                                                                                                                                                                                     | BA + SE next round                                                                       |
| OQ-5 (atomic vs split migration)   | ✅ LOCKED                                                            | Single atomic migration. 4 `DROP POLICY` en una transacción. Postgres DDL transactional → atomicity gratis. Reject 4-PR train (false comfort, mismo blast radius).                                                                                                                                                                   | BA `ab0e469f56c0e28cc` + SE concur via SECURITY-REVIEW                                   |
| OQ-6 → OQ-5 (rebrand): atomic burn | (subsumed por OQ-5)                                                  | (mismo veredict)                                                                                                                                                                                                                                                                                                                     | (mismo)                                                                                  |
| OQ-7 (telemetry source)            | ✅ LOCKED                                                            | Read-only telemetry script `scripts/observe-rls-burn-readiness.ts` (~50 líneas) NOT canary endpoint. Queries `auth.users.last_sign_in_at` + `audit_log claim_missing count` + `audit_log active_tenant_null count`. M0.5 task new in PLAN.                                                                                           | BA `ab0e469f56c0e28cc`                                                                   |
| OQ-8 (CS-3 Resend logs)            | ⏳ Data-dependent                                                    | BA matrix: query Resend dashboard last 30d send count `magic-link` + `recovery` + `signup_confirmation`. If all=0 OR all sent before TTL → SHIP CS-3 410 Gone. Si any within 24h → defer v0.2.7. Cross-check `auth.audit_log_entries`.                                                                                               | BA `ab0e469f56c0e28cc`                                                                   |
| OQ-9 (DB-layer kill switch)        | ✅ LOCKED — REJECTED                                                 | NO kill switch DB. Aumenta attack surface (intentional backdoor sin trace pg_policies, GUC session-scoped no audit_log). 24h gate + Option B rollback logra <10min recovery comparable. Stack 5-layer SE propone: 24h gate + atomic burn + rollback explícito + APPROVAL_GATE_ENABLED app-layer + 1h post-burn intensivo monitoring. | SE `a2c80b58738bf0367` + BA concur                                                       |
| OQ-10 (PR merge strategy)          | ✅ LOCKED                                                            | Single PR squash-merge. PR train rejected (4 days extra zero safety, same hook-level signal). Squash da clean cutover commit para `git bisect`.                                                                                                                                                                                      | BA `ab0e469f56c0e28cc` (defers a Workflow Architect for convention veto, none received)  |

**ADDITIONAL Security Engineer findings (SECURITY-REVIEW.md):**

- **OQ-1 (threat model regression):** GRAVE delta. Estado actual hook DISABLED + burn = lockout total Hakuna. Fila "Hook fail" availability falta en STRIDE original §5. ASK Rey #21.a obligado pre-burn.
- **CS-2 (`withCrossDomain` removal):** NO-GRAVE bajo path-based vigente (Hakuna en `impluxa.com/hakuna`, no subdomain). Pre-condition: 4 audits (grep usage + DB sites query + cookie Domain= grep + env COOKIE_DOMAIN check). Post: 2 integration tests. Removerlo MEJORA aislamiento (cookies host-only > domain-scoped).
- **Gravedad global v0.2.6 = GRAVE compuesto (#21.a + #21.f). 5 choke points Rey:** hook re-enable + burn apply post-24h + merge main + decisión CS-1a/b + decisión CS-3.

**Files producidos por consejo:**

- `D:/impluxa-web/.planning/v0.2.6/SECURITY-REVIEW.md` (18KB, full BAJ + 5-layer mitigation stack)
- (proposed by BA, not yet created): `supabase/migrations/_rollback_snapshots/v0.2.6_v1_policies_FROZEN.sql`, `scripts/observe-rls-burn-readiness.ts`, `docs/runbooks/v0.2.6-rls-burn-rollback.md`

---

### Original Open Questions (legacy, pre-consejo)

## 4-LEGACY. Open questions (CAPTURED, NOT ASSUMED)

| ID        | Question                                                                                                                                                                      | Why it matters                                                                                                                                                         | Owner                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **OQ-1**  | Does ADR-0005 require us to capture a literal `pg_dump --schema-only` of v1 policies before burning, or is the rollback migration `CREATE POLICY` from PATTERNS §3.18 enough? | Determines whether burn migration ships with a snapshot file in `supabase/migrations/_rollback_snapshots/` or just relies on git history of `f5ac2b9`.                 | Backend Architect (next session, Agent tool real) |
| **OQ-2**  | Does v0.2.6 own the hook re-enable (currently pending Telegram msg_id=54), or does that stay as a pre-phase blocker resolved by Rey before v0.2.6 starts?                     | Affects scope sizing + whether v0.2.6 quality gates include a hook smoketest.                                                                                          | Rey strategic                                     |
| **OQ-3**  | CS-1 — is 2nd tenant onboarding real (CS-1a) or dry-run (CS-1b)?                                                                                                              | Determines whether DNS wildcard + Resend verification get pulled forward from v0.3.0.                                                                                  | Rey strategic                                     |
| **OQ-4**  | What is the 24h observability window's start clock? Hook re-enable timestamp, or first successful prod token-mint with claim?                                                 | Affects when burn migration becomes apply-eligible.                                                                                                                    | Backend Architect + Security Engineer             |
| **OQ-5**  | If a `claim_missing` audit event fires during the 24h window, does the clock reset, or do we triage and accept low-rate bugs?                                                 | Determines burn-readiness criteria. Default Senior PM proposal: any `claim_missing` from a real user resets the clock; synthetic test events do not.                   | Security Engineer                                 |
| **OQ-6**  | Should burn migration be a single atomic SQL or split per-table for finer rollback granularity?                                                                               | 4 tables; atomic = simpler revert, split = catches table-specific issues earlier.                                                                                      | Database Optimizer                                |
| **OQ-7**  | Telemetry source for the 24h window — Supabase logs explorer manual queries, or do we need to ship a small audit-log read endpoint specifically for `claim_missing` count?    | Affects whether v0.2.6 needs a small observability ticket.                                                                                                             | Backend Architect                                 |
| **OQ-8**  | Does CS-3 (callback route 410 Gone) conflict with any in-flight Hakuna user that might still have an old magic link?                                                          | If yes, push CS-3 to v0.2.7. If no, include in v0.2.6.                                                                                                                 | Senior PM (review Hakuna usage)                   |
| **OQ-9**  | Should v0.2.6 ship with a feature flag to toggle v1 policies back on without a migration revert (kill switch v2)?                                                             | ADR-0005 has `APPROVAL_GATE_ENABLED` for app-layer kill; nothing equivalent at DB layer if v1 is gone. Risk: unbounded recovery time if v2 has a hidden bug post-burn. | Security Engineer (gravedad call)                 |
| **OQ-10** | Does v0.2.6 PR get merged squash like v0.2.5 PR #2, or does it use a different strategy given it touches prod RLS?                                                            | Squash-vs-merge affects bisectability of any post-burn incident.                                                                                                       | Workflow Architect                                |

---

## 5. Threat model delta vs. v0.2.5

(Preliminary; full STRIDE table moves to RESEARCH.md / PLAN.md after Rey OK.)

| Threat                            | Pre-burn (v0.2.5)                                                                     | Post-burn (v0.2.6)                                    | Delta                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Confused deputy via missing claim | v2 RESTRICTIVE denies; v1 PERMISSIVE would have permitted but RESTRICTIVE wins on AND | v2 RESTRICTIVE denies; no v1 at all                   | **Equivalent or better.** Removing v1 doesn't loosen anything because RESTRICTIVE was already the binding constraint. |
| Hidden bug in v2 predicate        | v1 PERMISSIVE = ceiling, app keeps working with stale-but-correct visibility          | v1 gone → bug in v2 = total lockout for affected rows | **Worse.** Mitigation: 24h prod observability + OQ-9 (DB-layer kill switch).                                          |
| Hook fail-closed on token mint    | Same                                                                                  | Same — unaffected by burn                             | No change.                                                                                                            |
| Cross-tenant cookie leak          | Mitigated by v0.2.5 W3.G7 proxy hardening                                             | Same                                                  | No change.                                                                                                            |
| Audit log integrity               | Hash chain holds                                                                      | Hash chain holds                                      | No change.                                                                                                            |

**Net assessment:** burn is _not_ a security regression as long as the 24h observability gate fires. The risk it introduces is **availability**, not confidentiality. Mitigation lives in OQ-4, OQ-5, OQ-9.

---

## 6. Phase ranking — where v0.2.6 sits

| Item                                    | Effort estimate                          | Blocker for                                          | Recommendation                            |
| --------------------------------------- | ---------------------------------------- | ---------------------------------------------------- | ----------------------------------------- |
| **v0.2.6 RLS burn (FR-RLS-BURN-1+2+3)** | 1 day (migration + 24h wait + ADR amend) | v0.3.0 B5 smoke test cleanliness; ADR-0005 close-out | **Ship next, gated by hook re-enable.**   |
| CS-1b 2nd tenant dry-run                | 1 day                                    | v0.3.0 B5.1 "auth integration smoke"                 | Bundle with v0.2.6 if Rey OK; else defer. |
| CS-2 `withCrossDomain` removal          | 30 min                                   | nothing                                              | T1, bundle.                               |
| CS-3 callback route 410                 | 1 hour                                   | nothing                                              | OQ-8 first.                               |
| CS-5 fuzz tests extension               | 2-4 hours                                | nothing                                              | Bundle if cycles available.               |
| CS-7 partition runbook                  | 1 hour                                   | nothing critical                                     | Bundle as docs polish.                    |
| v0.3.0 work (DNS wildcard, Hakuna live) | 10-12 days                               | revenue, cohort 2 expansion                          | After v0.2.6.                             |

**Senior PM recommended sequencing:**

1. Resolve pending Telegram msg_id=54 (Rey OK on hook re-enable).
2. Apply hook re-enable to Hakuna prod.
3. Start 24h observability window (ship `v0.2.6` SPEC + PLAN drafts in parallel, no DB changes).
4. At 24h+ with clean telemetry + Rey OK: apply burn migration + CS-2/CS-7.
5. Tag `v0.2.6`, then unblock v0.3.0 (DNS wildcard etc.).

---

## 7. References

- `docs/adrs/0005-auth-re-architecture.md` (specifically §"When to revisit" — v0.2.6 commitment).
- `docs/adrs/0008-smtp-resend-disable-email-hook.md` (2nd tenant deferral hint).
- `.planning/v0.2.5/PATTERNS.md` §3.18 (RLS v2 shadow policy pattern + "Drop v1 24h later" note).
- `.planning/v0.2.5/PLAN.md` W2.T4 (commit `f5ac2b9` — RLS v2 RESTRICTIVE shadow policies).
- `.planning/ROADMAP.md` v0.3.0 (downstream phase that v0.2.6 unblocks).
- `D:\segundo-cerebro\wiki\meta\session-boot.md` `last_session_end` (sesión 6ª context: hook disabled, PR #2 18 commits, msg_id=54 pending).

---

## 8. Sign-off matrix (TO BE FILLED)

| Role                                 | Sign-off required for                                           | Status                                                                                                     |
| ------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Rey Jota                             | OQ-2, OQ-3, OQ-9 strategic decisions; FR-RLS-BURN-2 burn-day OK | ⏳ Pending Rey review of this draft                                                                        |
| Backend Architect (Agent tool real)  | OQ-1, OQ-4, OQ-7 technical decisions                            | ✅ Done sesión 6ª 2026-05-15, agentId `ab0e469f56c0e28cc` (4 OQs LOCKED + 3 follow-up files proposed)      |
| Security Engineer (Agent tool real)  | OQ-5, OQ-9 risk decisions; final burn migration sign-off        | ✅ Done sesión 6ª 2026-05-15, agentId `a2c80b58738bf0367` (5-layer mitigation stack en SECURITY-REVIEW.md) |
| Database Optimizer (Agent tool real) | OQ-6 migration shape                                            | ⏳ To convene next session                                                                                 |
| Workflow Architect                   | OQ-10 PR merge strategy                                         | ⏳ To convene next session                                                                                 |

---

## 9. Status of this DRAFT

- ✅ Research captured.
- ✅ Alternatives enumerated.
- ✅ Open questions surfaced (10).
- ✅ Threat model delta sketched.
- ✅ Phase ranking proposed.
- ❌ NO decisions locked (per task restriction #2).
- ❌ NO migrations written (per restriction #5).
- ❌ NO prod changes (per restriction #5).

**Next action:** Rey reviews open questions → answers OQ-2, OQ-3, OQ-9 (strategic). Lord Claudia convenes Backend Architect + Security Engineer + Database Optimizer (Agent tool real) on remaining technical OQs in next session under regla #25 (consejo unánime → ejecuta directo for T1-T2 reversible items).
