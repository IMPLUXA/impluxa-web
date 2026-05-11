# Cyber Neo Security Audit — D:\impluxa-web

**Date:** 2026-05-11
**Branch:** fase-1a-multi-tenant
**Scope:** FASE 1A (multi-tenant DB + RLS) + FASE 0 (landing) inheritance
**Agent:** Cyber Neo (single-pass sequential audit)

---

## Executive Summary

| Severity  | Count |
| --------- | ----- |
| Critical  | 0     |
| High      | 2     |
| Medium    | 3     |
| Low       | 2     |
| Info      | 2     |
| **Total** | **9** |

**Top 3 findings:**

1. **[HIGH]** `is_admin()` in initial migration reads wrong JWT path — `auth.jwt() ->> 'role'` instead of `app_metadata.role` — fixed in 003b but original 003 migration is still in history and could be re-applied on a branch reset.
2. **[HIGH]** `src/lib/supabase/server.ts` lacks `'server-only'` import guard — service-role client can be accidentally imported by a Client Component bundle, leaking `SUPABASE_SERVICE_ROLE_KEY` to the browser.
3. **[MEDIUM]** Missing `Content-Security-Policy` and `Strict-Transport-Security` (HSTS) response headers — `next.config.ts` sets 4 of 6 recommended headers but omits these two critical ones.

---

## Findings by Domain

---

### 1. Reconnaissance

**Files scanned:** 32 TypeScript/TSX source files in `src/`
**Migrations:** 8 SQL files in `supabase/migrations/`
**Infra:** `.github/workflows/ci.yml` (GitHub Actions). No Dockerfile. No Docker Compose.
**External dependencies:** 14 runtime packages, 16 devDependencies. `package-lock.json` present.
**CI/CD:** GitHub Actions on push/PR to `main`.

✅ Framework correctly identified as Next.js 16.2.6 App Router (RSC), `@supabase/ssr`-adjacent (`@supabase/supabase-js` v2), Tailwind v4, Resend, Cloudflare Turnstile, Upstash Redis.

---

### 2. Code Security (SAST)

#### FINDING 2-A — `dangerouslySetInnerHTML` usage

**Severity:** Info
**OWASP:** A03:2021 — Injection (XSS)
**CWE:** CWE-79
**File:** `src/app/[locale]/layout.tsx:62`

**Evidence:**

```tsx
dangerouslySetInnerHTML={{
  __html: JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Impluxa",
    url: "https://impluxa.com",
    ...
  }),
}}
```

**Assessment:** Value is `JSON.stringify` of a 100% hardcoded object — no user input, no env var interpolation. **Not exploitable.** JSON.stringify escapes `<`, `>`, `&` as `<` etc. by default in modern environments.

**Remediation:** No action required. Optional: add `JSON.stringify(..., null, 0)` and consider `<script type="application/ld+json">` via a sanitized string if content ever becomes dynamic.

---

#### FINDING 2-B — No SQL injection, SSRF, path traversal, command injection, or prototype pollution vectors found

✅ No raw template literals in Supabase `from()` calls.
✅ No `fetch(req.body.url)` or user-controlled URL patterns.
✅ No `fs.readFile`, `exec`, `spawn` with user input.
✅ No `eval()` or `innerHTML` assignments.
✅ All user input passes through Zod schema validation before touching any data store.

---

### 3. Auth & Authorization

#### FINDING 3-A — `is_admin()` reads wrong JWT path in migration 003 (superseded but risky in history)

**Severity:** High
**OWASP:** A01:2021 — Broken Access Control
**CWE:** CWE-285 — Improper Authorization
**File:** `supabase/migrations/20260511_003_rls_policies.sql:9`

**Evidence:**

```sql
-- Migration 003 (ORIGINAL - WRONG):
select coalesce(auth.jwt() ->> 'role', '') = 'admin'

-- Migration 003b (FIX - CORRECT):
select coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
```

**Impact:** If migration 003b is not applied (e.g. branch reset, partial migration), the `is_admin()` function reads the top-level `role` claim. Supabase sets this to `authenticated` or `anon` — it will **never** equal `'admin'`, so all admin operations silently fail (no privilege escalation risk here). However, if any system ever wrote `role: admin` to the JWT root (not `app_metadata`), it would be unintended privilege escalation. The real risk is that admin operations are completely broken until 003b runs.

**Remediation:** Migration 003b correctly fixes this and is already present. Ensure 003b always runs after 003. Consider squashing both into a single migration for clarity. Validate via: `select public.is_admin()` in Supabase SQL editor while authenticated as admin user — must return `true`.

