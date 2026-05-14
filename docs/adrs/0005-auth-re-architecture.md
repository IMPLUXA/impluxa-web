# ADR-0005: Auth re-architecture — claim-based session + custom token hook

- **Status:** Accepted
- **Date:** 2026-05-14
- **Deciders:** Pablo (founder) + Lord Claude + consejo del arsenal (Security Engineer + Backend Architect + Database Optimizer + Senior PM)
- **Context tag:** v0.2.5 Auth Blindado Multi-Tenant, FR-AUTH-1..7
- **Supersedes:** ADR-0004 (cookie-based session — still in force, _extended_ not replaced)
- **Amends:** ADR-0003 (RLS split policies — now claim-aware via v2 RESTRICTIVE shadow)

## Context

v0.1 of Impluxa had a single tenant (Hakuna). Auth lived in two places: Supabase cookies for the operator's own dashboard and a `tenant_members` membership row for RLS. The path was `auth.uid()` → `EXISTS(tenant_members WHERE user_id = auth.uid() AND tenant_id = sites.tenant_id)`. That works when every authenticated user is associated with exactly one tenant in practice.

For v0.2.5 we have to onboard users who legitimately belong to **more than one** tenant: an agency editor who manages three event sites, an internal operator who needs to act on behalf of any tenant for support, a partner who has an admin role in their own tenant and an editor role in a peer's. The pre-v0.2.5 RLS predicate gives them access to all of their tenants simultaneously — that is a _confused deputy_ vulnerability (T-v025-02 in the threat model): the deputy (the DB) trusts the principal's identity but not the principal's _intent_.

We also need:

- **A way for the user to declare "I am acting as tenant A right now"** that the DB can trust (not a client-controlled header).
- **Cross-domain cookie hygiene.** When a user visits a tenant subdomain (`hakuna.impluxa.com`) the operator's session cookie (`sb-*-auth-token` scoped to `.impluxa.com`) leaks to the rendered page. A site-template bug or a stored XSS becomes an account-takeover vector (T-v025-01).
- **Defense-in-depth against hook failure.** If the Supabase Custom Access Token Hook fails open, a logged-in user with multi-tenant membership ends up with a JWT _without_ the active-tenant claim. The pre-v0.2.5 predicate would happily return all rows (claim absent = no filter).
- **A break-glass off-switch** for the entire auth-claim apparatus, in case the hook or the helper functions misbehave on day-one in prod and we need to revert _fast_ without redeploying.

## Decision

The auth re-architecture is built from five interlocking components. The thread holding them together is one new claim on the access token: `active_tenant_id`.

### 1. `user_session_state` — the source of truth for active tenant

A new table `public.user_session_state(user_id PK, active_tenant_id, updated_at)` holds, for each user, which tenant they are currently acting as. The app writes it via a server action `/api/session/switch-tenant` (W3.G5). Inserts default to the user's first membership (backfill in W2.T1 migration). RLS: a user reads/writes only their own row.

### 2. `current_active_tenant()` SQL helper

```sql
create or replace function public.current_active_tenant()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'active_tenant_id', '')::uuid
$$;
```

A single, audited entry point that every RLS policy uses to ask "which tenant is this principal acting as?" — keeping the predicate readable and the implementation swap-friendly.

### 3. Custom Access Token Hook (Supabase Auth)

