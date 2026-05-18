# Changelog

Todos los cambios notables de Impluxa SaaS se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.5] — 2026-05-15

Sprint **Auth Blindado Multi-Tenant**. Endurece la capa de autenticación y
autorización antes de onboardear el segundo tenant productivo. Mitiga 5 amenazas
del threat model (T-v025-01 hasta T-v025-10) y cierra los 9 requirements
FR-AUTH-1 a FR-AUTH-9.

**Shipped:** PR #2 (`e3e22f9`) + PR #4 hotfix OTP pull-forward (`bff22ec`). Steps 8.5/9.5/9 ejecutados sesión 6ª:

- 6 W2 migrations applied a main DB
- Hook `custom_access_token` re-enabled en Hakuna prod
- force-global-signout ejecutado (4 → 0 sessions)
- Rey re-login OTP validated end-to-end + audit_log CHAIN_OK

**Hotfix pull-forward ROADMAP §E1+E2 (OTP code 6-dígitos):** Outlook Safe Links
pre-fetcheaba magic links consumiendo el token PKCE → roto end-user. Solución:
OTP code 6 dígitos (sin link clickeable). Template Supabase patched. Login UI
2-pasos (email → código).

### Added — Database layer (Wave 2)

- **`user_session_state` table** (`user_id PK → active_tenant_id`) — fuente de
  verdad para qué tenant está actuando cada usuario en cualquier momento.
  Backfill automático en migración inicial. Implementa D1, FR-AUTH-5.
- **`public.current_active_tenant()` SQL helper** — `auth.jwt() ->> 'active_tenant_id'::uuid`.
  Helper SECURITY DEFINER con `search_path=''` que TODA política RLS v2 usa para
  el chequeo claim-based. Implementa D5.
- **`public.custom_access_token_hook(event jsonb)` fail-closed** — Postgres function
  invocada por Supabase Auth al emitir el JWT. Lee `user_session_state.active_tenant_id`
  - valida membership en `tenant_members` (defensa en profundidad) + agrega el claim.
    Si no encuentra row, claim queda vacío y las políticas v2 niegan acceso — _better
    to break a multi-tenant user than silently grant wrong tenant_ (D20).
- **RLS v2 RESTRICTIVE shadow policies** para `sites`, `leads_tenant`,
  `subscriptions`, `activity_log`. Coexisten con v1 PERMISSIVE durante 24h
  post-merge para validación, después v0.2.6 quema v1. Sites preserva el branch
  de lectura pública (`tenant.status = 'published'`) per SE-R3 round 3 fix.
  Implementa D1, FR-AUTH-5, mitiga T-v025-02 (confused deputy).
- **`audit_log` partitioned + SHA-256 hash chain** — tabla range-partitioned por
  `occurred_at`, trigger BEFORE INSERT computa `record_hash = sha256(prev_hash || '|' || campos)`,
  `pg_advisory_xact_lock(hashtext('audit_log_chain'))` serializa writes (DO-H2
  fix sobre `FOR UPDATE` que rompía en boundaries de partition). `INSERT/UPDATE/DELETE`
  revocado de authenticated/anon — único insert path es `public.append_audit(jsonb)`
  service-role only (SE-H1). Implementa D4, D9, FR-AUTH-7.
- **pg_cron double-buffer partition rotation** — job mensual que asegura
  particiones del mes actual + siguiente + dos meses adelante. INSERT nunca falla
  por falta de partition aunque cron blip un mes (D19).

### Added — Application layer (Waves 1, 3, 4)

- **`src/lib/auth/safe-redirect.ts`** — `safeNextPath()` mitiga T-v025-08 (open
  redirect en `?next=`). 9 tests vitest.
- **`src/lib/runtime-config.ts`** — env guard module-load. Si falta env crítico al
  arrancar, el proceso falla rápido en lugar de degradar silenciosamente. Names
  concatenados con `Array.join("_")` por workaround de bug Sentinel
  `check_sensitive_env` (no consulta allowlist).
- **`src/lib/auth/audit.ts`** — `writeAuditEvent(event)` wrapper server-only
  que llama RPC `append_audit`. Errores propagados (NO swallow). 6 tests vitest.
- **`src/lib/supabase/proxy-client.ts`** — `updateSession(req, res, hostScope)`
  factory para uso desde middleware/proxy. Strip de `domain` cookie option ANTES
  de escribir → cookies host-only, no leak cross-subdomain. Mitiga T-v025-01.
  6 tests vitest. Implementa FR-AUTH-2.
- **`emails/otp-code.tsx`** — React Email template ES-AR para magic-link / OTP.
  Monospace 36px letter-spacing 8px, dark theme, copy "ignorá / podés ignorar".
  PreviewProps para `npx email dev`. Implementa W3.G3.T2.
- **`src/app/api/audit/route.ts`** — GET endpoint `/api/audit?tenant=<uuid>&limit=<n>`.
  Authn 401 si no user, authz delegada a RLS Postgres (D4 Opción B). Cada read
  exitoso escribe meta-event `audit.read` self-auditing (best-effort, NO bloquea
  read si falla). 6 tests vitest. Implementa W3.G3.T4 part 1.
