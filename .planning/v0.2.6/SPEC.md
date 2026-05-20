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

| OQ                                 | Status                         | Decision LOCKED                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Sign-off                                                                                                                                    |
| ---------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-1 (rollback approach)           | ✅ LOCKED                      | Option B explicit rollback migration con `CREATE POLICY` from `pg_dump` snapshot at migration-write time, frozen en `supabase/migrations/_rollback_snapshots/v0.2.6_v1_policies_FROZEN.sql`. Reject A (git revert — drift risk) + C (DB feature flag — keeps PERMISSIVE alive).                                                                                                                                                                                    | BA `ab0e469f56c0e28cc` + SE `a2c80b58738bf0367` (matched verdict via SECURITY-REVIEW.md)                                                    |
| OQ-2 (hook re-enable timing)       | ✅ LOCKED                      | OUTSIDE phase boundary. Hook re-enable es pre-v0.2.6 action gated by Rey ASK separado. v0.2.6 PLAN NO incluye M0=hook.                                                                                                                                                                                                                                                                                                                                             | SE `a2c80b58738bf0367` + Senior PM `a98f40340425bd1ec` lean confirmed                                                                       |
| OQ-3 (CS-1 real vs dry-run)        | ✅ LOCKED 2026-05-17 sesión 8ª | **CS-1b dry-run.** Admin route `/admin/tenants/new` flag-gated crea tenant row + owner membership + RLS isolation E2E test SIN exponer subdomain públicamente. CS-1a (real provisioning) DEFERRED a v0.3.0 cuando haya budget DNS wildcard `*.impluxa.com` + Resend domain verify + payment-collection path. Sin urgencia operativa.                                                                                                                               | CEO Jota (Telegram cierre OQ classification sesión 8ª) + Senior PM `a1aeb780479a9d26b` + Security Engineer `ac9ce9f8613da3ae9` lean unánime |
| OQ-4 (24h window start clock)      | ✅ LOCKED 2026-05-17 sesión 8ª | **T0 anchor = first prod token-mint OBSERVED with valid `active_tenant_id` claim** (vía `auth.users.last_sign_in_at` MIN post-hook-reenable, sin `claim_missing` para esa mint). Reject hook re-enable timestamp (BA tentative original): evita race condition con propagation del config flag, ancla en evidencia end-to-end real no en config-flag-flip timestamp. Implementado como modo `--since-first-claim-mint` en `scripts/observe-rls-burn-readiness.ts`. | CEO Jota (Telegram cierre OQ classification sesión 8ª) + Security Engineer `ac9ce9f8613da3ae9` lean confirmed                               |
| OQ-5 (atomic vs split migration)   | ✅ LOCKED                      | Single atomic migration. 4 `DROP POLICY` en una transacción. Postgres DDL transactional → atomicity gratis. Reject 4-PR train (false comfort, mismo blast radius).                                                                                                                                                                                                                                                                                                 | BA `ab0e469f56c0e28cc` + SE concur via SECURITY-REVIEW                                                                                      |
| OQ-6 → OQ-5 (rebrand): atomic burn | (subsumed por OQ-5)            | (mismo veredict)                                                                                                                                                                                                                                                                                                                                                                                                                                                   | (mismo)                                                                                                                                     |
| OQ-7 (telemetry source)            | ✅ LOCKED                      | Read-only telemetry script `scripts/observe-rls-burn-readiness.ts` (~50 líneas) NOT canary endpoint. Queries `auth.users.last_sign_in_at` + `audit_log claim_missing count` + `audit_log active_tenant_null count`. M0.5 task new in PLAN.                                                                                                                                                                                                                         | BA `ab0e469f56c0e28cc`                                                                                                                      |
| OQ-8 (CS-3 Resend logs)            | ⏳ Data-dependent              | BA matrix: query Resend dashboard last 30d send count `magic-link` + `recovery` + `signup_confirmation`. If all=0 OR all sent before TTL → SHIP CS-3 410 Gone. Si any within 24h → defer v0.2.7. Cross-check `auth.audit_log_entries`.                                                                                                                                                                                                                             | BA `ab0e469f56c0e28cc`                                                                                                                      |
| OQ-9 (DB-layer kill switch)        | ✅ LOCKED — REJECTED           | NO kill switch DB. Aumenta attack surface (intentional backdoor sin trace pg_policies, GUC session-scoped no audit_log). 24h gate + Option B rollback logra <10min recovery comparable. Stack 5-layer SE propone: 24h gate + atomic burn + rollback explícito + APPROVAL_GATE_ENABLED app-layer + 1h post-burn intensivo monitoring.                                                                                                                               | SE `a2c80b58738bf0367` + BA concur                                                                                                          |
| OQ-10 (PR merge strategy)          | ✅ LOCKED                      | Single PR squash-merge. PR train rejected (4 days extra zero safety, same hook-level signal). Squash da clean cutover commit para `git bisect`.                                                                                                                                                                                                                                                                                                                    | BA `ab0e469f56c0e28cc` (defers a Workflow Architect for convention veto, none received)                                                     |

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

