# Code Review — FASE 1A Handlers

**Reviewer:** everything-claude-code:typescript-reviewer
**Date:** 2026-05-11
**Files reviewed:**

- src/app/api/leads/route.ts
- src/app/api/site/content/route.ts
- src/app/api/site/publish/route.ts
- src/app/api/admin/tenants/route.ts
- src/lib/auth/guard.ts

**Findings summary:** 4 HIGH, 3 MEDIUM, 1 LOW

---

### F-001 — `as any` cast on `user.app_metadata` in guard.ts

- **Severity:** HIGH
- **File:** src/lib/auth/guard.ts:17
- **Status:** Resolved
- **Description:** `(user.app_metadata as any)?.role` — unnecessary cast. `UserAppMetadata` from `@supabase/auth-js` already declares `[key: string]: any`, so `.role` is accessible without casting. The cast silences the type checker without adding safety and leaves an unjustified `eslint-disable-next-line` comment.
- **Fix:** Removed cast; use `user.app_metadata?.role` directly. Removed the eslint-disable comment.
- **Resolution commit:** (see atomic commit below)

### F-002 — `as any` cast on `user.app_metadata` in admin/tenants route

- **Severity:** HIGH
- **File:** src/app/api/admin/tenants/route.ts:20
- **Status:** Resolved
- **Description:** Same pattern as F-001 — `(user.app_metadata as any)?.role !== "admin"` with an unjustified eslint-disable. Unnecessary cast against a well-typed index signature.
- **Fix:** Replaced with `user.app_metadata?.role !== "admin"`. Removed the eslint-disable comment.
- **Resolution commit:** (see atomic commit below)

### F-003 — Floating promises on `sites.insert` and `subscriptions.insert` in admin/tenants route

- **Severity:** HIGH
- **File:** src/app/api/admin/tenants/route.ts:61-75
- **Status:** Resolved
- **Description:** Both `await svc.from("sites").insert(...)` and `await svc.from("subscriptions").insert(...)` were awaited but their return values discarded — errors silently swallowed. A DB constraint violation (e.g., duplicate `tenant_id` in sites) would leave the tenant in a partially created state and return `{ ok: true }` to the caller. This is a data integrity bug.
- **Fix:** Destructured `{ error: se }` and `{ error: sube }` from each insert; return 500 on failure.
- **Resolution commit:** (see atomic commit below)

### F-004 — Unguarded destructure of `listUsers()` response

- **Severity:** HIGH
- **File:** src/app/api/admin/tenants/route.ts:80
- **Status:** Resolved
- **Description:** `const { data: { users: existing } } = await svc.auth.admin.listUsers()` — `error` field was never checked. If `listUsers` fails (network error, invalid service role), the destructure of `.data.users` would throw an unhandled exception, causing an opaque 500 with no structured error response.
- **Fix:** Destructured `{ data: listData, error: le }`, guard on `le`, then access `listData.users`.
- **Resolution commit:** (see atomic commit below)

### F-005 — DB error on content update returns 403 instead of 500

- **Severity:** MEDIUM
- **File:** src/app/api/site/content/route.ts:29-33
- **Status:** Open
- **Description:** Any Supabase error from `sites.update` is returned as HTTP 403. An RLS violation genuinely deserves 403, but a network timeout or DB constraint violation should return 500. Current code conflates the two, making it impossible for clients to distinguish auth failures from infrastructure failures.
- **Fix (backlog v0.4.0+):** Inspect `error.code` — PGRST codes `42501`/`28000` → 403, others → 500. Alternatively wrap in try/catch and return 500 for unexpected throws.

### F-006 — DB error on publish returns 403 instead of 500

- **Severity:** MEDIUM
- **File:** src/app/api/site/publish/route.ts:29
- **Status:** Open
- **Description:** Same as F-005. `if (e1 || e2) return NextResponse.json({ ok: false }, { status: 403 })` treats all DB errors as authorization failures. A failed update to `tenants` for reasons unrelated to RLS (e.g., DB overload) is misreported as 403.
- **Fix (backlog v0.4.0+):** Distinguish RLS errors from infrastructure errors by checking `error.code`.

### F-007 — `/api/leads` route accepts `tenant_id` from client without verifying tenant is active

- **Severity:** MEDIUM
- **File:** src/app/api/leads/route.ts
- **Status:** Open
- **Description:** The route validates shape (UUID, name, email) but does not verify that `tenant_id` refers to a real, non-suspended tenant. An attacker can spray lead records into arbitrary tenant UUIDs, polluting other tenants' inboxes. RLS on `leads_tenant` may guard this at the DB level, but the service-role client bypasses RLS, so no DB-level protection exists here.
- **Fix (backlog v0.4.0+):** After Zod parse, query `tenants` (SSR client or explicit check) to confirm `id = tenant_id AND status != 'suspended'` before inserting.

### F-008 — Magic number `14 * 86_400_000` duplicated

- **Severity:** LOW
- **File:** src/app/api/admin/tenants/route.ts (formerly lines 52 and 74)
- **Status:** Resolved
- **Description:** Trial duration expressed as inline magic number in two places — easy to diverge on future edits.
- **Fix:** Extracted to `const TRIAL_DAYS_MS = 14 * 86_400_000` at module scope. Both call sites now reference the constant.
- **Resolution commit:** (see atomic commit below)
