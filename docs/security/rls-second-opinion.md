# Security Review — FASE 1A RLS + Auth Layer (Second Opinion)

**Date:** 2026-05-11
**Reviewer:** everything-claude-code:security-reviewer (independent pass)
**Scope:** 7 migrations (001, 001b, 002, 002b, 003, 003b, 003c) + 3 RLS tests + admin-setup.md
**Branch:** `fase-1a-multi-tenant`

**Verdict: NEEDS_FIXES**

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| High     | 2     |
| Medium   | 4     |
| Low      | 4     |

> Note: Live DB queries were blocked by the sandbox during the review (network egress denied). Findings below are static analysis of migration files. Live verification is pending re-run.

---

## HIGH

### H1 — `is_admin()` grant/revoke fragmentation across 3 migrations

**Files:** `003_rls_policies.sql:118`, `003b_fixes.sql:18–19`, `003c_is_admin_grant.sql:4`

The same function has its EXECUTE privilege revoked in 003, revoked again in 003b, and granted in 003c. If migrations are replayed out of order (or 003 is re-applied after a reset), `authenticated` loses EXECUTE on `is_admin()` and **every RLS policy that calls it silently breaks** (`tenants_admin_all`, `sites_member_all`, `leads_member_read`, etc.).

**Fix:** consolidate the final grant state into a single `003d` migration:

```sql
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
```

Document the intent inline. Leave 003/003b/003c untouched (already applied).

### H2 — `leads_tenant` lacks explicit deny on UPDATE/DELETE — silent default deny is fragile

**File:** `003_rls_policies.sql:66–77`

Currently safe (no policy = deny), but future devs adding an UPDATE policy can inadvertently open DELETE. Make append-only intent explicit:

```sql
create policy leads_no_update on public.leads_tenant for update using (false);
create policy leads_no_delete on public.leads_tenant for delete using (false);
```

---

## MEDIUM

### M1 — `sites_member_all` lets editors DELETE sites

**File:** `003_rls_policies.sql:48–56`

`for all` grants DELETE to both `owner` and `editor` members. Editor should not be able to destroy the site row. Split:

```sql
drop policy sites_member_all on public.sites;
create policy sites_member_read   on public.sites for select using (...);
create policy sites_member_insert on public.sites for insert with check (...);
create policy sites_member_update on public.sites for update using (...) with check (...);
create policy sites_owner_delete  on public.sites for delete using (
  public.is_admin()
  or tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid() and role = 'owner')
);
```

### M2 — `tenants_public_read_published` exposes `created_by` + `trial_ends_at` to anon

**File:** `003_rls_policies.sql:28–29`

Tenant isolation is intact (verified). But anon can read `created_by` (auth.users UUID — useful for user enumeration) and `trial_ends_at` (subscription business data).

**Fix:** create a public view with only the columns the public site needs (`id`, `slug`, `name`, `template_key`, `status`) and grant select on it; drop or scope the public read policy. Tenant SSR queries should use the view.

### M3 — `leads_anon_insert` on FASE 0 `public.leads` has `with check (true)` — spam vector

**File:** `003b_fixes.sql:22–25`

No field constraints in RLS. Must mitigate before production:

- **Schema:** ALTER COLUMN `name` NOT NULL (or one of email/phone/name required).
- **API:** add rate limiter to `/api/leads` and `/api/leads-public` (Task 10).
- **Turnstile:** already integrated in FASE 0 landing — re-check that the API verifies the token.

### M4 — `activity_log` INSERT path is implicit service_role-only with no test/doc

**File:** `003_rls_policies.sql:108–112`

No INSERT policy → only service_role can write. Correct, but invisible and silently fails authenticated writes with no error surfaced. Document in `admin-setup.md` and add a test that `authenticated` INSERT fails.

---

## LOW

- **L1:** `revoke execute on touch_updated_at()` is a no-op for trigger functions (run as table owner). Remove or comment.
- **L2:** `plans_admin_write for all` overlaps with `plans_public_read for select`. Readability issue.
- **L3:** Slug regex allows single-char at regex level; length CHECK (2–42) catches it. Belt-and-suspenders; document.
- **L4:** `tenant_members` has no UPDATE policy for non-admins. Intentional for now; will block invite/role-change in a future task.

---

## Confirmed non-issues

- **TOCTOU on `sites_public_read_published`:** subquery evaluates inside MVCC snapshot — no race.
- **FK leakage `tenant_members.user_id → auth.users`:** `auth` schema not exposed via PostgREST `public` endpoint — no join leak.
- **`is_admin()` SECURITY DEFINER:** body is constant, JWT signed by Supabase — no privilege escalation path.

---

## Test gaps (7 missing cases)

| #   | Test                                                                 | Priority |
| --- | -------------------------------------------------------------------- | -------- |
| 1   | Anon sees published tenant; blocked from draft                       | HIGH     |
| 2   | Cross-tenant write attempt (user A → tenant B site) is denied        | HIGH     |
| 3   | JWT with `app_metadata.role=admin` reads all tenants                 | HIGH     |
| 4   | `leads_anyone_insert` succeeds for published tenant, fails for draft | HIGH     |
| 5   | Editor cannot DELETE site (after M1 fix)                             | MEDIUM   |
| 6   | Authenticated INSERT to `activity_log` is denied                     | MEDIUM   |
| 7   | Authenticated INSERT to `subscriptions` is denied                    | MEDIUM   |

---

## Pending (out of FASE 1A scope, tracked)

- Storage bucket RLS policies → **Task 4** (next).
- API rate limiting on `/api/leads` → **Task 10**.
- CSRF: Next 16 Server Actions check Origin — assumption holds, verify in security review final (Task 17).
- Forced JWT revocation via Supabase Admin API — consider for FASE 1C.