---

#### FINDING 3-B — `server.ts` missing `'server-only'` import guard

**Severity:** High
**OWASP:** A02:2021 — Cryptographic Failures (secret exposure)
**CWE:** CWE-312 — Cleartext Storage of Sensitive Information
**File:** `src/lib/supabase/server.ts`

**Evidence:**

```typescript
import { createClient } from "@supabase/supabase-js";

export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;   // ← service role key
  // NO 'server-only' import at top of file
```

**Impact:** In Next.js App Router, any file can be inadvertently imported by a Client Component. Without `import 'server-only'` at the top, if a developer ever imports `getServiceSupabase()` from a `'use client'` file, Next.js will attempt to bundle it for the browser — at build time Next.js will substitute server-only env vars as empty strings (the var won't exist), but the function will silently return a broken client. More critically, the import chain error won't be caught at build time, only at runtime. The `'server-only'` package causes an explicit build error, preventing accidental exposure.

**Remediation:**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
```

Also: `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix) is correctly handled — it won't be inlined into client bundles. The guard is still a defense-in-depth best practice.

---

#### FINDING 3-C — Middleware only handles i18n routing — no auth gate

**Severity:** Medium
**OWASP:** A01:2021 — Broken Access Control
**CWE:** CWE-284 — Improper Access Control
**File:** `src/middleware.ts`

**Evidence:**

```typescript
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
export default createMiddleware(routing);
export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] };
```

**Assessment:** Current state (FASE 1A) has no protected routes in `src/app/` — it's a landing page only. No dashboard, no tenant admin pages yet. However, as FASE 1B adds authenticated routes (tenant dashboard, admin panel), there is **no middleware guard** in place to redirect unauthenticated users. This is a latent risk for the next phase.

**Remediation:** Before shipping any authenticated route, compose the auth guard into middleware:

```typescript
import { createServerClient } from "@supabase/ssr";
// Check session in middleware, redirect to /login if missing
// Keep i18n middleware separate or compose both
```

Use `getUser()` (not `getSession()`) in the server context — `getUser()` makes a network request to Supabase Auth to validate the JWT, while `getSession()` only reads the local cookie without re-validation.

---

#### FINDING 3-D — Service role client used in Server Action (acceptable with caveats)

**Severity:** Info
**File:** `src/components/lead-form/lead-form-actions.ts:40`

**Assessment:** `getServiceSupabase()` (which uses `SUPABASE_SERVICE_ROLE_KEY`) is used in a `"use server"` Server Action that inserts into `public.leads`. This is intentional — the `leads` table requires service role because the only write policy (`leads_anon_insert`) is `with check (true)` which allows anon, but the action is structured to call service role for simplicity. This is acceptable for a lead form. Mitigation: the action validates user input through Zod, verifies Turnstile, and enforces rate limiting before inserting.

**Recommendation:** Consider using the anon client with the `leads_anon_insert` policy instead of service role, to follow the principle of least privilege. Service role bypasses ALL RLS.

---

### 4. Cryptography

✅ No `crypto.createHash('md5')` or `crypto.createHash('sha1')` usage found.
✅ No `Math.random()` used for security purposes found.
✅ No `NODE_TLS_REJECT_UNAUTHORIZED=0` found.
✅ No weak cipher configurations found.
✅ All ID generation uses PostgreSQL `gen_random_uuid()` (cryptographically secure).
✅ Turnstile token verification uses HTTPS POST to Cloudflare endpoint — correct implementation.

---

### 5. Secret Detection

✅ `.env.local` is gitignored via `.env*` wildcard in `.gitignore` line 34.
✅ `git log --all --full-history -- .env.local` returns empty — never committed.
✅ No AWS keys (`AKIA...`), GitHub tokens (`ghp_`, `ghs_`), Stripe live keys (`sk_live_`) found in any source file.
✅ No MercadoPago live keys (`APP_USR-`) found in source files.
✅ No hardcoded JWTs (`eyJ...`) in source files.
✅ No Resend keys (`re_...`) hardcoded in source files.

#### FINDING 5-A — `.env.example` missing; `.env.local.example` exists but name is non-standard

**Severity:** Low
**OWASP:** A05:2021 — Security Misconfiguration
**CWE:** CWE-312
**File:** `D:\impluxa-web\.env.local.example` (exists), `D:\impluxa-web\.env.example` (missing)

