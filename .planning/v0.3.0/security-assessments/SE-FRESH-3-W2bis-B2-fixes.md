# SE FRESH #3 — W2.bis-B2-SENTRY-RUNTIME-CAPTURE-FIX

**Fecha**: 2026-05-24
**Sesion**: Squad T2 reconvene fresh (anchor-free vs SEs `ae4e43c312d11048f` + `a57b85d6a689c92a5`)
**Branch**: feature/sentry-verify-b2
**Project**: impluxa-web (Next.js 16.2.6 + Sentry SDK 10.53.1 + Turbopack PROD)
**hakuna_live**: false

---

## Pre-empirical-check security-side (lesson 3er uso aplicado)

**Empirico leido disco** (NO asumido):

1. `src/middleware.ts` (95 lineas):
   - Imports: `next-intl` middleware + `getMonitoringLimiter` (Upstash)
   - `guardMonitoring()`: rate-limits `/monitoring` (Sentry tunnel) por IP
   - Host-based routing: marketing / app / admin / tenant rewrites
   - SHARED_ROOT regex incluye `/api` → `NextResponse.next()` pass-through
   - `MARKETING_HOSTS` Set hardcoded
   - **NO contiene auth/RLS logic** — auth vive en Supabase + route handlers
   - **NO contiene session/cookie gates**
   - Matcher: `/((?!_next/static|_next/image|favicon.ico|api/health).*)` — corre en TODA request salvo static

2. `src/app/api/sentry-verify-b2/route.ts`:
   - `runtime = "nodejs"` declarado
   - Throws single Error con marker `SENTRY_VERIFY_D5_20260524T1909Z_NODEJS_RUNTIME`
   - B2.S2 empirico confirmo: route corre EDGE pese a declaracion (middleware intercepta y/o Next.js 16 ignora export)

**Hallazgo critico**: middleware.ts **NO es auth gate**. Es:

- Tunnel rate-limiting (Sentry monitoring proxy)
- Locale routing (next-intl)
- Multi-tenant host rewrites

Blast radius migracion middleware → proxy es **CONTENIDO** (no toca auth). Pero **rate-limit logic `/monitoring`** es Sentry-critical: si proxy migration rompe interception, tunnel quota explota.

---

## Tabla per fix

| Dimension                   | Fix1 middleware→proxy                                                                                                                                                                                                                              | Fix2 Sentry edge pattern (try/catch + captureException)                                                                     | Fix3 hybrid                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Blast radius**            | MEDIO. middleware.ts = locale + host rewrites + Sentry tunnel rate-limit. NO auth. Migration rompe matcher = TODAS las rutas afectadas (404/wrong-rewrite). **Riesgo Sentry tunnel quota**: si `guardMonitoring()` no se ejecuta = sin rate-limit. | BAJO. Per-route-handler. Solo route(s) edge afectados.                                                                      | MEDIO-ALTO. Multi-archivo: middleware + route handlers. |
| **Rollback tiempo**         | ~30-45s git revert + vercel deploy. Califica Sec 2.c.                                                                                                                                                                                              | ~30s git revert single file + redeploy. Califica Sec 2.c.                                                                   | ~45s revert multiple + redeploy. Califica Sec 2.c.      |
| **Supply chain risk**       | ZERO. Rename function `middleware` → `proxy` + export. Cero deps.                                                                                                                                                                                  | ZERO. Sentry SDK ya instalado.                                                                                              | ZERO.                                                   |
| **Categoria autonomia**     | **T2.d con caveat scope wider** — Two-Pass extended REQUERIDO (Sec 8). NO toca auth → no escala T3/T4. PERO si proxy migration cambia matcher semantica → verify ALL routes pre-deploy.                                                            | **T2.d clean** — local change, scope contained, hakuna_live=false.                                                          | T2.d con Two-Pass extended REQUERIDO.                   |
| **Verify security pre-fix** | (a) Confirm `proxy` Next.js 16 conserva matcher semantics (context7 Next.js docs). (b) Verify `guardMonitoring()` sigue ejecutandose post-rename (Sentry tunnel rate-limit critico para quota). (c) Verify locale routing intact.                  | Confirm Sentry SDK 10.x exporta `captureException` en edge runtime (context7 quick) + flush() comportamiento async en edge. | Combina (a)+(b)+(c) Fix1 + verify Fix2.                 |

---

## Sentinel commands lista

Esperados durante ejecucion fix (todos categoria AUTO-ALLOW per allowlist-categorias-security-engineer):