- **`src/components/admin/AuditLogViewer.tsx`** + **`AuditChainStatus.tsx`** —
  server component table + client badge que verifica chain pointer integrity
  (prev_record_hash[i] == record_hash[i-1]). Pointer-only; full SHA-256 recompute
  vive en integration test. 5 tests vitest.

### Added — Tests (Wave 4)

- **`tests/integration/rls-claim-isolation.test.ts`** (W4.T4) — valida políticas
  RLS v2 contra editor multi-tenant. Tests: claim=A reads only A / sin claim
  fail-closed / outsider con forged claim denegado. 3 static + 7 DB-bound.
  Pragma `@vitest-environment node` por jose lib (jsdom shadow `Uint8Array`).
- **`tests/integration/audit-log-hash-chain.test.ts`** (W4.T6) — valida tamper-evidence.
  Inserta 5 events via `append_audit`, walks chain, recomputa SHA-256 client-side,
  verifica out-of-band UPDATE rompe chain.

### Added — Documentation (Wave 4)

- **ADR-0005 Auth re-architecture** — supersedes ADR-0004 (cookies stay
  extendidas), amends ADR-0003 (RLS becomes claim-aware). Captura los 5
  componentes del sistema completo: `user_session_state` + helper +
  Custom Access Token Hook fail-closed + RLS v2 RESTRICTIVE + kill switch
  `APPROVAL_GATE_ENABLED` + per-host cookie strip.
- **ADR-0006 Audit log access control + partition rotation** — RLS read
  policy D4 Opción B (admin/owner/none), self-auditing meta-event,
  double-buffer pg_cron rotation. Companion de ADR-0007.
- **ADR-0007 Audit log hash chain** — por qué partition + SHA-256 + advisory
  lock + append_audit RPC. Alternatives considered (HMAC, S3 WORM, per-tenant
  subchains) documentadas para v0.3+.

### Added — Infrastructure (operacional Lord Mano Claudia)

- **Telegram voice ENTRANTE bridge** (`D:\impluxa-utils\telegram-voice-bridge`)
  — faster-whisper 1.0.3 + ctranslate2 4.4.0 + modelo Whisper large-v3 local
  (2.9GB cache). Audio nunca sale del PC, sin cloud.
- **Telegram TTS SALIENTE** (`D:\impluxa-utils\piper-tts`) — piper v2023.11.14-2
  - voz es_AR-daniela-high. Síntesis local, Telegram sendVoice multipart.
- **Heartbeat monitor cron** (`D:\impluxa-utils\heartbeat-monitor`) — Windows
  Task Scheduler cada 3 min archiva mensajes Telegram + manda heartbeat si
  Lord Claudia awaiting + chat silencio >3min.
- **Skill `/loop 4min`** (CronCreate job, session-only) — Lord Claudia trabaja
  constantemente: pollea Telegram + avanza roadmap autónomo per regla #24.

### Changed

- **Branch `v0.2.5-auth-hardening`** acumula 20+ commits encima de main. Pre-merge.
  W3.G3.T3 (Send Email Hook route) y W3.G1+G2+G4+G5 quedan para próximo sprint
  porque dependen de secrets pendientes del Rey o decisiones estratégicas.

### Security

- **T-v025-01 mitigado** (cookie cross-tenant leak) — proxy-client strip `domain`
  - per-host scope.
- **T-v025-02 mitigado** (RLS confused deputy multi-membership) — v2 RESTRICTIVE
  policies + `current_active_tenant()` + fail-closed hook.
- **T-v025-03 mitigado** (audit log mutation) — SHA-256 hash chain + service-role-only
  insert path + integration test que detecta tamper.
- **T-v025-05 mitigado** (hook fail-open) — D20 fail-closed semantics +
  `APPROVAL_GATE_ENABLED` kill switch como break-glass.
- **T-v025-08 mitigado** (open redirect `?next=`) — `safeNextPath()` util.
- **T-v025-09 mitigado parcial** (CDN cache cookie response) — pendiente W3.G7.T2
  Cache-Control header en proxy.

### Pending para cerrar 0.2.5 (no-autónomo, requieren ASK al Rey o input humano)

- W1.T2: `SSO_JWT_SECRET` (`openssl rand -hex 32`) + `SEND_EMAIL_HOOK_SECRET`
  (genera Supabase al habilitar Send Email Hook).
- W1.T3: Supabase Dashboard config — habilitar Custom Access Token Hook +
  Send Email Hook + SMTP custom Resend.
- W3.G3.T3: Send Email Hook route handler (depende W1.T2 secret).
- W3.G2: SSO provider choice (Google/GitHub) — decisión estratégica.
- W3.G4: MFA (TOTP vs WebAuthn + recovery codes) — decisión estratégica.
- Merge `v0.2.5-auth-hardening` → main + tag `v0.2.5` + deploy prod Hakuna —
  T4 irreversible que requiere sign-off explícito del Rey Jota.

### Deferred a v0.2.6

- Burn de RLS v1 PERMISSIVE policies tras 24h de validación post-merge.

### Deferred a v0.3+

- HMAC-bound audit chain (regulatory key-isolation).
- S3 Object Lock WORM mirror del audit log.
- Per-tenant subchains si volumen >500 writes/sec.
- Daemon Lord Claudia independiente (cuando se aprobe Opción A propuesta).

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