**Evidence:** The project has `.env.local.example` (correctly sanitized with placeholder values). However, the `.gitignore` pattern is `.env*` which would match `.env.local.example` too — meaning the example file is also gitignored and won't be tracked by contributors.

**Remediation:** Rename to `.env.example` (which by convention is committed). Update `.gitignore` to exclude `.env.local` and `.env.production` but NOT `.env.example`:

```gitignore
# env files
.env.local
.env.production
.env.*.local
# DO NOT ignore .env.example
```

---

### 6. Dependencies (SCA)

**npm audit result:** 2 moderate, 0 high, 0 critical

#### FINDING 6-A — PostCSS XSS vulnerability (moderate) in `next` dependency chain

**Severity:** Medium
**OWASP:** A06:2021 — Vulnerable and Outdated Components
**CVE:** PostCSS — "Unescaped `</style>` in CSS Stringify Output" (moderate)
**Package:** `postcss` (transitive via `next@16.2.6`)

**Evidence:**

```
PKG: postcss | severity: moderate | title: PostCSS has XSS via Unescaped </style> in its CSS Stringify Output
Fix: next@9.3.3 (major version bump — not a valid fix for this project)
```

**Assessment:** The suggested fix (`next@9.3.3`) is a downgrade from a different major version branch — not applicable. This PostCSS vulnerability affects CSS-in-JS server-side rendering of user-controlled CSS values. This project does not render user-controlled CSS through PostCSS at runtime; PostCSS runs only at build time. **Risk is low for this specific app.**

**Remediation:** Monitor for a `next@16.x` patch that upgrades the bundled PostCSS version. No immediate action required given usage patterns, but track this advisory.

---

### 7. Web Security Headers

**Implemented headers (in `next.config.ts`):**
| Header | Status |
|---|---|
| `X-Frame-Options: DENY` | ✅ Set |
| `X-Content-Type-Options: nosniff` | ✅ Set |
| `Referrer-Policy: strict-origin-when-cross-origin` | ✅ Set |
| `Permissions-Policy: camera=(), microphone=(), geolocation=()` | ✅ Set |
| `Strict-Transport-Security` (HSTS) | ❌ Missing |
| `Content-Security-Policy` (CSP) | ❌ Missing |

#### FINDING 7-A — Missing `Strict-Transport-Security` (HSTS)

**Severity:** Medium
**OWASP:** A05:2021 — Security Misconfiguration
**CWE:** CWE-319 — Cleartext Transmission of Sensitive Information
**File:** `next.config.ts`

**Remediation:**

```typescript
{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
```

Note: Only add this header when you are certain the domain serves HTTPS exclusively (it does — Vercel enforces HTTPS). Vercel may inject HSTS itself, but explicit configuration ensures it's always present.

---

#### FINDING 7-B — Missing `Content-Security-Policy` (CSP)

**Severity:** Medium
**OWASP:** A03:2021 — Injection (XSS)
**CWE:** CWE-1021 — Improper Restriction of Rendered UI Layers
**File:** `next.config.ts`

**Assessment:** No CSP header is set. While the current codebase has no identified XSS vectors, CSP provides defense-in-depth by restricting which scripts/styles/frames can load. With Next.js App Router + R3F + Tailwind, crafting a strict CSP requires nonce-based approach for inline scripts.

**Remediation (starter):**

```typescript
{
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",  // tighten with nonce when ready
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com https://api.resend.com https://api.upstash.io",
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ")
}
```

Note: R3F (WebGL) requires `worker-src blob:` and WebGL context — test thoroughly after enabling.

---

#### FINDING 7-C — CSRF posture

**Assessment:** Server Actions in Next.js App Router include built-in CSRF protection via the Origin check (Next.js validates that requests to Server Actions originate from the same origin). Cookie-based session management with `httpOnly` is handled by `@supabase/ssr`. No explicit CORS handler found — API routes directory does not exist yet. ✅ No CSRF vulnerability identified.

---

#### FINDING 7-D — Cookie security

**Assessment:** Session cookies are managed by `@supabase/ssr` which sets `httpOnly`, `secure`, and `sameSite=lax` by default in production. No custom cookie handling found in source. ✅ Acceptable.

---

### 8. Supply Chain

✅ `package-lock.json` present — lockfile exists, supply chain integrity maintained.
✅ No `"*"` or `"latest"` version pins found in `package.json` — all packages use `^` semver ranges (acceptable practice).
✅ No suspicious unrecognized packages found in dependencies.

