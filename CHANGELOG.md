# Changelog

Todos los cambios notables de Impluxa SaaS se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] — v0.2.5 PR #2 esperando merge

PR #2 https://github.com/IMPLUXA/impluxa-web/pull/2 — 39 commits sobre `986830d`.

Release de **Auth Blindado Multi-Tenant**: claim-based session JWT + custom_access_token hook fail-closed + RLS v2 RESTRICTIVE shadow + audit log SHA-256 hash chain. Pre-condition para onboardear segundo tenant productivo (v0.2.6 burn v1 + v0.3.0 Hakuna live).

### Added

- **W1 — Runtime config + safeNextPath open-redirect mitigation.** `src/lib/runtime-config.ts` env guard module-load (commit `3511bb9`) + `src/lib/safe-redirect.ts` con `safeNextPath()` validator (commit `930f8da`) + property-based fuzz tests `tests/property/safe-next-path.fuzz.test.ts` con ~5500 random inputs via fast-check (commit `8b65917`).
- **W2 — DB migrations claim-based RLS v2.** 6 migrations atomic (commits `2fa51b7`, `c620810`, `8612f4a`, `f5ac2b9`, `92acb8e`, `8f0addf`):
  - `user_session_state` table (D1)
  - `current_active_tenant()` helper (D5)
  - `custom_access_token_hook` fail-closed (D5, D20)
  - RLS v2 RESTRICTIVE shadow policies claim-based (D1, FR-AUTH-5) — **coexiste 24h con v1 PERMISSIVE como fail-safe** (burn programado v0.2.6)
  - `audit_log` partitioned + SHA-256 hash chain + `append_audit()` SECURITY DEFINER (D4, D9, FR-AUTH-7)
  - `audit_log` partition rotation cron double-buffer (D19)