- `git mv src/middleware.ts src/proxy.ts` (solo Fix1) — AUTO-ALLOW
- `git add src/middleware.ts src/proxy.ts src/app/api/**/route.ts` — AUTO-ALLOW
- `git commit -m "..."` en feature branch — AUTO-ALLOW
- `git push origin feature/sentry-verify-b2` — AUTO-ALLOW
- `vercel deploy --prebuilt` o auto-deploy via push — AUTO-ALLOW (preview)
- `vercel deploy --prod` SOLO en Sec 2.d merge → main — branch-protection-main.sh exige flag activa

**NO esperados** (si aparecen = anomalia, ABORT):

- `npm install`, `pnpm add`, `yarn add` (Supply chain — none of these fixes require)
- `vercel env add/rm` (Secrets — none required)
- `git push --force`, `git reset --hard` — gravedad #21 ASK CEO

---

## Secrets rotation YES/NO

**NO rotation requerida** por ningun fix. SENTRY_DSN, SENTRY_AUTH_TOKEN, NEXT_PUBLIC_SENTRY_DSN intactos.

**Caveat verify**: confirmar Sentry probes futuras NO loguean DSN en payload de exception (DSN no es secret rotable critical pero best practice no logear). Inspeccionar `Sentry.init` config no incluya `beforeSend` que dumpee env.

---

## ASK CEO triggers explicit

Ningun fix gatilla ASK CEO **bajo hakuna_live=false** + Sec 2.d.

**Triggers si aparecen mid-fix**:

- Si Fix1 verify revela middleware **SI contiene auth/RLS gate inadvertido** (no caso actual, pero check empirico obligatorio) → escalate T3/T4 ASK CEO.
- Si Fix2 requiere editar `instrumentation.ts` o `sentry.edge.config.ts` con cambios non-trivial config → Two-Pass extended + considerar ASK CEO si pattern cambio global SDK.
- Si en exploracion aparece necesidad rotate Sentry DSN o auth token → ASK CEO obligatorio (Sec 3 secrets).

---

## Pre-autorizacion fallback chain explicit (lesson formalizada aplicada)

**Recomendacion**:

```
Fix1 SHIPPED (proxy migration + captureRequestError funciona) → cleanup verify route → merge.
Fix1 FAIL (proxy no captura, o rompe matcher) → revert Fix1 → aplicar Fix2 sin re-ASK CEO.
Fix2 SHIPPED → cleanup + merge.
Fix2 FAIL → ASK CEO con evidencia ambos fixes intentados.
Fix3 NO pre-autorizado — wider scope, requires re-Squad si llegamos aqui.
```

**Condicion para pre-autorizacion**:

1. Ambos fixes T2.d misma categoria autonomia.
2. Decision tree binary determinístico (SHIPPED/FAIL via Sentry dashboard event count query).
3. Rollback bajo 60s en ambos (Sec 2.c).
4. NO cambian auth/secrets/RLS en ningun caso.

---

## Failing-securely default

Si **cualquier verify pre-fix** detecta:

- middleware contiene auth logic no documentada → ABORT + ASK CEO.
- Sentry SDK 10.x NO soporta `captureException` standalone edge → ABORT Fix2 → Fix1 unico path → si Fix1 FAIL → ASK CEO.
- Matcher semantica cambia entre `middleware` y `proxy` exports en Next.js 16 → ABORT Fix1 → Fix2 unico path.
- Cualquier ambiguity branch imprevista → ASK CEO (Sec 2 failing-securely default).

---

## Veredicto literal

**recomendamos proceder con fix #2 (Sentry edge capture pattern: try/catch + manual Sentry.captureException + flush) como primer intento**.

**Razones**:

1. Blast radius MINIMO (per-route handler, NO toca middleware critical-path con tunnel rate-limit + locale + multi-tenant).
2. Rollback ~30s single file revert.
3. Cero supply chain change.
4. T2.d clean sin caveats — califica Sec 2.d hakuna_live=false sin requerir Two-Pass extended obligatorio (recomendado pero no exigido).
5. Pattern documentado canonical Sentry SDK para edge runtime.
6. Si exitoso, applica como pattern reusable para futuros route handlers edge (mitigacion DRY: extraer helper `withSentryEdge(handler)`).

**Si Fix2 FAIL** (Sentry dashboard query 0 events post-deploy + retry): pre-autorizado fallback a **Fix1 (middleware → proxy migration)** bajo CONDICION:

- Pre-fix verify Fix1 #a/#b/#c PASS (matcher semantics + guardMonitoring intact + locale intact).
- Si cualquier verify FAIL → ABORT + ASK CEO (no fallback ciego Fix1).

**Fix3 NO pre-autorizado**: si llegamos aqui, re-Squad fresh con evidencia ambos fixes fallidos.

---

**Recomendamos proceder con fix #2.**