#### FINDING 8-A — `@upstash/ratelimit` + `@upstash/redis` are optional (graceful degradation)

**Severity:** Low (operational risk, not security)
**File:** `src/lib/ratelimit.ts`

**Assessment:** If `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` are unset, `getLeadLimiter()` returns `null` and rate limiting is silently skipped (`if (limiter) { ... }`). This means in environments where Upstash is not configured (local dev, staging), the lead form has **no rate limiting**, making it susceptible to spam/abuse.

**Remediation:** Add a warning log when limiter is null, and consider a simple in-memory fallback rate limiter for non-production environments. Or document clearly that Upstash env vars are required for production deployment.

---

### 9. CI/CD

**File:** `.github/workflows/ci.yml`

#### FINDING 9-A — GitHub Actions use tag-pinned actions (not SHA-pinned)

**Severity:** Low
**OWASP:** A06:2021 — Vulnerable and Outdated Components
**CWE:** CWE-494 — Download of Code Without Integrity Check
**File:** `.github/workflows/ci.yml:9-10`

**Evidence:**

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
```

**Assessment:** Using `@v4` tag instead of commit SHA (`@a5ac7e51b41094c92402da3b24376905380afc29`) means a compromised or updated tag could execute malicious code in CI. For a private project with no secrets in CI (no `SUPABASE_SERVICE_ROLE_KEY` in CI env), impact is lower. The CI workflow only runs lint, tsc, and build.

**Remediation:**

```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
- uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
```

#### FINDING 9-B — No `permissions:` block in workflow

**Severity:** Low
**OWASP:** A01:2021 — Broken Access Control
**File:** `.github/workflows/ci.yml`

**Assessment:** Without an explicit `permissions:` block, the job inherits default repository permissions (`contents: read` for public repos, potentially `write` for private repos depending on org settings). Best practice is to declare minimal permissions explicitly.

**Remediation:**

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
```

#### ✅ No `pull_request_target` misuse found.

#### ✅ No secrets in CI environment (no `SUPABASE_SERVICE_ROLE_KEY` etc. in workflow env).

---

### 10. Error Handling

✅ No empty `catch {}` blocks found.
✅ No stack traces returned to API callers found.
✅ No `NODE_ENV` gating of debug output found (no debug output exists).

**One `console.error` found:**

```typescript
// src/components/lead-form/lead-form-actions.ts:68
sendLeadNotification({ ... }).catch((e) => console.error("[resend]", e));
```

**Assessment:** Logs Resend errors server-side. The error object `e` may contain API response details but not user PII or secrets. Acceptable for operational visibility. In production (Vercel), logs are only accessible to the team. ✅ No concern.

---

### 11. Logging & PII

✅ No `console.log` calls found in source files (only `console.error` for the Resend failure above).
✅ No JWT token logging found.
✅ No user password logging found.
✅ Lead data (name, email, phone) is inserted via Zod-validated server action — not logged to console.

---

## Coverage

| Category       | Details                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| Files scanned  | 32 TypeScript/TSX source files                                                 |
| SQL migrations | 8 migration files                                                              |
| Config files   | `next.config.ts`, `package.json`, `.gitignore`, `.env.local.example`, `ci.yml` |
| Skipped        | `node_modules/`, `.next/`, `.git/`, `dist/`, `build/`                          |
| Secret scan    | All `.ts`, `.tsx`, `.js`, `.json`, `.md` files in repo (excl. node_modules)    |
| Git history    | `.env.local` checked — not in git history                                      |
| npm audit      | Ran `npm audit --json` — 2 moderate, 0 high, 0 critical                        |

---

## Verdict

**NEEDS_FIXES**

No critical vulnerabilities. Two high-severity findings require action before launching authenticated routes (FASE 1B):

1. Add `import 'server-only'` to `src/lib/supabase/server.ts` (5-minute fix)
2. Add HSTS and CSP headers to `next.config.ts` (30-minute fix)
3. Verify migration 003b is always applied after 003 in all environments
4. Fix `.gitignore` to allow `.env.example` to be tracked by git

The codebase shows security-conscious patterns: Zod validation, Turnstile CAPTCHA, Upstash rate limiting, RLS on all 7 FASE 1A tables, `gen_random_uuid()` for IDs, no raw SQL, proper `app_metadata` role claim path (post-fix). The remaining gaps are defense-in-depth improvements, not blocking exploitable vulnerabilities in the current FASE 0/1A scope.