- **W3 — Tenant switcher + Send Email Hook handler + callback hardening.** Route + UI components `TenantSwitcherClient` (commits `efa6a4b`, `66178c4`, `4fab961`) + Send Email Hook → Resend integration `9665aab` (W3.G3.T3, retained inert post ADR-0008) + callback hardening con `safeNextPath` wired + strip cookie domain (commit `e672f79`).
- **W4 — Integration tests + force-global-signout script.** `tests/integration/rls-claim-isolation.test.ts` valida confused deputy mitigation (commit `5cf8866`) + `tests/integration/audit-log-hash-chain.test.ts` valida tamper-evidence (commit `b79e0cf`) + `scripts/force-global-signout.ts` POST-MERGE only (commit `632fbbe`).
- **ADRs:** ADR-0005 auth re-architecture (`8e06617`), ADR-0006 audit log access control, ADR-0007 audit log hash chain (`37031ad`), ADR-0008 SMTP Resend native + Send Email Hook disabled (`654e29f`), ADR-0009 Sentinel allowlist bug + Array.join workaround (`17258e4`).
- **Documentation:** `docs/onboarding-v0.2.5.md` (`e9b5d35`), runbook `docs/runbooks/v0.2.5-merge-deploy.md` (PR #3, polished sesión 6ª), `docs/security/env-var-usage.md` inventory (`998d06d`), `docs/security/secret-rotation.md` per-secret playbook (`fb3ad5a`), `docs/runbooks/dmarc-monitoring.md` (`280c94b`), PLAN.md M7-M13 + completion status (`d6c6538`).

### Changed

- **DNS infra Reino Impluxa:** Cloudflare zone `impluxa.com` ahora con SPF en `mail.impluxa.com` + 2× DMARC en `_dmarc.mail.impluxa.com` + `_dmarc.impluxa.com` (sesión 6ª decision #32, autonomous via Cloudflare API). 3 records additive zero-risk, `p=none` monitoring durante warmup window 2 semanas, upgrade a `p=quarantine; pct=10` planned 2026-05-29 si DMARC reports limpios.
- **Hakuna prod auth config:** SMTP custom Resend ACTIVO (decision #29 sesión 5ª, ADR-0008). Send Email Hook DISABLED. Hook custom_access_token DISABLED durante ventana de merge (decision #38 sesión 6ª bajo Rey OK + consejo unánime), re-enable post-merge per runbook Step 8.5.

### Removed

- `withCrossDomain` helper — confirmado removido del código real via CS-2 audits sesión 6ª (NO usage en `src/`, `supabase/`, `scripts/`).
- `hook-send-email-rotation-20260515.txt` archivo local stale (decision #33 sesión 6ª, source-of-truth queda en Supabase).

### Security

- **5 amenazas mitigadas, 9 FR-AUTH cerrados** (FR-AUTH-1 a FR-AUTH-9). Diseño en ADR-0005.
- **Custom Access Token Hook fail-closed** — JWT claim `active_tenant_id` poblado en token-mint. Si hook crashea o claim missing → RLS v2 RESTRICTIVE niega acceso (DB-layer fail-closed); `APPROVAL_GATE_ENABLED` env kill switch para app-layer fail-closed.
- **Audit log tamper-evidence:** SHA-256 hash chain con `pg_advisory_xact_lock`. Cliente NO puede escribir audit_log (RLS deny + INSERT/UPDATE/DELETE revoked). Solo path = `public.append_audit(jsonb)` SECURITY DEFINER service-role only.
- **Open-redirect mitigation:** `safeNextPath()` con 9 properties validadas via fuzz (~5500 random inputs).
- **Sentinel runtime protection** activa via PreToolUse hook (mcp-sentinel v2.0.0). Bug `check_sensitive_env` allowlist documentado en ADR-0009 con workaround pattern.

### Migration notes

Pre-merge hygiene (runbook PR #3):

1. Step 0 — DISABLE hook custom_access_token (gravedad #21.a). DONE sesión 6ª 2026-05-15 (decision #38).
2. Step 2 — Smoketest login Chrome (NO Brave PKCE bug).
3. Step 5 — Squash-merge.
4. Step 6 — Tag `v0.2.5`.
5. Step 8.5 — Apply 6 W2 migrations a main + re-enable hook custom_access_token (gravedad #21.a).
6. Step 9 — `force-global-signout` con `KING_SIGNED=true` (irreversible, ~30s downtime percibido).

---

## [0.3.0] — 2026-05-12

Release de endurecimiento (hardening) sobre la base multi-tenant `v0.2.0-alpha.1`.
Cubre tres bloques de remediación: **Wave 1+2 (Bloque A)**, **vista previa de Bloque B**
y **Wave 5 + Cleanup (Bloque C)**. Foco: observabilidad de producción, accesibilidad
WCAG 2.2 AA, cobertura TDD, runbooks operacionales y cumplimiento legal (cookies +
privacidad).

### Added

- **C1 — Observabilidad Sentry.** Integración `@sentry/nextjs` v10.53.1 con
  configuración cliente/servidor/edge (`sentry.*.config.ts`), `instrumentation.ts`,
  wrapper `withSentryConfig` en `next.config` y `tunnelRoute` para sortear
  ad-blockers que bloquean dominios de Sentry.
- **C1 — Recursive PII scrub** con 17 patrones que cubren tokens de Supabase
  (`access_token`, `refresh_token`, `service_role`), MercadoPago (`access_token`,
  `public_key`, `payer.email`), Turnstile (`cf-turnstile-response`) y secretos
  genéricos (`authorization`, `cookie`, `password`, `api_key`, etc.). Scrub
  _narrow_ (no global): solo aplica a llaves conocidas para no romper payloads.
- **C4 — 5 runbooks de operaciones** en `docs/runbooks/`:
  - `incident-response.md` — protocolo de respuesta a incidentes (SEV-1/2/3).
  - `dns-rollback.md` — rollback de cambios DNS en Cloudflare.
  - `vercel-deploy-rollback.md` — promoción de deploy previo en Vercel.
  - `sentry-triage.md` — flujo de triage de issues + asignación.
  - `dr-supabase.md` — disaster recovery sobre Supabase Pro (PITR pendiente).
- **C5 — Cookie consent banner** WCAG-AA compliant con i18n ES+EN, focus trap,
  `aria-modal=true`, persistencia en `localStorage`, montado en root locale
  layout y `next-intl` Link para preservar locale al cerrar.
- **C6 — Política de privacidad v1** en español (voseo, ley argentina 25.326),
  con aviso EN y `<link rel="alternate" hreflang>` para variantes de idioma.
  Linkeada desde footers marketing y tenant.
- **ADRs 0001–0004.** Decisiones arquitectónicas FASE 1A documentadas en
  `docs/adrs/`.

### Changed

- **A1 — WCAG 2.2 AA** aplicado a 9 componentes del template `eventos`
  (contraste, focus visible, semántica, labels, jerarquía de headings).
- **A2 — TypeScript handler review.** 4 hallazgos HIGH del `typescript-reviewer`
  resueltos en handlers API; MEDIUM/LOW registrados como deuda.
- **A6 — Lighthouse mobile perf**: migración a `next/font`, conversión a SSG
  donde aplicaba, `<Image priority>` en LCP. Score objetivo ≥ 90 mobile.
- **C1 — CSP relajada** para `*.sentry.io` (necesario antes de `tunnelRoute`;
  tras tunnel, CSP se contrae nuevamente — neto: superficie reducida).
- **Infrastructure — Supabase tier Pro** ($25/mo). PITR (Point-in-Time Recovery)
  diferido hasta tener ≥ 10 clientes (decisión costo/beneficio).

### Fixed

- **C1** — Reemplazo de opciones build deprecadas del SDK Sentry v10
  (`hideSourceMaps` → `sourcemaps.disable`, etc.).
- **C5** — `aria-modal=true` agregado al banner + copy locale-aware (no más
  fallback duro a ES).
- **C6** — Página `/privacidad` con notice EN y alternates correctos.

### Security

- **Review de seguridad: 3 HIGH cerrados.**
  - PII scrub _narrow_ (no recursivo global) — evita romper payloads válidos.
  - No recursion en estructuras anidadas más allá de profundidad razonable.
  - Allowlist de proyecto Sentinel ampliada y `.security/` agregado a
    `.gitignore` para mantenerla local.
- **Anti-pattern documentado:** `agente-crea-allowlist-global` — un agente no
  debe ampliar allowlists globales sin revisión humana. Lección registrada en
  el segundo cerebro.
- Sin redirecciones a HTTP, sin secretos en client bundle (verificado).

### Tests

- **A3 — TDD expansion.** Suite crecida a **91 tests** con:
  - **100% cobertura** en handlers API (`/api/**`).
  - **67% cobertura global** del repo.
- **C5** — Tests de comportamiento del banner cookie consent (RED → GREEN).
- Vitest coverage config consolidada en `vitest.config.ts`.

### Docs

- ADR-0001 a ADR-0004 publicadas (decisiones FASE 1A).
- Variables Sentry documentadas en el archivo de muestra de entorno
  (`SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`).
- 5 runbooks operacionales (ver Added → C4).
- `.planning/` bootstrapped vía `gsd-ingest-docs`; `PLAN.md` v0.3.0 generado
  con `gsd-planner`; `AMENDMENTS.md` aplica 5 fixes críticos del
  `gsd-plan-checker`; UB-1/2/3 resueltos.

### Infrastructure

- Supabase Pro tier activado ($25/mo).
- Lighthouse reports persistidos; configuración YOLO de permisos consolidada;
  `supabase/.temp` ignorado.
- Archivo de muestra de entorno local obsoleto eliminado (reemplazado por el
  consolidado en commit previo).

### Deferred

- **C3 — Supabase PITR.** Diferido hasta ≥ 10 clientes (decisión costo/beneficio
  documentada).
- **C7 — 1Password Families** ($60/yr, mitigación bus-factor de secretos).
  Diferido a **v0.5.0**; riesgo aceptado y registrado en `STATE.md`
  (decisión: Pablo, 2026-05-12).

---

## [0.2.0-alpha.1] — Baseline previo

Primer milestone multi-tenant. Establece routing por subdominio, modelo de datos
de tenants, autenticación Supabase, y template inicial `eventos`. Pendiente:
DNS wildcard y activación FASE 1B.

---

[0.3.0]: https://github.com/impluxa/impluxa-web/compare/v0.2.0-alpha.1...HEAD
[0.2.0-alpha.1]: https://github.com/impluxa/impluxa-web/releases/tag/v0.2.0-alpha.1