A Postgres function `public.custom_access_token_hook(event jsonb)` runs at token-issue time. It reads `user_session_state.active_tenant_id` for the user, validates the user has a `tenant_members` row for that tenant (defense in depth), and adds `active_tenant_id` to the JWT custom claims. **Fail-closed semantics (D20):** if the row is missing, the hook returns an empty claim (NOT the user's first membership) and the v2 RLS policies deny access. The user is forced to call `/api/session/switch-tenant` to recover. Better to break a multi-tenant user than to silently grant access to the wrong tenant.

### 4. RLS v2 RESTRICTIVE shadow policies

For every tenant-owned table (`sites`, `leads_tenant`, `subscriptions`, `activity_log`) we ADD `*_member_<verb>_v2` policies declared as `RESTRICTIVE`, AND'd with the existing v1 PERMISSIVE policies. The predicate is `tenant_id = current_active_tenant() AND EXISTS(tenant_members WHERE user_id = auth.uid() AND tenant_id = self.tenant_id)`. SE-H2 from the W2 review: v2 must be RESTRICTIVE so that both v1 and v2 must pass — otherwise a confused-deputy attack survives by passing v1 alone. v1 PERMISSIVE stays as backward-compat ceiling until v0.2.6 burns it.

`sites` is special: it has a _public read_ contract (anonymous visitors viewing a published tenant's site). The SELECT v2 policy preserves that branch explicitly (round 3 fix SE-R3: `OR tenant_id IN (SELECT id FROM tenants WHERE status = 'published')`); write verbs do NOT preserve the public branch — public read does not imply public write.

### 5. `APPROVAL_GATE_ENABLED` kill switch

A Vercel env var read at edge/middleware that, when set to `0`, disables the active-tenant enforcement at the application layer (route handlers + middleware skip claim validation; v1 RLS still applies). The DB-layer v2 RESTRICTIVE policies stay on — they fail-closed without the claim — so this is _not_ a full revert, but it removes the app surface that depends on hook output, which is enough to restore prod operability while we debug. The break-glass IP fix originally proposed (CONTEXT.md D17) was descoped (rationale: probability low in cohort 1; alternative viable). Kill switch is the surviving mitigation.

### 6. Per-host cookie strip in proxy (W3.G7, FR-AUTH-1)

The Vercel rewriter / middleware on tenant-host requests (`*.impluxa.com` except `app.`, `admin.`, `auth.`) drops `sb-*` cookies before forwarding to the render. The operator session never crosses into rendered tenant content. T-v025-01 mitigated.

## Consequences

### Positive

- **Confused-deputy attack closed.** Even an editor with membership in 3 tenants can only read/write within the one they declared active. The DB enforces it; the app cannot bypass it.
- **Operator session is structurally invisible on tenant-rendered pages.** Stored XSS in a tenant template cannot exfiltrate `sb-*` cookies because they were never sent.
- **Auth state is now a _capability_, not just an identity.** "Who you are" (sub) and "what you're doing now" (active_tenant_id) are separate dimensions. Future v0.3 features (impersonation, scoped delegation, support-mode) extend the claim namespace without re-architecting.
- **Day-one rollback is one env var.** APPROVAL_GATE_ENABLED=0 stops the application-layer dependency on the hook within seconds. Prod stays usable while we patch.
- **Two-layer defense in depth.** App-layer guards + DB-layer RESTRICTIVE policies. A bug in either is caught by the other.

### Negative

- **Custom Access Token Hook is a new failure mode.** A Postgres exception in the hook fails token issuance for _all_ users, not just multi-tenant ones. Mitigated by D20 fail-closed semantics + W4.T7 healthcheck.
- **Tenant-switch is now a network roundtrip + token refresh.** The user clicks "switch tenant", we update `user_session_state`, then call `auth.refreshSession()` to mint a new access token with the updated claim. Latency budget: ~300ms 95th p. Acceptable for a deliberate user action.
- **Two policy layers per table for 1-2 releases** (v1 PERMISSIVE + v2 RESTRICTIVE). Verbose `\d+ sites`. Burned in v0.2.6 after 24h prod validation.
- **The `jose` library lands in the dependency tree** (W1.T4) to mint test JWTs and to verify hook output. ~20KB, audited, OK.

### Neutral / trade-offs

- **v2 policies use `EXISTS(tenant_members)` twice** (once for active-tenant membership, once preserved via v1 for general membership). Index `tenant_members(user_id, tenant_id)` keeps both sub-lookups cheap.
- **The kill switch is _app-layer only._** It does not bypass v2 RESTRICTIVE — users without a valid `active_tenant_id` claim cannot read tenant rows even with APPROVAL_GATE_ENABLED=0. This is intentional: the DB stays safe; the app stays available for `/health`, `/api/session/switch-tenant`, and operator-mode flows.

## Alternatives considered

- **Header-based active-tenant (`X-Acting-Tenant: <uuid>`).** Rejected outright: client-controlled, trivially forgeable, never reaches the DB. The whole point of the claim is to anchor it in the access token the auth server signed.
- **One tenant_id per user account (split a multi-tenant user into N accounts).** Rejected: agency editors and internal operators legitimately need a single identity that spans tenants; forcing N accounts pushes the confused-deputy problem into the user's password manager and ruins audit linkage.
- **Drop v1, ship v2 alone.** Rejected for v0.2.5 cutover: a regression in v2 cuts every authenticated user off from every tenant. v1 stays as a ceiling for 24h validation post-merge. v0.2.6 burns it.
- **No kill switch (trust the hook).** Rejected after the Workflow Architect risk review: probability of a day-one hook bug in a brand-new code path is high; the cost of being unable to revert is unbounded.
- **Break-glass IP allowlist** (CONTEXT.md D17 original proposal). Descoped: low probability in cohort 1, kill switch covers the same surface, dashboards (Supabase/Vercel/Cloudflare) do not depend on the approval gate.
- **HMAC-signed claim instead of trusting Supabase's signature.** Rejected for v0.2.5: Supabase's RS256 signature already binds the claim to the token. Adding HMAC would mean re-signing in our app, which means key management in our app, which is a regression in operational surface.

## Implementation references

- `supabase/migrations/20260514_v025_001_user_session_state.sql` (table + backfill, D1)
- `supabase/migrations/20260514_v025_002_helpers.sql` (`current_active_tenant()`, D5/D20)
- `supabase/migrations/20260514_v025_003_custom_access_token_hook.sql` (hook function, D5/D20)
- `supabase/migrations/20260514_v025_004_rls_claim_based_v2.sql` (v2 RESTRICTIVE policies, D1/FR-AUTH-5, round 3 sites_public_read_published preserved)
- `src/lib/auth/safe-redirect.ts` (W1.T5 Parte A, mitiga T-v025-08 open-redirect)
- `src/lib/runtime-config.ts` (W1.T5 Parte B, env guard module-load)
- `tests/integration/rls-claim-isolation.test.ts` (commit `5cf8866`, W4.T4, FR-AUTH-5)
- `docs/adrs/0006-audit-log-access-control.md` + `docs/adrs/0007-audit-log-hash-chain.md` (companion: audit trail uses the claim too)

## Verification

- `tests/integration/rls-claim-isolation.test.ts` passes against preview branch with hook enabled: editor with claim=A reads only A; without claim reads nothing; outsider with forged claim reads nothing.
- `tests/integration/audit-log-hash-chain.test.ts` proves the audit trail also reflects the claim — `acting_as_tenant_id` is set from `current_active_tenant()` server-side, not from app input.
- W4.T7 (pending): `/api/health/hook` endpoint asserts `custom_access_token_hook` returns the expected shape; alarms if absent claim on a known-multi-tenant test user.
- Manual smoketest (W2.T5 round 3): 3 `append_audit` calls produce CHAIN_OK; chain breaks on out-of-band UPDATE.

## When to revisit

- **v0.2.6: burn v1 PERMISSIVE policies** after 24h of prod observability with v2 RESTRICTIVE active. ADR-0005 v1.1 will record the cutover date.
- **v0.3: introduce scoped delegation** (impersonation, support-mode). The claim namespace extends with `acting_on_behalf_of_user_id`; v2 predicates AND-in a delegation check.
- **If the hook becomes a hot path** (>100ms p95 token-mint): cache `user_session_state` row in Postgres `auth.users.raw_app_meta_data` and let the hook read from there. Trade-off: meta sync becomes a new failure mode.
- **If tenants demand customer-managed identity providers** (SSO/SAML/OIDC per tenant): claim namespace extends with `idp_tenant_id`; the hook fans out IdP-specific claim assembly. Documented in W3.G2 SSO.
- **If multi-region prod requires per-region claim assembly**: hook function becomes region-aware; user_session_state is replicated; ADR-0005 v2 captures the consistency model.