| Role                                 | Sign-off required for                                                       | Status                                                                                                                                                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CEO Jota                             | OQ-2, OQ-3, OQ-4, OQ-8, OQ-9 strategic decisions; FR-RLS-BURN-2 burn-day OK | ✅ OQ-3 + OQ-4 + OQ-8 LOCKED 2026-05-17 sesión 8ª (caso fundacional Sec 4 v2.2 cumplido). OQ-2 + OQ-9 sign-off previo sesión 6ª. Pending: FR-RLS-BURN-2 burn-day OK (gravedad #21.a, ASK al cierre de 24h observability window). |
| Backend Architect (Agent tool real)  | OQ-1, OQ-4, OQ-7 technical decisions                                        | ✅ Done sesión 6ª 2026-05-15, agentId `ab0e469f56c0e28cc` (4 OQs LOCKED + 3 follow-up files proposed)                                                                                                                            |
| Security Engineer (Agent tool real)  | OQ-5, OQ-9 risk decisions; final burn migration sign-off                    | ✅ Done sesión 6ª 2026-05-15, agentId `a2c80b58738bf0367` (5-layer mitigation stack en SECURITY-REVIEW.md)                                                                                                                       |
| Database Optimizer (Agent tool real) | OQ-6 migration shape                                                        | ⏳ To convene next session                                                                                                                                                                                                       |
| Workflow Architect                   | OQ-10 PR merge strategy                                                     | ⏳ To convene next session                                                                                                                                                                                                       |

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

---

## 10. Sub-paso 5.B Cut B-truncado — SPEC (5B.7 synthesis, sesion 15)

> **Authored by**: Claudia + Squad caso #8 fresh (Two-Pass extended s15).
> **Primer pass agents**: Backend Architect `af13e5dc6ba8e3761`, Database Optimizer `abd9617cc3460c75c`, Senior PM `a5b1b6c5cebd7bf7b`.
> **Cold round agents**: Backend Architect `af01dcf973c13eec5`, Database Optimizer `a81de784b85e2c475`, Senior PM `a4c2c775bd786ef39`.
> **C-H2 re-review fresh**: Backend Architect `a874a47a54370a774`, Security Engineer `a7b8b19469251fd2f`.
> **Status**: SPEC merged sesion 15. Subsequent work: 5B.8 ADR-0010 → 5B.9 integration tests → 5B.10 Diff Two-Pass cold → 5B.11 ASK CEO mark PR #6 Ready → ~~5B.12 Sec 2.d merge~~ **SLIP ACEPTADO A s16** (OQ-PM-1 resuelta s15 post primer pass: PM-cold estimate 7-10.75h activo deja 5B.12 sin capacity s15; `hakuna_live=false` hace slip riesgo nulo).

### 10.1 Scope summary

**IN-scope (5.B Cut B-truncado as truncated session 13):**

- B-R1 script schema fix (`observe-rls-burn-readiness.ts` columns `action_type` → `action`, `created_at` → `occurred_at`) — SHIPPED 5B.3 commit `4cf4efb`.
- `APPROVAL_GATE_ENABLED` kill switch (env-based) wired into `runtime-config.ts` + `src/lib/auth/guard.ts` both entrypoints `requireActiveTenantOrRedirect()` / `requireActiveTenantOrResponse()` + warn audit emission via `audit.ts` — SHIPPED 5B.3.bis.
- `public.app_config` key-value table (skeleton) — SHIPPED 5B.4 migration `20260519_v026_002_app_config.sql`.
- DR sa-east-1 runbook section — SHIPPED 5B.5.
- Preview apply + smoketest + seed script with `preventProdMisfire` guard — SHIPPED 5B.6 (`scripts/seed-preview-v026-w1t1-5b.ts`).

**OUT-of-scope (deferred to W1.T2 or later):**

- W1.T2 audit_log writers for `claim_missing` + `active_tenant_null` action types (DEFER from original W1.T1 scope; tracked in W1.T2 SPEC).
- W2 RLS v1 → v2 burn migrations.
- W3 anchor first-claim-mint, W4 burn apply.
- `app_config` consumer wiring (DB-H1, see §10.5).
- `audit_dedup` bypass-when-JTI-null consumer-collapse (C-H2, see §10.5).

### 10.2 Why "truncado"

Original W1.T1 scope included `claim_missing` + `active_tenant_null` audit writers in addition to the schema fix + kill switch. Session 13 reduced scope after Two-Pass extended caso #7 cold round identified false-alarm B1 (partition propagation issue) was actually resolved by `pg_inherits` re-verify, freeing capacity for a leaner ship — but the writers themselves were deferred to W1.T2 to preserve cierre limpio. The remaining 5.B deliverables (B-R1 + APPROVAL_GATE + app_config + DR + seed) are the _prerequisites_ for W1.T2 writers, not the writers themselves.

### 10.3 Invariants I1-I14

| ID  | Invariant                                                                                                                                                                                                                                                                                                                                             | Source                                                               | Test enforcement                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| I1  | `APPROVAL_GATE_ENABLED` is read once at module load in `runtime-config.ts`, never re-read per request. Same value across all guard entrypoints in a process.                                                                                                                                                                                          | BA primer §I1, BA cold confirmed                                     | `runtime-config.test.ts` Group A. **I9 reinforces (security property).**                                                                   |
| I2  | When `APPROVAL_GATE_ENABLED=false`, both `requireActiveTenantOrRedirect()` and `requireActiveTenantOrResponse()` bypass the active-tenant claim check AND emit a warn audit with `tenantId:"__bypass__"` synthetic id.                                                                                                                                | BA primer §I2                                                        | `auth-guard-tenant.test.ts` Groups B+C.                                                                                                    |
| I3  | The bypass audit emission goes through `audit.ts emitApprovalGateBypassAudit()` which calls `append_audit` SQL with synthetic payload. Failure of the audit SQL call MUST NOT rethrow (kill-switch must work even if audit RPC fails).                                                                                                                | BA primer §I3, BA cold M1 CONFIRMED HIGH                             | **MISSING TEST** → add to 5B.9 with `rpcMock.mockRejectedValueOnce` confirming non-rethrow.                                                |
| I4  | `append_audit` SQL returns `bigint` (the inserted row id) post-v0.2.6. Pre-v0.2.6 returned void. Migration `20260518_v026_001_audit_dedup.sql` performs the signature change; rollback `_down.sql` reverses with `drop function if exists` precedente (C-H1 fix sesion 15).                                                                           | BA primer §I4 + C-H1 fix                                             | Rollback migration runs without `ERROR 42P13`.                                                                                             |
| I5  | `audit_dedup` gate at SQL `001:143` requires non-null `v_jti`. When `jwt_jti` is null/empty on a `tenant-claim` action, the gate is skipped and `append_audit` proceeds to insert directly (producer-warn-only path).                                                                                                                                 | BA primer §I5, BA cold C-H2 NEW (consumer-collapse to ship in W1.T2) | Producer side: `audit.test.ts` warn-emission. Consumer side: deferred to W1.T2 (see §10.5 C-H2).                                           |
| I6  | `emitApprovalGateBypassAudit` swallows audit RPC failures with try/catch, logs to console, does NOT rethrow. Kill switch path remains functional even under audit RPC outage.                                                                                                                                                                         | BA primer §I6, BA cold M1 CONFIRMED HIGH                             | **MISSING TEST** → add to 5B.9 (D4/D5 in `audit.test.ts`).                                                                                 |
| I7  | `audit_dedup` GC cron `audit_dedup_gc` runs daily at 03:15 UTC; retains 7 days; COMMIT-between-batches at migration `001:93` is legal on PG 17.6 Supabase managed (DBO-H5 empirical verified sesion 15 via preview `llyexugyuwwdqfarumbj`).                                                                                                           | DBO primer §1.2, DBO cold DBO-H5 NEW, empirical s15                  | RUNBOOK-5B.md §5 documents test result. Closure at pg_cron enable in prod.                                                                 |
| I8  | `public.app_config` is RLS-enabled with zero policies → fail-closed deny-all for `authenticated`/`anon`. `service_role` bypass. Reserved key `hook_reenable_ts` documented but NOT yet consumed by any script (DB-H1, see §10.5).                                                                                                                     | DBO primer §1.1, DBO cold confirmed                                  | RLS deny-all asserted via integration test in 5B.9.                                                                                        |
| I9  | `APPROVAL_GATE_ENABLED` env value is **frozen at module load**, not re-read per call. This is a security property: prevents an attacker who gains env-mutation capability from toggling bypass mid-runtime.                                                                                                                                           | BA cold M5-upgrade HIGH (s15)                                        | **MISSING TEST** → add to 5B.9. Without this test, a future refactor to per-call read silently invalidates ADR-0005 §5 break-glass intent. |
| I10 | Migrations 005 (`audit_log` partitioned) + 006 (`audit_log_rotate_partitions()` smoke) create partitions for `current_date + 1 month` and `current_date + 2 months`. Initial partition `audit_log_2026_05` hardcoded at `005:34-36`. Apply window: 2026-05 native; later months require manual current-month backfill (DBO-H4, see RUNBOOK-5B.md §4). | DBO primer §1.3, DBO cold DBO-H4 NEW                                 | RUNBOOK-5B.md §4 + post-v0.2.6 BACKLOG entry.                                                                                              |
| I11 | The `--since-first-claim-mint` anchor (OQ-4 LOCKED) is the ONLY supported anchor for `observe-rls-burn-readiness.ts` in v0.2.6 flip workflow. The `--since-hook-reenable` anchor is DEPRECATED (script line 13) and reserved only for emergency rollback.                                                                                             | BA cold I11 NEW                                                      | Script test asserts mutual exclusion of both flags.                                                                                        |
| I12 | The `observe-rls-burn-readiness.ts` script's verdict is **binary** (`claim_missing > 0` → NO-GO). Count inflation by a single duplicate row already flips to NO-GO; a retry storm does not amplify the verdict beyond `> 0`. SPEC §6.0 confirms the real flip gate is human Rey sign-off, not the script's auto-verdict.                              | C-H2 re-review fresh BA `a874a47a54370a774`                          | Script test asserts `> 0` binary behavior.                                                                                                 |
| I13 | pg_cron enable in prod Hakuna has a hard floor of 2026-07-24 (operational target 2026-07-15). Past this date, the cron tick on day 25 of July creates `audit_log_2026_08` partition; without it, first INSERT failure on/after 2026-08-01. See RUNBOOK-5B.md §3.                                                                                      | DBO cold §4                                                          | PR #6 description must cite both dates. ASK CEO action under DB-H2.                                                                        |
| I14 | The C-H1 `drop function if exists` precedence in `audit_dedup_down.sql:28-35` is required because PG rejects return-type changes via `create or replace function`. This pattern is the canonical analog of lesson `patches-operacionales-emergentes-durante-apply` patch #2.                                                                          | BA cold C-H1 NEW, fixed s15                                          | Down migration applies without error.                                                                                                      |

### 10.4 Resolved findings — Two-Pass extended caso #8 fresh consolidated

| Finding    | Severity                  | Origin                                | Resolution path                                                                                                                                                                                 | Status post-5B.7                                                                                                                            |
| ---------- | ------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| M1         | HIGH                      | BA primer + BA cold                   | `audit.ts emitApprovalGateBypassAudit` non-rethrow test.                                                                                                                                        | DEFER to 5B.9 (test add). I3 + I6.                                                                                                          |
| M2         | (CLOSED)                  | BA primer                             | Naming drift docs vs code. Intent confirmed e04891b: function-name describes failure action (`OrRedirect`/`OrResponse`), type-name describes context (`Page`/`Api`).                            | RESOLVED sesion 15 — `W1.T2-DESIGN-PASS-2.md:241-242,392` updated with semantic note. Code unchanged.                                       |
| M5-upgrade | HIGH                      | BA cold                               | I9 env-freeze invariant security property test enforcement.                                                                                                                                     | DEFER to 5B.9 (test add).                                                                                                                   |
| C-H1       | HIGH                      | BA cold NEW                           | `audit_dedup_down.sql` rollback fails on return-type change. Fix: `drop function if exists` precedente.                                                                                         | **RESOLVED sesion 15** — migration patched. I14.                                                                                            |
| C-H2       | MED (downgrade from HIGH) | BA cold NEW + re-review fresh BA + SE | Bypass when JTI null inflates `claim_missing` count. Re-review converged: fail-closed direction, real gate is human Rey sign-off, count inflation does not flip verdict (already binary `> 0`). | DEFER to W1.T2 with 4-tripwire (see §10.5).                                                                                                 |
| DB-H1      | HIGH                      | DBO primer + BA cold C-H3 joint       | `app_config` plumbing-dead — no consumer in `observe-rls-burn-readiness.ts`.                                                                                                                    | DEFER to W1.T2 Option A skeleton with 3-tripwire (see §10.5).                                                                               |
| DB-H2      | HIGH                      | DBO primer + math                     | pg_cron deadline 2026-07-15 operational / 2026-07-24 hard floor.                                                                                                                                | ASK CEO via PR #6 description bloque (5B.11). RUNBOOK-5B.md §3.                                                                             |
| DB-H3      | HIGH                      | DBO primer + cold block               | D-COLD-4 methodology not in runbook.                                                                                                                                                            | **RESOLVED sesion 15** — RUNBOOK-5B.md §2 with copy-pasteable block.                                                                        |
| DBO-H4     | HIGH                      | DBO cold NEW                          | Fresh-DB apply ≥ 2026-06 leaves current-month uncovered.                                                                                                                                        | **RESOLVED sesion 15** — RUNBOOK-5B.md §4 doc + post-v0.2.6 BACKLOG entry.                                                                  |
| DBO-H5     | LOW (downgrade from HIGH) | DBO cold NEW                          | COMMIT-in-DO legality version-dependent.                                                                                                                                                        | **EMPIRICAL VERIFIED sesion 15** on PG 17.6 Supabase managed — COMMIT-in-DO is legal. RUNBOOK-5B.md §5. Residual closure at pg_cron enable. |

### 10.5 Open scope deferred to W1.T2

#### DB-H1 — `app_config` consumer wiring

**Decision (CEO Jota sesion 15)**: Option A ship-as-skeleton with 3 mandatory tripwires:

1. **Code TODO** at `scripts/observe-rls-burn-readiness.ts` line ~82 (above `fetchFirstClaimMintT0` JSDoc) — committed sesion 15.
2. **SPEC reference**: this section (§10.5).
3. **BACKLOG entry**: `D:\impluxa-web\.planning\BACKLOG.md` DB-H1.

**Closure target**: W1.T2 SPEC. Closure criterion: `scripts/observe-rls-burn-readiness.ts` reads `public.app_config.value->>'hook_reenable_ts'` and uses it as fallback anchor when `--since-hook-reenable` is used. Integration test asserts read path returns expected payload from a seeded `app_config` row.

#### C-H2 — `audit_dedup` bypass when JTI missing

**Decision (CEO Jota sesion 15 via internal re-review caso #8)**: DEFER-W1.T2 with 4 mandatory tripwires (BA `a874a47a54370a774` + SE `a7b8b19469251fd2f` converged):

1. **Code TODO** at `src/lib/auth/audit.ts:80` above the B-COLD-1 comment — committed sesion 15.
2. **SPEC reference**: this section (§10.5).
3. **BACKLOG entry**: `D:\impluxa-web\.planning\BACKLOG.md` C-H2.
4. **Specific W1.T2 closure test name**: `tests/integration/observe-rls-burn-readiness-jti-null-collapse.test.ts` with 4 named assertions (a/b/c/d) — see BACKLOG entry C-H2 for the assertion spec.

**Rationale for DEFER vs FIX-AHORA**: re-review converged on MED (not HIGH). Direction of corruption is fail-closed (false NO-GO = safe; the only direction that would be exploitable is false GO, which does not exist in the binary `> 0` gate). Real flip gate is human Rey sign-off (SPEC.md:60), not script auto-verdict. All FIX-AHORA alternatives are out of Cut B scope (auth-boundary reject breaks T5 compat; fail-closed at audit.ts reverses fail direction to UNSAFE; synthetic dedup PK is schema change).

### 10.6 Acceptance criteria for 5B.7-5B.10 closure

- **5B.7 (THIS DOC)**: SPEC §10 merged + invariants I1-I14 documented + open scope §10.5 named + accept-criteria §10.6 declared. No unresolved OQ at this layer.
- **5B.8**: ADR-0010 published referencing SPEC §10. Decision recorded: producer-warn + consumer-collapse design for C-H2 (deferred consumer); ship-as-skeleton for `app_config` (deferred consumer); empirically verified COMMIT-in-DO for cron body.
- **5B.9**: integration tests cover I3, I6, I9 (MISSING test enforcement). All green in CI. C-H2 closure test deferred to W1.T2 per §10.5.
- **5B.10**: Diff Two-Pass cold returns 0 HIGH findings against the synthesis SPEC. Cold round audits only the new SPEC + ADR + tests, not the Cut B code (already audited s13 + s15 caso #8).

### 10.7 PR #6 readiness checklist (5B.11 ASK CEO mark Ready)

Gates that must be objectively true before 5B.11 ASK to CEO:

| #   | Gate                                                                                                      | Evidence                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | All CI checks green on PR #6 HEAD                                                                         | `gh pr checks 6 --json conclusion,name` returns all `success`. Currently green at `b7ed8d6` via run `26122393167`. |
| 2   | SPEC §10 committed                                                                                        | git log shows commit touching `D:\impluxa-web\.planning\v0.2.6\SPEC.md` with `chore(v0.2.6/5B.7)` prefix.          |
| 3   | ADR-0010 committed                                                                                        | git log shows commit touching `D:\impluxa-web\docs\adr\0010-*.md`.                                                 |
| 4   | Integration tests committed for I3, I6, I9 + green in CI                                                  | `gh pr checks 6` includes new test names from 5B.9.                                                                |
| 5   | RUNBOOK-5B.md committed                                                                                   | git log shows commit touching `.planning/v0.2.6/RUNBOOK-5B.md`.                                                    |
| 6   | BACKLOG.md committed with DB-H1 + C-H2 entries                                                            | git log shows commit touching `.planning/BACKLOG.md`.                                                              |
| 7   | PR #6 description updated with pg_cron deadline 2026-07-15 / 2026-07-24 bloque                            | `gh pr view 6 --json body` contains both dates and SQL from RUNBOOK-5B.md §3.6.                                    |
| 8   | Diff Two-Pass cold 5B.10 dossier archived                                                                 | `D:\impluxa-web\.planning\v0.2.6\W1.T1-5B.10-DIFF-TWO-PASS-COLD.md` exists with verdict 0 HIGH.                    |
| 9   | Caso #8 fresh dossier completo archivado (per lesson `dossier-two-pass-extended-no-archivado-pre-cierre`) | `D:\segundo-cerebro\meta\caso8-dossier-completo.md` exists.                                                        |
| 10  | No open HIGH bloqueante from caso #8 Squad                                                                | This SPEC §10.4 shows all HIGH resolved or deferred with tripwire.                                                 |

### 10.8 Radar Caso #7 reconciliation

Per the artifact `D:\segundo-cerebro\meta\caso7-codes-prior-caso8.md`, 10 codes nominally identified at sesion 13 closure. Verification against HEAD `b7ed8d6` + this synthesis:

| Caso #7 code                                     | Status             | Evidence in HEAD                                                                                                                           |
| ------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| B-R1                                             | RESOLVED           | commit `4cf4efb` 5B.3, script schema fix.                                                                                                  |
| B1 (false alarm)                                 | CLEARED            | D-COLD-4 methodology RUNBOOK-5B.md §2.                                                                                                     |
| B-H4 / B-COLD-3 / B-COLD-4 / D-COLD-1 / D-COLD-6 | CLEARED            | All re-confirmations of B1 false alarm.                                                                                                    |
| D-COLD-4 (verify mandate)                        | RESOLVED           | RUNBOOK-5B.md §2 block.                                                                                                                    |
| B-COLD-1 (TenantClaimAction sin jwt_jti warn)    | SUPERSEDED by C-H2 | s13 marked RESOLVED via warn log; s15 cold + re-review converged: producer-warn-only is correct, consumer-collapse ships W1.T2. See §10.5. |
| P-COLD-9 (preventProdMisfire seed guard)         | RESOLVED           | commit `4cf4efb` 5B.6 `seed-preview-v026-w1t1-5b.ts` with guard.                                                                           |

**~5 HIGH unnamed Caso #7**: cold round caso #8 §3 found 5 plausible mappings (C-H1, C-H2, C-H3 = DB-H1 joint, C-M4, M5-upgrade). Diff-mode `4cf4efb..b7ed8d6` BA cold review confirmed the diff itself is clean (CI workflow only); the 5 unnamed map to issues IN the Cut B-truncado code itself (already addressed via §10.4 + §10.5 + tripwires).

### 10.9 Risks

| #   | Risk                                                                                                                    | Severity                       | Mitigation                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 5B.10 Diff Two-Pass cold surfaces new HIGH requiring code change                                                        | MED                            | Time-box; if HIGH found, add 5B.13 fix cycle and slip to s16 along with 5B.12.                                                                                                         |
| R2  | W1.T2 scope grows under deferred tripwires (DB-H1 + C-H2 both close in W1.T2)                                           | LOW                            | Tripwires are explicit + closure tests named. W1.T2 SPEC must include both closures as P0.                                                                                             |
| R3  | PR #6 conflict with main at merge time                                                                                  | GREEN (preempt)                | `git merge-tree main feature/v0.2.6-rls-burn-onboarding` returned no conflict. Branch CLEAN-MERGEABLE 27 files / 5815 LOC (PM cold verified).                                          |
| R4  | Sec 2.d merge eval 5B.12 requires its own Two-Pass extended; capacity tight                                             | MED                            | OQ-PM-1 RESOLVED s15: slip 5B.12 → s16 accepted. `hakuna_live=false` makes slip riesgo nulo.                                                                                           |
| R5  | Logflare procurement still pending CEO ASK                                                                              | MED (post-v0.2.6 blocker only) | NOT a 5.B blocker. Surface separately at cierre s15 as standalone ASK with comparative Squad (Better Stack / Axiom / Sentry-as-sink).                                                  |
| R6  | pg_cron not enabled by 2026-07-24 hard floor                                                                            | HIGH (date-bound)              | DB-H2 SQL block in PR #6 description (gate 7 of §10.7). Tracked operationally.                                                                                                         |
| R7  | Caso #8 fresh dossier completo NOT archived pre-cierre s15 (lesson `dossier-two-pass-extended-no-archivado-pre-cierre`) | LOW                            | Gate 9 of §10.7. Mechanical T1 archive of all PASS-1/PASS-2/REREVIEW dossiers consolidated.                                                                                            |
| R8  | New invariants I11-I14 not yet stress-tested empirically                                                                | LOW                            | I11 (anchor mutual exclusion) and I12 (binary verdict) testable in 5B.9. I13 (pg_cron deadline) is operational, not code-testable. I14 (drop precedence) testable via rollback CI run. |

### 10.10 References

- **Squad dossiers (Two-Pass extended caso #8 fresh sesion 15)**:
  - Primer: `W1.T1-5B-SPEC-PASS-1-{BA,DBO,PM}.md`
  - Cold: `W1.T1-5B-SPEC-PASS-2-{BA,DBO,PM}.md`
  - C-H2 re-review: `W1.T1-5B-C-H2-REREVIEW-{BA,SE}-FRESH.md`
- **Operations runbook**: `RUNBOOK-5B.md`
- **Backlog**: `D:\impluxa-web\.planning\BACKLOG.md`
- **Caso #7 radar artifact**: `D:\segundo-cerebro\meta\caso7-codes-prior-caso8.md`
- **Lessons triangulated**:
  - `patches-operacionales-emergentes-durante-apply` (s10a — analog of C-H1)
  - `two-pass-extended-validado-en-uso-real` (s9a — methodology that surfaced these)
  - `dossier-two-pass-extended-no-archivado-pre-cierre` (s14 — mitigation: caso #8 dossier completo at cierre s15)

### 10.11 Change log

| Session | Author                                                | Change                                                                                                                                                                                                                                 |
| ------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| s15     | Claudia + Squad caso #8 fresh + re-review fresh BA+SE | SPEC §10 synthesized. 14 invariants I1-I14 declared. 10 findings resolved/deferred with tripwires. Acceptance criteria for 5B.7-5B.10 + PR #6 readiness checklist + radar Caso #7 reconciliation. 5B.12 SLIP A s16 (OQ-PM-1 RESUELTA). |
