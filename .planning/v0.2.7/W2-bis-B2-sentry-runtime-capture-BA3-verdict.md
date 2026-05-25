# Backend Architect #3 FRESH — W2.bis-B2 verdict

**Date**: 2026-05-24
**Squad role**: Backend Architect (3rd reconvene, fresh capacity)
**Scope**: analysis-only, NO mutation

## Archivos leidos empirico

1. `D:\impluxa-web\src\middleware.ts` (95 lines, intl + tenant routing + monitoring guard)
2. `D:\impluxa-web\instrumentation.ts` (35 lines, register() + onRequestError wrapper with flush(2000))
3. `D:\impluxa-web\src\app\api\sentry-verify-b2\route.ts` (13 lines, `runtime="nodejs"` + throw)
4. `D:\impluxa-web\sentry.edge.config.ts` (20 lines, Sentry.init clean)
5. `D:\impluxa-web\next.config.ts` (74 lines, withSentryConfig + tunnelRoute "/monitoring")

## Synthesis root cause refined

- Middleware matcher INCLUDES `/api/sentry-verify-b2` (only excludes `_next/static|_next/image|favicon.ico|api/health`).
- Middleware short-circuits `/api/*` via SHARED_ROOT regex + `NextResponse.next()` — but **the middleware itself ran edge** before passing through (Next.js 16 middleware = edge by default).
- Vercel logs show ε (edge) for route execution — this may mean (A) route-level `runtime="nodejs"` was overridden by middleware edge context, OR (B) ε is the middleware dispatcher and the actual lambda IS nodejs.
- `REGISTER_INVOKED_NEXT_RUNTIME` probe value from edge invocation would disambiguate (`edge` = (A) confirmed; `nodejs` = (B) confirmed).
- Edge config loaded (probe fired) → SDK initialized. Capture path is the failure: `onRequestError` is documented for **server** runtimes; edge needs **manual `Sentry.captureException` in try/catch** per Sentry docs.

## Tabla candidatos

| #   | Fix                                                                                       | Hipotesis                                                   | Mutation                                                                            | T-class | Costo    | Riesgo                                                                                                                 | Verify empirico pre-fix                                          | Rollback                 |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------- | -------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------ |
| 1a  | Migrate `middleware.ts` → `proxy.ts` (nodejs)                                             | Eliminates edge context infection of downstream routes      | Rename + minor API delta (proxy is nodejs-only, no per-route runtime export needed) | T2      | 45-90min | MEDIO: breaking change to monitoring guard rate-limit (Upstash Redis works both runtimes; verify), CSP unchanged       | grep matcher behavior parity; test on preview                    | git revert single commit |
| 1b  | Exclude `/api/sentry-verify-b2` from middleware matcher                                   | Route bypasses middleware entirely → runtime export honored | Add path to matcher negative lookahead                                              | T2      | 10min    | BAJO: only excludes verify route; rest of API still goes through middleware (current SHARED_ROOT short-circuit anyway) | grep middleware matcher; deploy + check probe NEXT_RUNTIME value | git revert               |
| 1c  | Confirm middleware does NOT intercept (test only)                                         | Maybe ε is dispatcher, lambda is nodejs                     | Zero mutation — read probe NEXT_RUNTIME from existing deploy logs                   | T1      | 5min     | NULO                                                                                                                   | Vercel logs CLI query REGISTER_INVOKED log line                  | N/A                      |
| 2   | Replace `onRequestError` with manual try/catch + `Sentry.captureException` per edge route | Edge runtime needs explicit capture per Sentry docs         | Either wrapper helper `withSentryEdgeCapture()` OR inline try/catch in verify route | T2      | 30-60min | BAJO: additive, doesn't break nodejs routes                                                                            | confirm via probe whether route runs edge (Fix1c result)         | git revert               |
| 3   | Hybrid runtime + Sentry pattern per runtime                                               | Some edge (manual capture), some nodejs (onRequestError)    | Decide per-route runtime + matching capture pattern                                 | T2      | 2-3h     | MEDIO: requires inventory of all routes, doc'd convention, future maintenance burden                                   | full audit `src/app/api/**/route.ts` runtime exports             | per-route revert         |

## Recomendacion firme ordenada

**Recomendamos proceder con fix #1c PRIMERO (read-only diagnostic), encadenado a fix #1b o #2 segun resultado.**

Justificación:

- Fix #1c costs 5min, zero mutation, **disambiguates the root cause** before committing to architectural fix.
- Si `NEXT_RUNTIME=edge` en register() probe → route IS running edge → apply **fix #2** (manual capture pattern) for the verify route, OR fix #1b (exclude from middleware) to force nodejs path.
- Si `NEXT_RUNTIME=nodejs` en register() probe → lambda IS nodejs (ε was middleware dispatcher) → root cause is elsewhere (likely `onRequestError` not firing for thrown errors that auto-respond 500 without reaching the handler return path; or flush() not awaited correctly under Turbopack). Need different diagnostic.

**Fallback chain explicit pre-autorizado (binary deterministic):**

- IF Fix #1c reveals `NEXT_RUNTIME=edge` → apply **Fix #1b** (single-line matcher exclusion, lowest blast radius; route goes nodejs honoring its export; `onRequestError` should work).
- IF Fix #1b SHIPPED but events still 0 → apply **Fix #2** (manual capture in route handler; bypasses `onRequestError` entirely).
- IF Fix #1c reveals `NEXT_RUNTIME=nodejs` → ASK CEO with new hypothesis space (this is unexplored territory: `onRequestError` not capturing thrown errors in nodejs Next.js 16 + Turbopack).

NOT recommended: Fix #1a (full migration to proxy.ts) — too high blast radius for a verify-only diagnostic; defer to architectural cleanup post-B2 SHIPPED.

NOT recommended: Fix #3 (hybrid per-runtime) — premature; need empirical confirmation of which runtime is the actual problem first.

## Variance budget per fix

- Fix #1c: 5min nominal × 5x = 25min hard ceiling (Vercel logs query latency variance)
- Fix #1b: 10min nominal × 5x = 50min hard ceiling (deploy + probe verification)
- Fix #2: 30min nominal × 5x = 2h30min hard ceiling (write wrapper + verify edge route)
- **Cumulative budget**: #1c + #1b + #2 = ~3h25min hard ceiling — within CEO's 4h ceiling, leaves ~35min buffer for cleanup.

## Abort criteria

- Fix #1c result inconclusive (probe didn't log) → ASK CEO (instrumentation hypothesis itself is broken).
- Fix #1b shipped + still 0 events + Fix #2 shipped + still 0 events → ASK CEO (Sentry transport / project DSN / quota issue, not runtime issue).
- Cumulative time > 3h30min without B2 SHIPPED → ASK CEO for go/no-go on deferring B2 to next session.

## Veredicto literal

**Recomendamos proceder con fix #1c (read-only diagnostic) inmediato, con fallback chain pre-autorizado Fix #1b → Fix #2 segun resultado empirico.**

No hedges. Empirical-disambiguation-first respects pre-empirical-check (3er uso post-codificacion) and avoids committing to architectural fix without root-cause confirmation.
