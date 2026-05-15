# v0.2.6 — RESEARCH (skeleton)

**Status:** SKELETON — to be filled with council citations next session.
**Companion to:** `SPEC.md` (this directory).

---

## 1. Precedent — how others "burn" shadow RLS policies

### To investigate next session

- Supabase official guidance on policy migrations + zero-downtime swaps.
- Postgres `ALTER POLICY` vs `DROP POLICY + CREATE POLICY` semantics during open transactions on tenant tables.
- Auth0 / Clerk / Stytch incident postmortems on auth claim cutovers (any public reports of "we removed the legacy permissive predicate too early").
- Industry pattern: shadow-write + shadow-read + cutover, applied to RLS specifically (most literature is application-layer, not DB-layer).

### Already known (from v0.2.5)

- Pattern source: `supabase/migrations/20260511_003d_security_fixes.sql:1-50` (split policies pattern).
- v2 RESTRICTIVE shadow approach validated by Security Engineer round 3 of v0.2.5 W2 review (`PLAN-REVIEW.md` round 3, finding `sites_public_read_published`).
- Drop scheduled per ADR-0005 §"When to revisit".

---

## 2. Telemetry needed for the 24h gate (FR-RLS-BURN-2)

### Hypothesis (to validate with Backend Architect)

- Source 1: Supabase Logs Explorer — filter on `auth.users` token-mint events, count rows where claim is populated.
- Source 2: existing audit_log table (`docs/adrs/0007-audit-log-hash-chain.md`) — search for `claim_missing` action type if it was wired in v0.2.5; if not, add it as a small ticket.
- Source 3: Postgres function `current_active_tenant()` could be instrumented to log on the `null` branch (one-off temporary `RAISE NOTICE` or persistent counter).

### Open: do we need a dedicated dashboard, or is ad-hoc query enough?

- Argument for ad-hoc: cohort 1 = Hakuna only, low volume, manual SQL is fine.
- Argument for dashboard: if v0.2.6 includes CS-1b (2nd tenant dry-run), volume doubles and ad-hoc becomes lossy.

---

## 3. Rollback strategy options for the burn migration

### Option A — git-history rollback only

Burn migration drops v1 policies; rollback is to `git revert` the migration commit and re-apply. Simple. Risk: any drift in DB state vs git is invisible.

### Option B — explicit rollback migration shipped alongside burn

File pair: `2026XXXX_v026_burn_v1.sql` + `2026XXXX_v026_burn_v1_ROLLBACK.sql`. Latter is a `CREATE POLICY` re-creating each v1 policy from a captured snapshot. Used if burn proves bad post-merge.

### Option C — Option B + DB-layer kill switch (tied to OQ-9)

Same as B, plus `ALTER POLICY ... USING (true)` toggle that opens v2 to "fail-open mode" gated by a session GUC. Risky — gives an attacker a target. Probably overkill; document as rejected unless Security Engineer disagrees.

### Senior PM lean

Option B. Clean, recoverable, no exotic surface area.

---

## 4. Hook re-enable — where does the precondition live?

Currently pending Telegram msg_id=54 ASK to Rey. Does v0.2.6 SPEC own this, or does it stay outside the phase boundary?

### Two readings

- **Inside phase:** v0.2.6 PLAN.md includes "M0 — Hook re-enable (Rey-gated)" as the first task. Pro: the phase tracks the full RLS lifecycle. Con: the phase becomes blocked on a Rey decision before it can even _start_ in the doc system.
- **Outside phase:** Hook re-enable lives in PR #2 runbook (current state). v0.2.6 starts only after re-enable + 24h. Pro: clean phase boundary. Con: causal chain across phases.

### Senior PM lean

Outside phase. Cleaner ROADMAP semantics: v0.2.6 phase = "the burn", not "the burn prep".

---

## 5. CS-1 — 2nd tenant onboarding research

### Subquestions

- Does the existing `/admin/tenants/new` route (per ROADMAP A2) exercise enough of the multi-tenant code path to count as a real isolation test, or do we need an end-to-end "log in as 2nd tenant owner, see only their data" smoke?
- If real (CS-1a), what's the minimum customer-facing surface we'd need? DNS wildcard (10 min Cloudflare), Vercel domain add (5 min), Resend domain (manual, ~30 min), payment hookup (TBD).
- Hakuna currently has no public second tenant in the funnel — so CS-1a would be synthetic regardless. That argues hard for CS-1b.

### Senior PM lean

CS-1b — give v0.2.6 the _capability_ of a second tenant via a flag-gated dry run. Real second tenant goes in v0.3.0 alongside DNS wildcard.

---

## 6. CS-3 — callback route burn risk analysis

### Question

Are there any pre-OTP magic links still in user inboxes that, if clicked post-burn, would 404 instead of 410?

### Investigation needed

- Check Resend logs for `magic-link` template sends in last 30 days (if accessible).
- Check Supabase auth events for `signup` or `recovery` flows that emitted magic links.
- If zero in last 30 days → safe to 410 in v0.2.6; remove fully in v0.2.7.
- If non-zero → defer to v0.2.7 with extended grace period.

---

## 7. Property-based fuzz extension (CS-5)

### Candidates per PLAN.md M12

- Cookie-domain stripper (W3.G7.T2 commit `7dcb2c1`).
- JWT verifier wrapper (`jose` integration, W1.T4).
- Hostname parser (middleware host-routing).

### Inputs to randomize

- Unicode bypass attempts (homoglyphs, RTL override).
- Encoded characters (URL-encoded slashes, double-encoded, percent in cookie values).
- Length boundaries (empty, max-RFC, beyond).
- Invalid JWT shapes (3 segments, 2 segments, missing signature, alg=none).

---

## 8. Council to convene next session (Agent tool real)

Per regla #25 (consejo unánime → ejecuta directo on T1-T2 reversible) and regla #21 (Security Engineer mandatory before T2+ impact):

- **Backend Architect** (`agentId TBD`) — OQ-1, OQ-4, OQ-7.
- **Security Engineer** (`agentId TBD`) — OQ-5, OQ-9; final burn migration sign-off.
- **Database Optimizer** (`agentId TBD`) — OQ-6.
- **Workflow Architect** (`agentId TBD`) — OQ-10.
- **Senior PM** (continuity) — synthesize + rank into PLAN.md.

Goal of next session: convert SPEC.md DRAFT → SPEC.md LOCKED + draft PLAN.md with task IDs + acceptance criteria.

---

## 9. References

See `SPEC.md` §7. Same set; this file does not duplicate.
