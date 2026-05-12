# Changelog

Todos los cambios notables de Impluxa SaaS se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
