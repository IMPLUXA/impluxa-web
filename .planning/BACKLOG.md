# BACKLOG — Impluxa SaaS

> Items deferred from active milestones with explicit tripwires.
> Each entry has a defined closure target (next-milestone OR specific phase) and exact closure criteria.
>
> **Source authority**: items here are reviewed at every milestone cierre. Closure happens when the closure criterion is verifiably met (file:line evidence or test pass).

---

## Format

```
## <ID> — <one-line title>

- **Deferred from**: <phase / session>
- **Defer reason**: <one paragraph>
- **Closure target**: <phase / next-milestone>
- **Closure criterion**: <verifiable test or change>
- **Dossier**: <path to design doc>
- **Tripwire 1 (code TODO)**: <file:line>
- **Tripwire 2 (SPEC ref)**: <file + section>
- **Tripwire 3 (this BACKLOG entry)**: present
- **Risk if defer slips**: <impact>
```

---

## CI-VITEST-GAP — el workflow de CI no corre vitest

- **Deferred from**: s52 (hallazgo colateral durante ADMIN-AR C1).
- **Defer reason**: `.github/workflows/ci.yml` corre solo lint + tsc + build; vitest es disciplina LOCAL = un PR con tests rotos puede mergear si la disciplina falla. Registrado por orden auditor s52.
- **Closure target**: sesion futura con decision CEO (propuesta: agregar step `npm run test` al workflow con los placeholders de env que ya existen en el build step + hosts reales para los literales de urls.test — medido s52: la suite necesita TENANT_SUFFIX=.impluxa.com para pasar).
- **Closure criterion**: CI de un PR cualquiera muestra step de vitest verde, o decision CEO explicita de NO agregarlo.
- **Cross-ref**: continuacion natural de lesson `verify-pre-push-honesto-comando-de-ci` (s51) — va como DATAPOINT de esa lesson en el /aprende del cierre, NO lesson nueva (decision auditor s52).
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: merge de PR con suite rota si la disciplina local se saltea un dia.

---

## DOMINIO-PV-v1.1 — limpieza post-cutover patagoniaviva.ar (fase B COMPLETA s52)

- **Deferred from**: s52 fase B cutover (P1-P7 SHIPPED 2026-06-12, gates 16/16 + 4/4 + 9/9).
- **Defer reason**: items de hardening/limpieza que no bloquean el dominio vivo; agrupados para ejecutar juntos a las ~48h del cutover estable.
- **Closure target**: ~2026-06-14 (TTL raise) / proxima sesion que toque DNS o SEO.
- **Closure criterion** (sub-items verificables):
  1. TTL records CF 60 → 3600 (zona patagoniaviva.ar, 6 records).
  2. **[BLOQUEANTE DEL CIERRE de este item — condicion auditor s52]** Revocar token CF `CLOUDFLARE_API_TOKEN_DNS_PATAGONIAVIVA` + **verify de muerte con probe 401/403 (patron s51)**. El expiry auto 2026-06-19 es la RED, no el plan: el item NO cierra sin revocacion activa verificada.
  3. Cache in-memory + negative caching en `resolveTenantByDomain` (paridad con `resolveTenantBySlug`) — PRIORIDAD SUBIDA: la ruta sirve Dynamic SIN edge-cache (medido s52: Cache-Control no-store, MISS perpetuo) = 2 queries service-role por request.
  4. Google Search Console: alta property .ar + submit sitemap.
  5. Cleanup literal `PV_SITEMAP` (branch sufijo viejo en sitemap.ts) post re-crawl Google.
  6. Hardening /login /signup en .ar (noindex o host-gate) — preexistente via SHARED_ROOT. **CRUZADO con ADMIN-AR-MIGRATION (obra ACTIVA s52, decision CEO)**: con el admin mudandose a .ar, /login en .ar pasa de "sin sesion util" a PUERTA REAL — el hardening se resuelve DENTRO de esa obra, no aca. NO duplicar.
  7. DNSSEC NIC.ar + CAA `issue letsencrypt.org` (opcional v1.1).
- **Dossier**: D:\segundo-cerebro\meta\plan-dominio-pv-faseB-s52.md (seccion DELTA + folds SE).
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: TTL 60 = carga DNS extra (menor); token vivo mas alla del 19/06 imposible (expiry); resolver sin cache = costo DB lineal con trafico .ar (hoy ~0).

---

## DB-H1 — `app_config` consumer wiring

- **Deferred from**: W1.T1 5B.7 (Sub-paso 5.B, sesion 15).
- **Defer reason**: Cut B-truncado scope was reduced session 13 to ship `app_config` table skeleton without wiring a consumer. The migration `20260519_v026_002_app_config.sql` creates the table + RLS + grants, but `scripts/observe-rls-burn-readiness.ts` does NOT read it (grep 0 hits at HEAD `b7ed8d6`). Ship-as-skeleton preserves scope discipline and avoids expanding 5B.7 into wiring work that W1.T2 already owns.
- **Closure target**: W1.T2 audit_log writers phase (next milestone in v0.2.6).
- **Closure criterion**: `scripts/observe-rls-burn-readiness.ts` reads `public.app_config.value->>'hook_reenable_ts'` and uses it as the fallback anchor when `--since-hook-reenable` flag is used. Integration test asserts the read path returns expected payload from a seeded `app_config` row.
- **Dossier**: `D:\impluxa-web\.planning\v0.2.6\W1.T1-5B-SPEC-PASS-1-DBO.md` §1.1.
- **Tripwire 1 (code TODO)**: `D:\impluxa-web\scripts\observe-rls-burn-readiness.ts` — TODO(W1.T2) block immediately above `fetchFirstClaimMintT0` function definition (line ~82).
- **Tripwire 2 (SPEC ref)**: `D:\impluxa-web\.planning\v0.2.6\SPEC.md` (sesion 15 update — pending 5B.7 SPEC sintesis commit) section "Open scope deferred to W1.T2".
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: low. `hakuna_live=false`. Script today operates on `--since-first-claim-mint` (OQ-4 LOCKED) which does NOT need `app_config`. The deprecated `--since-hook-reenable` flag is preserved for emergency rollback but is gated and documented as such.

---

## C-H2 — `audit_dedup` bypass when JTI missing in tenant-claim action

- **Deferred from**: W1.T1 5B.7 (Sub-paso 5.B, sesion 15) after Two-Pass extended caso #8 fresh + internal re-review fresh BA `a874a47a54370a774` + Security Engineer `a7b8b19469251fd2f`.
- **Defer reason**: when a tenant-claim action payload has `jwt_jti` null (gotrue/SDK regression scenario S2 from SE threat model — only reachable scenario in prod), `audit.ts:86-98` emits a `console.warn` but does NOT short-circuit, so `append_audit` proceeds and the dedup gate at `20260518_v026_001_audit_dedup.sql:143` skips its `if` block (it requires non-null `v_jti`), inserting a fresh `audit_log` row per retry. Cold-round BA cold flagged this as HIGH "corrupts FR-RLS-BURN-2 readiness signal". Re-review fresh BA + SE concur it is MED (not HIGH): the gate at `observe-rls-burn-readiness.ts:249-254` is binary (`claim_missing > 0` → NO-GO), count inflation does NOT flip the verdict; SPEC.md:60 confirms the real gate is human CEO sign-off, not script auto-flip; direction of corruption is fail-closed (false NO-GO = safe direction, not exploitable false GO). All proposed FIX-AHORA mitigations are out of scope for Cut B (auth-boundary reject breaks T5 compat; fail-closed at audit.ts reverses fail direction to UNSAFE; synthetic dedup PK is schema change).
- **Closure target**: W1.T2 audit_log writers phase (next milestone in v0.2.6) — the W1.T2 work introduces consumer-side collapse logic in `observe-rls-burn-readiness.ts` that makes this signal-hygiene control fully closed.
- **Closure criterion**: integration test `tests/integration/observe-rls-burn-readiness-jti-null-collapse.test.ts` with these 4 named assertions (a/b/c/d):
  - (a) Given N retries with JTI-null tenant-claim action payloads, the script collapses to a single `claim_missing` row by `(actor_user_id, minute-bucket)` before counting against the gate.
  - (b) The collapsed count contributes `1` to the gate verdict regardless of retry storm N.
  - (c) The script logs a separate counter for "raw rows before collapse" for observability without contaminating the gate.
  - (d) The collapse logic is idempotent under re-run on the same window (same input → same output).
- **Dossier**:
  - `D:\impluxa-web\.planning\v0.2.6\W1.T1-5B-SPEC-PASS-2-BA.md` §C-H2 (original cold-round finding).
  - `D:\impluxa-web\.planning\v0.2.6\W1.T1-5B-C-H2-REREVIEW-BA-FRESH.md` (fresh BA re-review).
  - `D:\impluxa-web\.planning\v0.2.6\W1.T1-5B-C-H2-REREVIEW-SE-FRESH.md` (Security Engineer re-review).
- **Tripwire 1 (code TODO)**: `D:\impluxa-web\src\lib\auth\audit.ts:80` — TODO(W1.T2) block referencing this BACKLOG entry + the two re-review dossiers. Committed sesion 15 as part of 5B.7 SPEC sintesis (HEAD post-commit).
- **Tripwire 2 (SPEC ref)**: `D:\impluxa-web\.planning\v0.2.6\SPEC.md` (sesion 15 update — pending 5B.7 SPEC sintesis commit) section "Open scope deferred to W1.T2", item C-H2.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: low. Failure mode is fail-closed (false NO-GO blocks `hakuna_live` flip, never enables it incorrectly). Telemetry noise + triage cost are the operational impact, not signal corruption of a security gate.

---

## OPERATOR-1 — "Modo operador Impluxa" (acceso de soporte cross-tenant)

- **Deferred from**: pedido CEO s50 (durante F-UI-BRANDED corte 3 / auditoría de roles). Registro T1 docs, NO se diseña hoy.
- **Defer reason**: necesidad real de soporte (el equipo Impluxa debe poder entrar al panel de un tenant para ayudarlo), PERO es superficie de autorización cross-tenant de alto riesgo — exige diseño T3 dedicado con su propio research + mockup-first, no se improvisa dentro del corte 3.
- **Encuadre arquitectónico FIRME del CEO (no negociable en el diseño)**:
  - **NO backdoor, NO bypass de RLS, NO service_role como vía de acceso de soporte.** El service_role sigue siendo solo para fetches server-side ya gated por membership; jamás como "modo dios" de un humano.
  - **SÍ rol explícito `impluxa_operator`** modelado sobre `agency_staff` + `getActiveTenant` (la misma maquinaria de membership/rol que el resto del panel), de modo que la RLS siga siendo la autoridad y el operador entre como un principal con rol auditable, no como un bypass.
  - **Audit log obligatorio por cada entrada de operador** (`append_audit` ya existe — reusar, no reinventar): quién entró, a qué tenant, cuándo, qué hizo.
  - **Marca visible "acceso soporte"** en la UI mientras un operador está dentro de un tenant ajeno (el dueño y el operador ven que es una sesión de soporte, no una suplantación silenciosa).
  - **Capa de consentimiento del cliente por Ley 25.326** (protección de datos personales, Argentina): el tenant consiente el acceso de soporte a sus datos; sin consentimiento registrado, no hay entrada.
- **Closure target**: s51+, arquitectura T3 dedicada. Diseño MOCKUP-FIRST con research read-only propio (espejo del método F-UI-BRANDED).
- **Closure criterion**: doc de arquitectura T3 firmado + mockup aprobado CEO + (al diseñar) plan de cortes con su propio Two-Pass cold CR+SE. NADA de código antes de eso.
- **Tripwire 1 (este BACKLOG entry)**: present.
- **Tripwire 2**: cuando se diseñe, cross-ref a `plan-f-ui-branded-s50.md` (mismo método) + `reference_hakuna_fotos_ninos_legal.md` (precedente de capa legal/consentimiento).
- **Risk if defer slips**: alto SI se improvisa (cross-tenant + datos personales = blast radius legal + privacidad). Bajo mientras quede como item registrado sin tocar: hoy no existe acceso de soporte, los operadores no entran a tenants ajenos.

---

## PLANS-DRIFT-1 — Reconciliar catálogo de planes vs visión V6.2 + plan real de PV

- **Deferred from**: s50, decisión comercial CEO durante F-UI-BRANDED corte 4 (chip de plan).
- **Defer reason**: el catálogo `public.plans` legacy (`trial` $0 / `standard` $12.000 / `pro` $24.000 + ahora `full` $300.000 ARS) NO coincide con la visión V6.2 (Starter USD 38 / Growth USD 79 / Scale USD 169), y la visión tampoco refleja la decisión comercial real: **PV contrató plan FULL premium price_ars=300000 (decisión CEO s50)** — la nota de la visión que ponía a turismo en Growth quedó desactualizada. La decisión comercial MANDA sobre ambos documentos.
- **Closure target**: cuando billing real se diseñe (F10/M3) o antes si el drift molesta — decide CEO.
- **Closure criterion**: (a) catálogo `plans` alineado con los tiers reales del producto (o documentado por qué conviven legacy + nuevos), (b) doc de visión actualizado con el plan real de PV (Full $300.000, no Growth), (c) el chip de la vista Módulos sigue leyendo la fila real (mecanismo ya correcto, no tocar).
- **Tripwire 1 (este BACKLOG entry)**: present.
- **Tripwire 2**: `D:/segundo-cerebro/meta/impluxa-product-vision.md` Sección 5 (Patagonia Viva, Tier 2 Growth — STALE respecto de la decisión s50).
- **Risk if defer slips**: bajo operativo (el dato de prod es la verdad y el panel la lee); medio documental (la visión miente sobre el plan de PV hasta que se actualice — cualquier decisión basada en "PV paga Growth USD 79" usa un número viejo: el real es FULL ARS 300.000).

---

## post-v0.2.6 — Sentinel `check_sensitive_env` consult allowlist

- **Deferred from**: sesion 14 CI fix (caso #8 light).
- **Defer reason**: Sentinel hook function `check_sensitive_env` ignores the `paths[]` allowlist (other checks like `check_paths` DO consult it). Workaround for s14 was Opcion C — CEO edited the workflow YAML manually. Confirmed empirically with allowlist scope-minimo path-only test that did NOT unblock Edit.
- **Closure target**: post-v0.2.6 milestone, dedicated session with timebox 2h + Squad review (Security Engineer + DevOps Automator).
- **Closure criterion**: `check_sensitive_env` consults the same allowlist mechanism as `check_paths`; regression test: Edit/Write of a file inside an allowlisted path containing a literal sensitive var name proceeds without Sentinel block.
- **Dossier**: lesson `reference_sentinel_check_env_no_allowlist` (re-validated caso fundacional s14).
- **Tripwire 1**: Sentinel hook source code (TBD — locate at investigation start).
- **Tripwire 2**: `D:\segundo-cerebro\wiki\meta\hot.md` Active Threads "Backlog post-v0.2.6: Fix Sentinel hook".
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: low operational, medium developer-experience. Workaround (manual CEO edit) is reliable but adds latency to Claudia autonomy for YAML/env-touching edits.

---

## post-v0.2.6 — partition rotation function backfill capability

- **Deferred from**: W1.T1 5B.7 (Sub-paso 5.B, sesion 15) DBO-H4 NEW.
- **Defer reason**: current rotation function only creates `current_date + 1 month` and `current_date + 2 months`, leaving the **current month** uncovered on fresh-DB apply in any month other than the original 2026-05. Operationally documented in `RUNBOOK-5B.md` §4. Code change to add backfill capability is out of scope for Cut B (would re-open partition machinery that 5.B truncated).
- **Closure target**: post-v0.2.6 (no pressure — `hakuna_live=false` and prod Hakuna applied migrations within the supported window 2026-05).
- **Closure criterion**: `audit_log_rotate_partitions()` accepts an optional `start_date` parameter (or auto-detects current state) and backfills from earliest needed partition to `current_date + 2`. Integration test asserts apply-on-2026-06 and apply-on-2026-07 both result in `audit_log_2026_06` and `audit_log_2026_07` existing.
- **Dossier**: `D:\impluxa-web\.planning\v0.2.6\W1.T1-5B-SPEC-PASS-2-DBO.md` §3 DBO-H4 NEW + RUNBOOK-5B.md §4.4.
- **Tripwire 1**: `D:\impluxa-web\supabase\migrations\20260514_v025_006_audit_partition_rotation.sql` header comment (to be added during 5B.7 SPEC sintesis commit).
- **Tripwire 2**: `RUNBOOK-5B.md` §4.4.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: low. Current applied state in prod Hakuna is within supported window. Fresh-DB apply requirements (DR rebuild, new dev replica) require the runbook §4.3 manual backfill step until this is closed.

---

## [s16 inicio] Consolidar archivos del project Claude.ai en carpeta unica

- **Deferred from**: s15 cierre (post-Sec 6 formal closure, NOT a session reopening — just T1 docs queue).
- **Defer reason CEO**: para hacer mas rapido el upload de archivos al project Claude.ai cuando arranca nuevo chat de auditoria. Hoy estan distribuidos en distintos paths.
- **Estado actual a auditar al ejecutar (s16)**:
  - `D:\segundo-cerebro\meta\` ya contiene: `caso7-codes-prior-caso8.md`, `observaciones-auditor-externo.md`, `observaciones-claudia-v22.md`, `roadmap-audit-s13-post-cierre.md`.
  - Path actual de: `CLAUDE.md`, `DETECTION_SIGNALS.md`, `MEMORY.md`, `session-boot.md`, `hot.md` (verificar paths reales s16 inicio antes de mover).
- **Tarea** (orden estricto pre-merge):
  1. Audit completo de paths actuales.
  2. Lean carpeta destino: `D:\segundo-cerebro\meta\` (ya tiene 4 archivos).
  3. Search-replace exhaustivo de referencias en `CLAUDE.md`, `session-boot.md`, `hot.md`, hooks `.claude/`, scripts.
  4. Mover archivos a destino unico.
  5. Validar con `/boot` test en chat de prueba.
  6. Update git tracking si aplica (`meta/` actualmente untracked en repo segundo-cerebro — decidir si trackear post-consolidacion).
- **Tipo**: T2 (no T1 trivial).
- **Riesgo**: bajo si metodico, alto si apurado. NO hacer al final de sesion cansada.
- **Estimate**: 30-60 min.
- **Beneficio**: upload archivos al project Claude.ai mas rapido + mental model claro.
- **Closure target**: s16 inicio (antes de arrancar 5B.11 ASK CEO mark PR #6 Ready, para que el chat de auditoria pueda subir archivos con paths actualizados).
- **Closure criterion**: todos los archivos del project Claude.ai estan en `D:\segundo-cerebro\meta\` (o carpeta unica decidida) + cero referencias rotas en CLAUDE.md / session-boot.md / hot.md / hooks / scripts + `/boot` test pasa en chat de prueba.
- **Dossier**: este entry. Sin dossier dedicado hasta ejecucion.
- **Tripwire 1 (code TODO)**: NA (no es scope productivo).
- **Tripwire 2 (SPEC ref)**: NA.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: medium operativo (cada chat auditoria nuevo gasta tiempo extra coordinando paths multiples). Cero impacto produccion.
- **Nota agregada s15 post-cierre**: investigacion s15 (verificacion pre-cierre paths upload Claude.ai project) detecto **duplicado `D:\segundo-cerebro\CLAUDE.md` vs canonical `C:\Users\Pablo\CLAUDE.md`**. Origen desconocido (stale copy / viewer mirror / dual-write hook desactivado?). Authoritative es `C:\Users\Pablo\CLAUDE.md` (el que /boot Sec 0 carga). Resolver en T2 consolidacion s16: (a) `diff` ambos archivos byte-a-byte para ver si son identicos, (b) decidir si elimina el duplicado, reconcilia divergencias, o re-sincroniza, (c) evitar drift tipo Telegram s14 duplicado (canal vs file) — mismo patron familia "verdad duplicada en multiples ubicaciones". Logged tambien en MEMORY.md y observaciones-claudia-v22.md s15 si emerge como reincidencia.
- **CEO direccion 2026-05-20 post-cierre s16**: dedicar **UNA SESION ESPECIFICA** al vocabulario + consolidacion archivos. **Objetivos:**
  - **Consolidacion fisica**: todos los archivos canonicos en 1 solo directorio. Eliminar duplicado `D:\segundo-cerebro\CLAUDE.md` vs `C:\Users\Pablo\CLAUDE.md` (authoritative `/boot` Sec 0) + cualquier otro duplicado encontrado durante el sweep.
  - **Migracion vocabulario completa segundo-cerebro**: grep masivo + reemplazo `Rey/Lord/Reino/Consejo → CEO/Claudia/Impluxa/Squad` en todos los archivos (notes, lessons, transcripts, topic files no tocados, lo que aparezca). Ya migrado: CLAUDE.md v2.2 + MEMORY.md s16 + topic file `feedback_vocabulario_convoco_consejo.md` s16. Pendiente: resto de `D:\segundo-cerebro\` (lessons, aprendizajes, hot.md, session-boot legacy entries, scripts, Task Scheduler names, `audit-decisions.ps1`, credentials filename, etc).
  - **Scope-lock**: NO mezclar con trabajo v0.2.6 (5B.11 / 5B.12 / Logflare procurement / pg_cron enable Hakuna preview). Sesion separada con dedicacion exclusiva.
  - **Squad real obligatorio**: Two-Pass extended T2+ politica vigente. Senior PM + Workflow Architect + posible Security Engineer cold (decision T2 destructiva sobre memory + segundo-cerebro fisico). Validar lesson-por-lesson + dry-run sweep antes de aplicar reemplazos masivos. Backup pre-cambio obligatorio.
  - **Trigger sesion**: post-v0.2.6 o cuando CEO escriba arrancar la sesion dedicada. Lesson relacionada: `vocabulario-migracion-pendiente-2026-05-16`.

---

## post-v0.2.6 — `tests/unit/auth-guard.test.ts` local-dev environment gap

- **Deferred from**: 5B.9 integration tests (sesion 15).
- **Defer reason**: `tests/unit/auth-guard.test.ts` (pre-existing from commit `67f73fa`, before s15) imports `@/lib/auth/guard` directly without mocking `@/lib/runtime-config`. Because `runtime-config.ts` runs `requireEnv()` at module load for all required environment variables, loading the test file in a local dev environment without those vars set causes module-import failure: `[v0.2.5 env guard] Missing required env var: NEXT_PUBLIC_SUPABASE_URL`. CI passes because the s14 CI workflow has 13 placeholder env vars set in the build step (`b7ed8d6` fix CI commit). Pre-existing condition NOT caused by 5B.9 commit `8f74946`. Local-dev-only failure.
- **Closure target**: post-v0.2.6, opportunistic. NOT a blocker for v0.2.6 ship or `hakuna_live` flip.
- **Closure criterion**: `npx vitest run tests/unit/auth-guard.test.ts` passes locally without any environment pre-setup (clean `process.env`). Two acceptable approaches:
  - (a) Mock `@/lib/runtime-config` at the top of the file using `vi.mock`, mirroring the pattern already used in `tests/unit/auth-guard-tenant.test.ts` (lines 37-45). Cleanest, no shared setup leak.
  - (b) Add a vitest setup file (`vitest.setup.ts`) that pre-populates placeholder env vars for ALL test files. Wider blast radius, but fixes any future similar test file at once.
- **Dossier**: lesson recorded in commit `8f74946` body. No dedicated dossier.
- **Tripwire 1 (code TODO)**: not added (this is local-dev gap, not a production scope item). If a contributor opens `auth-guard.test.ts` in the future and reads this BACKLOG entry, they will find the closure path.
- **Tripwire 2 (SPEC ref)**: not added (SPEC §10 covers production scope; this is dev tooling).
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Tag**: `local-dev gap, fix opcional post-v0.2.6, mockear runtime-config o vitest setup file`.
- **Risk if defer slips**: low. CI remains green; only affects local-dev iteration friction when running the full suite locally.

---

## [s18 cierre sub-fase (a)] SaaS-Bariloche\ legacy — evaluar archivo o mantener

- **Deferred from**: s18 sub-fase (a) cierre (consolidacion archivos canonicos). Hallazgo lateral durante inventario paso 0.
- **Defer reason**: `C:\Users\Pablo\SaaS-Bariloche\` es proyecto legacy pre-pivot Impluxa con archivos vivos: `SaaS-Bariloche\CLAUDE.md` (2254b, 2026-05-08) + `SaaS-Bariloche\wiki\hot.md` (967b, 2026-05-08). NO son duplicados del canonical CEO — son docs legitimos de otro contexto. Confusion potencial para futuros agentes (Squad / cold round) que pueden clasificar incorrectamente como "stale" basado en naming + size sin abrir contenido (caso fundacional s18: BA Pass-1 lo hizo, evidencia en lesson `s18-BA-pass1-clasificacion-stale-sin-abrir-contenido`).
- **Tarea** (orden estricto cuando se ejecute):
  1. Audit completo de `C:\Users\Pablo\SaaS-Bariloche\` (tree + sizes + last-modified).
  2. Decision: (a) mover entero a `D:\archived\SaaS-Bariloche-legacy\`, (b) dejar in-place agregando `.archived` marker file, o (c) eliminar tras confirmar no hay valor recuperable.
  3. Squad real obligatorio (Senior PM lean + Workflow Architect riesgo file management) + ASK CEO pre-apply.
- **Tipo**: T2.
- **Riesgo**: bajo (archivos pre-pivot sin lectores ejecutables verificados s18). Verificar antes con sweep inbound refs sobre paths SaaS-Bariloche.
- **Estimate**: 20-30 min.
- **Beneficio**: limpia confusion naming colision (`CLAUDE.md` apareciendo en multiples paths no-canonical).
- **Closure target**: T-cuando-emerja (no priority, cero impacto operativo actual).
- **Closure criterion**: `C:\Users\Pablo\SaaS-Bariloche\` movido/eliminado/marcado segun decision CEO + cero refs rotas en sistema.
- **Dossier**: este entry.
- **Tripwire 1 (code TODO)**: NA.
- **Tripwire 2 (SPEC ref)**: NA.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: low operativo (archivos quietos). Riesgo medio cognitivo (proximo Squad puede repetir error clasificacion BA Pass-1).

---

## [s18 cierre sub-fase (a)] Rename `D:\segundo-cerebro\CLAUDE.md` para evitar colision

- **Deferred from**: s18 sub-fase (a) cierre. Hallazgo paso 1 diff resumido.
- **Defer reason**: `D:\segundo-cerebro\CLAUDE.md` (2468b, 2026-05-11) NO es version vieja del canonical CEO. Es config Obsidian vault segundo-cerebro ("Segundo Cerebro de Pablo — LLM Wiki / Mode: D Personal Second Brain"). Colision de nombre con canonical `C:\Users\Pablo\CLAUDE.md` (constitucion operativa Claudia CoS) confunde a futuros agentes y a sweeps de inventario por nombre.
- **Tarea** (T1 docs cuando emerja):
  1. Rename a nombre descriptivo no-colisionante: `WIKI-VAULT-CONFIG.md` (sugerencia inicial) o equivalente.
  2. Update referencias inbound si las hay (sweep grep previo).
  3. Verificar /boot sigue cargando canonical desde C:.
- **Tipo**: T1 docs.
- **Riesgo**: bajo (rename idempotente + reversible con rename inverso).
- **Estimate**: 10-15 min incluyendo sweep refs.
- **Beneficio**: defender futuros Squad de confundir archivos por naming colision (caso fundacional s18 BA Pass-1).
- **Closure target**: T1 docs cuando emerja (proxima sesion housekeeping).
- **Closure criterion**: `D:\segundo-cerebro\CLAUDE.md` renombrado + cero refs rotas + canonical sigue cargando.
- **Dossier**: este entry.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: low operativo. Medio cognitivo (mismo riesgo entry SaaS-Bariloche\: futuros agentes pueden mis-clasificar).

---

## [s19 schedule] Sesion dedicada vocab-python `impluxa-utils\` scripts + READMEs

- **Deferred from**: s18 sub-fase (b) decision CEO turn 19. Sweep cross-boundary turn 17 revelo refs vocab viejo en scripts Python/PowerShell criticos operativos.
- **Defer reason**: NO entra en b.now (sesion 18) ni en b.later post-v0.2.6 ship. Schedule sesion dedicada s19 con cabeza fresca + Squad real + Pass-2 cold + smoke tests Python-especificos. Razones:
  - Cabeza fresca per sesion (s18 ya larga).
  - Python tiene riesgo operacional real: regex agresivo sobre var names rompe codigo, log strings + comentarios + identifiers requieren classification cuidadosa.
  - Modulos criticos: `monitor.py` (heartbeat Task Scheduler 3min — si rompe Claudia pierde heartbeat) + `creds.py` (cargador credenciales modulo) + `audit-decisions.ps1` (Task Scheduler weekly).
  - Gap defer comprimido a 1-2 dias (no semanas/meses) tras s18 docs migrados.
- **Scope estricto s19:**
  - `D:\impluxa-utils\heartbeat-monitor\monitor.py` (7 refs)
  - `D:\impluxa-utils\common\creds.py` (2 refs)
  - `D:\impluxa-utils\audit-decisions\audit-decisions.ps1` (2 refs)
  - `D:\impluxa-utils\piper-tts\send_voice.py` (6 refs)
  - `D:\impluxa-utils\telegram-voice-bridge\transcribe_voice.py` (7 refs)
  - `D:\impluxa-utils\supabase-config-bootstrap\configure_w1t3.py` (5 refs)
  - 4 READMEs: `impluxa-utils\README.md` (28) + `piper-tts\README.md` (13) + `telegram-voice-bridge\README.md` (9) + `supabase-config-bootstrap\README.md` (3)
  - Total: ~82 refs + var names + comentarios + log messages.
- **Excluido s19 scope:**
  - Model cache Whisper (`telegram-voice-bridge\model-cache\models--Systran--*\snapshots\*\{tokenizer.json,vocabulary.txt}`) — falsos positivos pre-trained corpus.
  - Runtime data (`heartbeat-monitor\state.json`, `audit-decisions\last-summary.txt`, `tmp\*`) — NEVER TOUCH per criterio formal s18.
- **Tarea** (orden estricto):
  1. Squad fresh agentIds (Senior PM + Backend Architect Python expert + Workflow Architect).
  2. Inventario per-file: classification {string-literal, var-name, comment, log-message, function-name, import-name}.
  3. Filename rename `lord-claude.credentials` → `claudia-cos.credentials` ES PARTE de este scope (cross-repo BACKLOG entry separada del s18 turn 14 se subsume aca, refs en 33 archivos ya inventariadas).
  4. Pass-2 cold WA fresh sobre manifest concreto.
  5. Backup pre-apply: zip `impluxa-utils\` + zip `.secrets\lord-claude.credentials` original.
  6. Dry-run + CEO OK.
  7. Apply ordenado: READMEs primero (zero risk) → scripts Python (Edit per file) → ultimo PS1 → ultimo filename rename.
  8. Smoke tests Python-especificos OBLIGATORIO post-apply:
     - `python -c "from common.creds import *"` (import OK)
     - `python monitor.py --dry-run` o equivalente
     - `python send_voice.py --help`
     - `pwsh -NoProfile -File audit-decisions.ps1 -WhatIf`
     - Trigger Task Scheduler manual `LordClaudeHeartbeat /Run` + verificar LastTaskResult=0
- **Tipo**: T2.
- **Riesgo**: medio (Python regex sobre var names + modulos criticos). Mitigacion: backup + dry-run + Pass-2 cold + smoke tests.
- **Estimate**: 60-90 min sesion dedicada.
- **Beneficio**: consistencia vocabulario end-to-end docs ↔ scripts ↔ Task Scheduler ↔ credentials filename. Cierra brecha que s18 dejo abierta.
- **Closure target**: s19 (proxima sesion post-s18).
- **Closure criterion**: cero refs vocab viejo activas en `impluxa-utils\` + smoke tests Python verdes + Task Scheduler tasks running + filename rename completado + 33 refs cross-repo a `lord-claude.credentials` actualizadas a `claudia-cos.credentials`.
- **Dossier**: este entry.
- **Tripwire 1 (code TODO)**: NA.
- **Tripwire 2 (SPEC ref)**: NA.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: medio operativo (inconsistencia docs/Python persiste; var names rey_payload o similar siguen activos en scripts vivos).
- **Nota agregada s18 turn 22**: considerar `pending-rey-messages.jsonl` rename como parte del scope s19:
  - Si archivo activo runtime: rename involucra (a) rename file + (b) update refs en scripts Python (`monitor.py` + `send_voice.py` + etc) + (c) handle backwards compat con historial existente en el `.jsonl` (mensajes antiguos en el archivo viejo).
  - Si legacy/vacio: rename simple + update refs.
  - Verificar status archivo + decision tratamiento en s19 (paralelo a `lord-claude.credentials` rename ya inventariado).

- **Nota agregada s18 turn 30 — ampliacion scope s19 post-Wave B exclusion**:
  - **#3 `D:\segundo-cerebro\wiki\meta\heartbeat-monitor.md`** (doc descriptivo del monitor) → migrar coordinated con codigo Python subyacente. Wave B s18 classification linea-a-linea ya hecha (transcript turn 14) — usar como INPUT para s19, NO re-clasificar from scratch. Wave B classification preliminar: 11 lineas con vocab viejo, ~9 REPLACE narrativa + 4 MIXED filename-keep + 2 KEEP completo + 1 FLAG (line 77 evento pasado fechado, criterio REPLACE actor terms + KEEP timestamp+filename anchor aprobado CEO).
  - **`state.json` runtime schema migration**: keys del JSON activo escritas por `monitor.py` contienen vocab viejo: `identity.lord` → `identity.claudia` / `identity.rey` → `identity.ceo` / `consejo_validated.*` → `squad_validated.*` (verificar schema completo). Migration coordinated: actualizar (a) codigo Python que escribe el state + (b) codigo Python que lo lee + (c) state.json en sitio runtime + (d) doc heartbeat-monitor.md schema description. Riesgo: ventana mid-migration donde codigo escribe schema mixto (lee vocab nuevo + escribe vocab viejo o viceversa). Mitigacion: backup state.json pre-edit + apply orden codigo-reader → codigo-writer → state.json → doc.
  - **`TELEGRAM_CHAT_ID_REY` env var rename cross-repo**: descubierto Wave C s18 (go.md line 28 KEEP en b.now). Rename a `TELEGRAM_CHAT_ID_CEO` involves: (a) Vercel env update production+preview+development targets + (b) update refs codigo Python (`monitor.py`, `send_voice.py`, etc — verificar via sweep s19) + (c) update refs docs/.claude/commands/go.md + (d) deploys post-rename. Riesgo: deploy con env nuevo + codigo viejo crashea, deploy con codigo nuevo + env viejo crashea. Mitigacion: dual-read durante transition window (codigo lee ambos `_REY` y `_CEO`, prefiere `_CEO` si existe).

- **Criterio patron emergente s18**: "**Docs descriptivos de runtime/codigo migran coordinated con runtime/codigo, NO separados**". Razon: docs son representacion descriptiva de la realidad runtime. Si doc dice "schema X" pero runtime escribe "schema Y", la divergencia confunde a Claudia futura + auditorias + CEO. Aplica a: heartbeat-monitor.md (state.json schema), credentials docs, env var docs, scripts READMEs, runbooks que describen comportamiento Python/PowerShell. Aplicar este criterio en s19 + futuros vocab/schema migrations.

---

## [post-v0.2.6 ship] Vocab migration b.later scope reducido

- **Deferred from**: s18 sub-fase (b) decision CEO turn 19. Scope cross-boundary v0.2.6 active fase + memory topic files + impluxa-web docs/src.
- **Defer reason**: `.planning\v0.2.6\*` docs ACTIVOS fase en curso (PLAN.md 98 + SPEC 27 + SECURITY-REVIEW 21 + CONTEXT 16). Migrar AHORA confunde contexto v0.2.6. Mejor post-ship. Memory topic files mayoria CITAS HISTORICAS lessons cerradas (probable KEEP global, revision selectiva).
- **Scope b.later:**
  - `D:\impluxa-web\.planning\v0.2.6\*` (PLAN + SPEC + SECURITY-REVIEW + CONTEXT + W1.T1-5B-_ + W1.T2-DESIGN-_ + RESEARCH + db-first-pass + ROADMAP)
  - `D:\impluxa-web\docs\runbooks\*` vigentes (auth-incident-response + v0.2.6-rls-burn-rollback + audit-log-partition-management + dmarc-monitoring)
  - `D:\impluxa-web\docs\security\*` vigentes (secret-rotation + env-var-usage)
  - `D:\impluxa-web\src\*` codigo (tests + scripts + templates + emails — selectivo, mayoria string literals usuario-facing requieren review producto)
  - Memory topic files `feedback_*/reference_*/lesson_*` revision selectiva (verificar referenciados runtime vs solo lectura humana; mayoria CITAS HISTORICAS KEEP).
- **Excluido b.later:**
  - ADRs cerrados por naturaleza (timestamp + decision registrada).
  - `.planning\v0.2.5\*` cerrado.
  - CHANGELOG cita historica versiones.
  - `D:\segundo-cerebro\backups\*` snapshots numerados.
  - `Vision Casa Habitable -- Plan Reino Impluxa.md` historico pre-pivot.
- **Tipo**: T2.
- **Riesgo**: bajo-medio (docs vigentes + tests + code requiere review producto en string literals).
- **Estimate**: 90-120 min.
- **Closure target**: post-v0.2.6 ship.
- **Closure criterion**: cero refs vocab viejo activas (no CITAS HISTORICAS) en scope b.later + tests verdes post-edit.
- **Dossier**: este entry.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: bajo operativo. Cognitivo medio (vocab inconsistente en docs vivos persiste).

---

## [POST-b.now s18 PRIORIDAD ALTA] Fix L8 session-boot.md YAML unparseable

- **Deferred from**: s18 turn 33-34 Pass-2 cold WA retroactivo `ab92e1ccb091a684c` hallazgo NOTED.
- **Defer reason**: Pre-existente (NO introducido por Wave D D.1 Edits s18). Bootstrap protocol Sec 11 CLAUDE.md mitiga si /boot falla parseando YAML, pero NO es solucion permanente. Cualquier futura edicion frontmatter session-boot.md puede empeorar el problema.
- **Detalle**: `session-boot.md` L8 `current_phase:` value contiene `target=['production']` + URLs con colones sin quotes → YAML `mapping values not allowed`. Frontmatter completo parseable salvo este field.
- **Prioridad**: **ALTA** (no T-cuando-emerja vago). Antes de la proxima edicion frontmatter session-boot.md.
- **Tarea**:
  1. Read L1-19 frontmatter session-boot.md.
  2. Quote value `current_phase:` con triple-quote YAML literal `|-` o single-line `"..."` con escape de colones.
  3. Validar parseable via `python -c "import yaml; yaml.safe_load(open('session-boot.md').read().split('---')[1])"`.
  4. Test `/boot` flow no falla parse.
- **Tipo**: T1 docs.
- **Riesgo**: bajo (frontmatter solo, sin codigo afectado).
- **Estimate**: 5-10 min.
- **Beneficio**: /boot YAML parser no triggera bootstrap protocol fallback innecesario. Garantia parseable cross-tooling.
- **Closure target**: ANTES de la proxima edicion frontmatter session-boot.md (sesion siguiente).
- **Closure criterion**: yaml.safe_load() del frontmatter retorna dict sin exception + /boot parsea correcto.
- **Dossier**: este entry.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: medio (proxima edicion frontmatter session-boot empeora corrupcion potencial; bootstrap protocol Sec 11 cubre fallback pero genera friction operativa al arrancar sesion).

---

## [POST-s19 PRIORIDAD MEDIA] monitor.py credentials read fail = silencioso Telegram (alerta cascada faltante)

- **Deferred from**: s19 P0 verificacion empirica CC-10 (Two-Pass extended Pass-2 cold SE `af57dace4fef85fee` + DevOps `ae0cbb3d338bc8130` flag inicial, CEO challenge "VERIFICA empirico" expuso false-alarm parcial).
- **Defer reason**: Pre-existente (NO introducido por sweep vocab s19). Verificacion empirica `D:\impluxa-utils\heartbeat-monitor\monitor.py`:
  - **Line 43**: `CREDS_PATH = Path(os.path.expandvars(r"%USERPROFILE%\.secrets\lord-claude.credentials"))`
  - **Line 54-57**: SI tiene `try:` ... `except OSError:` sobre `CREDS_PATH.read_text()`
  - **Line 66**: `raise RuntimeError("missing credentials")` si regex token/chat no match
  - **Line 109+**: funcion `_telegram_send()` existe pero NO se llama desde except branch line 57 ni desde raise line 66
- **Resultado**: fail visible en Task Scheduler history (exit code != 0), silencioso en Telegram. Squad Pass-2 cold asumio "no try/except" — verificacion empirica corrigio (SI tiene try, NO tiene Telegram alert on fail).
- **CEO decision modo prueba s19**: (b) aceptar riesgo. Justif: try/except YA existe → no crash silencioso; sweep s19 monitoreado CEO en vivo; ausencia tick Telegram proxima ventana 3min → CEO nota → check Task Scheduler history → rollback.
- **Closure target**: post-s19 dedicated 30min fix.
- **Closure criterion**: `monitor.py` agrega Telegram bot send on `RuntimeError("missing credentials")` + on `OSError` except branch. Test integration: simular credentials file ausente → verify Telegram message recibido por CEO.
- **Dossier**: lesson `monitor-py-credentials-fail-silencioso-telegram` (a crear en `C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\`).
- **Tripwire 1**: `D:\impluxa-utils\heartbeat-monitor\monitor.py` line 54-57 + line 66 (TODO comments a agregar al fix).
- **Tripwire 2**: este BACKLOG entry.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: bajo modo prueba `hakuna_live=false` con CEO monitoreo activo. Medio cuando `hakuna_live=true` (heartbeat down silencioso = sin observabilidad de IDs activos / sin polling Telegram incoming).
- **Estimate**: 30min (wrap read en try/except + Telegram send + verify simulacro fail).

---

## [POST-s19 PRIORIDAD MEDIA] Paquete dual texto+audio cierre Sec 6 — monitorear antes codificar

- **Deferred from**: s19 take-1 cierre Sec 6 dual texto+audio operacional (Piper TTS local voz `es_AR-daniela-high` en `D:\impluxa-utils\piper-tts\`). msg_id=104 Telegram audio enviado al cierre take-1.
- **Defer reason**: Paquete dual texto detallado + audio narrativo cierre Sec 6 operacional desde s19, pero **uso real <5 cierres**. Codificar CLAUDE.md v2.2 Sec 6 prematuro per principio "uso real antes de refinar". Esperar 3-5 cierres reales para evaluar: (a) si paquete dual mantiene valor consistente vs friccion operativa Piper TTS, (b) si voz `es_AR-daniela-high` resulta apropiada o requiere ajuste tono, (c) si separacion texto verdad / audio comunicacion (CEO ratifico s19) se sostiene como criterio claro, (d) si emergen patches operacionales nuevos (Pattern caso fundacional s10a).
- **Closure target**: cuando se acumulen 3-5 cierres reales con paquete dual aplicado.
- **Closure criterion**: review meta de los 3-5 cierres → decision codificar Sec 6 CLAUDE.md como protocolo formal (formato exacto + cuando aplica + voz default + fallback texto-only) o ajustar/descartar segun evidencia. Si valor sostenido: codificar CLAUDE.md v2.2 Sec 6 ampliacion. Si valor inconsistente: documentar lesson + DEFER nuevamente.
- **Dossier**: lesson `feedback_telegram_tts_saliente_pipeline.md` + Sec 11 CLAUDE.md voice pipeline. Cierres tracked en hot.md + decisions_log session-boot.md.
- **Tripwire 1**: contador cierres con paquete dual aplicado (incrementar al hot.md o session-boot.md por cierre real).
- **Tripwire 2**: `D:\segundo-cerebro\wiki\meta\hot.md` Active Threads (mencionar review pending).
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: bajo. Modo prueba `hakuna_live=false`. Codificacion prematura sin evidencia uso real podria fijar protocolo sub-optimo. Defer mantiene flexibilidad ajuste.
- **Estimate**: 30-60min review meta + edit CLAUDE.md Sec 6 cuando llegue trigger.
- **Inconsistencia conocida s19 take-1**: audio msg_id=104 enviado con conteo "19 acumulados" snapshot momento envio. Take-2 corrige archivos a "20 acumulados" (Item 6 Patron 3 + ajustes). Aceptamos inconsistencia minor audio vs archivos. **Criterio reforzado**: audio = comunicacion (snapshot), archivos = verdad (vigente). NO re-enviar audio para reconciliar — anota inconsistencia en hot.md o BACKLOG.

---

## POST-Fase-1.6 — Compactacion MEMORY.md target <22KB — **COMPLETED 2026-05-22 ~14:30 PARCIAL**

- **Status**: SHIPPED parcial. 30,247B → **23,565B (-22.1% / -6,682B)**. Bajo cap warning 24,400B con margen 835B (3.4%). Target hard <22KB NO cumplido (+1,565B over) por Opcion A CEO: disciplina vocab migration > hard target numerico.
- **Squad**: Two-Pass extended Pass-1 Senior PM `ad0663bee1b60b499` + Pass-2 cold WA `aa0de9de485d9b6f9` (descarto target PM 15KB OVERKILL → sweet spot 19-21KB ajustado a 23.1KB realista).
- **Batches ejecutados**: 5 secuencial con checkpoint H4 ±15% post cada batch + backup `MEMORY.md.backup-pre-compact-s_fase-1.6-cierre-20260522.md`. Batches 1+4 STOP H4 legitimo (PM over-estimation 40% bytes ANTES → re-calibracion awk; BORDERLINE-DEFER finding emergente). Batches 2/3/5 PASSED <15% variance.
- **Preservados KEEP-FULL**: C1 Lessons Fase 1.6 (6 entries linea 54-59) + C7 menu-en-vez-de-recomendar (linea 117).
- **Sub-item DEFER sweep s19b**: **15 entries MEMORY.md DEFER por vocab viejo inline (Rey/Lord/Reino/Consejo)** — compactar post-migration vocab completada. 8 lessons C6 (lineas 99 declarar-veredicto / 106 pedir-mano-rey / 108 propuse-solucion-grande / 116 recomendacion-sin-consejo / 118 Hakuna fotos / 120 esperar-ok-rey-t2 / 121 preguntar-proxima-tarea / 122 3h-silencio-telegram) + 7 B Bloque (29 Credenciales Lord Claude / 30 Protocolo v6.0 / 31 Capabilities matrix "reino" / 37 Modelo ejecucion / 38 Sentinel preflight / 39 Force-signout / 47 Pull-forward). Estimate compactacion DEFER sub-item: ~1h post-sweep s19b vocab migration.
- **Spot-check 10 entries random**: PASSED post-write.
- **Dossier**: precedente metodologia s16 batch (47 edits 30,626B→22,386B = -26.9%) + actual fase-1.6 (35 edits 30,247B→23,565B = -22.1%, gap por DEFER vocab).

---

## [post-v0.2.6 W2 cierre] B10.1 — WAL spike protection revisit pre-Hakuna-live

- **Deferred from**: s_W2_burn_preview cierre (sesion 2026-05-23), post-Bug 2 architectural blocker Opcion A.
- **Defer reason**: migration `20260525_v026_004_audit_dedup_procedure_no_commit` resolvio Bug 2 (pg_cron Supabase managed `cron.use_background_workers=off` context=postmaster → SPI wraps tx → procedure COMMIT loop ERROR 2D000) reemplazando procedure-con-COMMIT-loop por function single-tx batched DELETE LIMIT 10000 ctid IN. Trade-off acordado CEO: pierde B10.1 batched-COMMIT WAL spike protection (originalmente: 10K-row chunks + COMMIT inter-batch para liberar WAL pressure + lock_timeout 5s + statement_timeout 30min). Aceptable mientras `hakuna_live=false` + audit_dedup empty + sin volumen real Hakuna. Discovery parcial sesion 2026-05-23 confirmo Opcion C (ASK Supabase support enable toggle) colapsa (managed-blocked, alta prob denegacion, `pg_settings` + Supabase docs + GitHub discussion #30168 + Answeroverflow caso publico). Edge Function scheduled (Opcion B path) preserva COMMIT semantics via autocommit context supabase-js → unico path managed con B10.1 preservacion completa. Revisit obligatorio pre-Hakuna-live independiente de threshold.
- **Closure target**: v0.3.x — sesion candidate pre-flipeo `hakuna_live: true`.
- **Closure criterion**: una de:
  - (a) **Threshold reached**: metric empirico `SELECT count(*) FROM public.audit_dedup WHERE first_seen_at < public._audit_dedup_gc_cutoff()` > 50K rows en cualquier check (DBO threshold proxy "GC no keeping up con LIMIT 10K daily") O `pg_stat_user_tables.n_tup_ins` audit_dedup growth rate > 5000/dia sostenido 7d → ejecutar migracion v0.3.x Edge Function scheduled path con tests integration verde + Sec 3 ASK CEO merge main.
  - (b) **Pre-Hakuna-live unconditional revisit**: evaluar volumen audit_dedup esperado post-flipeo + decidir entre mantener Opcion A (si volumen << 10K/dia) o migrar Opcion B Edge Function. Decision CEO con discovery actualizada Supabase Edge Functions scheduled API + costo + cold start impact + retry semantics.
- **Dossier**:
  - `D:\impluxa-web\supabase\migrations\20260525_v026_004_audit_dedup_procedure_no_commit.sql` header completo (Bug 2 context + 3 opciones + trade-off B10.1 + threshold metric).
  - `D:\segundo-cerebro\wiki\meta\session-boot.md` entry "W2 burn rewrite Opcion A pre-write empirical check (sesion 2026-05-23 cont.)" — Discovery C colapso + Squad fresh Pass 1+2 cold + decision A.
  - Web references: Supabase Cron docs / pg_cron debugging guide #n1KTaz / GitHub discussion #30168 / Answeroverflow `use_background_workers off` caso publico / Scheduling Edge Functions docs.
- **Tripwire 1 (code TODO)**: `D:\impluxa-web\supabase\migrations\20260525_v026_004_audit_dedup_procedure_no_commit.sql` linea ~75 (comment `LIMIT 10000 hard-coded function body` + `Threshold metric revisit (DBO): count(*) audit_dedup expired > 50K backlog`).
- **Tripwire 2 (SPEC ref)**: pendiente actualizar `D:\impluxa-web\.planning\v0.2.6\SPEC.md` con Bug 2 resolution Opcion A + B10.1 deferral nota — sesion siguiente W2.bis o pre-merge main.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: medio si volumen real Hakuna pre-flipeo bajo (esperado <<10K/dia near-term). Alto si flipeo `hakuna_live=true` sin revisit ni metric setup — function correria sin proteccion WAL spike bajo volumen alto sostenido (replica lag visible operacional). Mitigacion costo cero: medir count + n_tup_ins en cierre pre-flipeo. Owner CEO decide al boot sesion v0.3.x candidate.

---

## [post-v0.2.6 W2 cierre] W2.bis-g4-FK — `audit-dedup-bypass-non-tenant-action` integration tests fail FK constraint (pre-existing test setup defect, NO Bug 2 regression)

- **Trigger**: sesion s_sec3_merge_main 2026-05-23 sub-paso 2 vitest run g1+g2+g4 reveals 3/3 g4 tests fail con `audit_log_actor_user_id_fkey` violation (`Key (actor_user_id)=<randomUUID> is not present in table "users"`).
- **Root cause**: tests `audit-dedup-bypass-non-tenant-action.integration.test.ts` lines 75-149 usan `randomUUID()` para `actor_user_id` que NO existe en `auth.users`. FK constraint on `audit_log` partitions (v0.2.5 schema, unrelated to W2 burn) rechaza insert.
- **Validation evidence pre-existing**: append_audit signature backcompat verified via Supabase MCP execute_sql en W1.T2 session (session-boot.md L60), pero esa validation fue para `burn-readiness-events.integration.test.ts` (diferente scope). g4 tests fueron escritos pre-merge W2 (sesion 2026-05-23 ~16:00 write paso (e)) y NO corridos via vitest hasta sub-paso 2 s_sec3_merge_main.
- **NOT a Bug 2 regression**: append_audit signature unchanged en v026_004 (BA confirmed line-by-line review, `returns bigint` preservado). g4 fail es test setup defect, NO toca production write path. PR W2 burn DOES NOT introduce this defect.
- **Fix scope**: ~30-45 min (seed fixture user in `beforeAll` con `service.rpc('admin.create_user')` o equivalent insert auth.users + cleanup en `afterAll`). Alternativa: cambiar FK constraint a nullable `actor_user_id` (more invasive, v0.2.5 schema change → NO).
- **Owner**: Claudia + Squad PM/BA fresh dedicated session (W2.bis ticket cubre este + tests adapt signature `select` no `call` ya identificado redundant per BA Pass-1 discovery 2026-05-23 s_sec3_merge_main).
- **Risk if defer slips**: bajo. Tests no bloquean merge main (CI no corre integration tests per session-boot SE finding `ci.yml` L13-21). Risk solo si Hakuna live cambia volumen y desplegamos prod sin verde local de g4 — defect cosmético no impacta runtime.
- **Tracking**: documentar en PR W2 burn description como known-failing test post-merge, fix en W2.bis dedicated session pre-flipeo `hakuna_live: true`.

---

## [W2.bis-CATALOG-PATCHES] catalog v4 4 anotaciones revisit detectadas P7 validacion empirica Fase 1.6

- **Deferred from**: Fase 1.6 catalog v4 P7 validacion empirica (sesion s_fase_1_6_catalog_v4 2026-05-23).
- **Trigger**: P7 validacion 7 tareas test diversas reveló 6/7 PASS + 1 PARTIAL (PRD query) + 4 anotaciones revisit honest sobre clasificación post-patch ronda-2 ECC. Scope discipline PM Sec 3 → revisit DEFER, NO scope creep dentro Fase 1.6 actual.
- **4 anotaciones revisit individuales**:
  - (a) **`nextjs-turbopack` archive → deberia MEDIUM o HIGH**: Impluxa stack es Next.js. Patch ronda-2 ECC clasificó archive por substring `nextjs-turbopack` → lang/specialty-archive bucket. False negative: Next.js stack core Impluxa. Decision revisit: MEDIUM (Turbopack feature-specific) o HIGH (si CEO confirma uso Turbopack vs Webpack default).
  - (b) **`prp-prd` MEDIUM → deberia HIGH**: PRD workflow CoS crítico (writing-plans superpowers HIGH alias). Patch ronda-2 downgrade MEDIUM por bucket adjacent-medium. P7 query 4 ESCRITURA PRD NO retornó `prp-prd` top-3 (gap detectable).
  - (c) **`diagnose` duplicate entries verify**: P7 query 5 DEBUG retornó 2 entries `diagnose` HIGH consecutivos (catalog v4 lines 103+104). Verify si son: (i) index maestro + section row legit (no dup) o (ii) dual-listing mkt:context-mode + custom (dup verdadero requiere dedup).
  - (d) **`claude-obsidian:save` no top T7 query**: P7 query 7 META cierre+MEMORY NO retornó `save` claude-obsidian top-5 (esperado HIGH per P5 manual). Verify catalog v4 actual nivel + grep pattern correcto.
- **Closure target**: Fase 1.7 catalog v5 dimensiones avanzadas O post-vocab-sweep sesion limpia.
- **Closure criterion**: 4 patches aplicados (regex override) + spot-check ronda-3 sobre estos 4 items + re-run P7 7 tareas confirma 7/7 PASS + dedup section catalog v4 si aplica.
- **Dossier**: session-boot.md entry "Fase 1.6 catalog v4 CERRADA / P7+P8 DONE / cierre Sec 6 dual" item 2.
- **Tripwire 1 (code TODO)**: N/A.
- **Tripwire 2 (SPEC ref)**: N/A.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: bajo. 4 mis-clasificaciones aisladas en catalog v4, no afectan invocacion skills (Claude Code resuelve por nombre exact independiente del nivel catalog). Solo afecta auditoria visibility/priority sugerida. Aceptable defer hasta proxima sesion catalog dedicated.

---

## [W2.bis-CLEANUP-1] `~/.claude/plugins/claude-banana/` — proyecto stand-alone no-plugin, candidato remove

- **Deferred from**: Fase 1.6 catalog v4 P1 Discovery (sesion s_fase_1_6_catalog_v4 2026-05-23).
- **Trigger**: P1 enumeracion plugins marketplace detecto carpeta `~/.claude/plugins/claude-banana/` (mtime 2026-05-08) que NO es plugin Claude Code estandar.
- **Findings P1 (4 criterios objetivos veto)**: (a) NO `.claude-plugin/marketplace.json` (no manifest plugin format), (b) NO en `enabledPlugins` settings.json, (c) naturaleza proyecto stand-alone Anthropic-style starter "AI image prompt engineering agent" (Gemini Nano Banana Pro / Imagen / etc), (d) NO invocable como skill/plugin desde Claude Code — vive con `agents/prompt-architect/` + `knowledge/` (prompt formulas) + `scripts/` Python (`batch.py/edit.py/generate.py/validate_setup.py`) + `presets/` + `templates/`.
- **Razon defer scope discipline Fase 1.6**: catalog v4 alcance = audit plugins marketplace enabled. claude-banana NO encaja criterio inclusion. Cleanup decision separada, NO scope creep dentro Fase 1.6.
- **Closure target**: W2.bis dedicated session post-Fase-1.6 catalog v4 SHIPPED.
- **Closure criterion**: una de:
  - (a) **CEO confirma uso activo** del prompt-architect agent o knowledge base prompt engineering Gemini Nano Banana Pro → mantener carpeta + documentar uso explicit en MEMORY.md reference entry + considerar migrar a marketplace format Claude Code estandar (skill agent) si CEO quiere invocable desde sesion.
  - (b) **CEO confirma no uso** → `Remove-Item -Recurse -Force C:\Users\Pablo\.claude\plugins\claude-banana` (~3MB disco free) + commit log decision_log + registro session-boot.md sub-section "P1 Discovery cleanup post-decision".
- **Dossier**: session-boot.md entry "Fase 1.6 catalog v4 P1 Discovery DONE (sesion s_fase_1_6_catalog_v4 2026-05-23)" item 8.
- **Tripwire 1 (code TODO)**: N/A (codigo externo Impluxa).
- **Tripwire 2 (SPEC ref)**: N/A.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: cero operacional. Carpeta no interfiere con plugins activos ni con catalog v4 (esta excluida explicit por veto criterio). Solo ocupa ~3MB disco C:. Defer indefinido es aceptable si CEO no recuerda haberlo instalado o no toma decision — esta entry sirve como recordatorio persistente.

---

## [W2.bis-FASE-1.7.5-MUTATIONS-EXEC] Ejecución mutations runtime — SKILL.md upstream marketplace + catalog re-classifications/adds + DETECTION_SIGNAL v40 codify

- **Deferred from**: Fase 1.7 Triggers Audit P5a-doc (sesión s_fase_1_7_triggers_audit 2026-05-23) post RE-PLAN-2 honest re-frame doc-only (finding CASO B blind-spot intent-vs-plan resuelto: catalog metadata-only NO afecta runtime auto-fire, requiere SKILL.md disco edits).
- **Trigger**: Fase 1.7 mid-session descubrió que catalog v4.1 metadata-only es doc-only (Claude Code runtime lee SKILL.md disco directo, NO catalog wiki). Threshold 90% match-rate movido a Fase 1.7.5 post-mutation runtime real. Validacion empírica intra-Fase-1.7: edit custom SKILL.md disco SI hot-reload mid-session (fixing-motion-performance confirmado via system reminder skill list refresh).
- **Scope Fase 1.7.5 propuesto** (input pre-built):
  - **(a) 4 ECC marketplace SKILL.md upstream patches** — supply-chain assessment formal required:
    - `api-design` (gap #1 Next.js routes) — recommendation rewrite Fase 1.7 P5a section A1
    - `postgres-patterns` (gap #27 SQL writing + #28 scaling) — recommendation A2
    - `deployment-patterns` (#16 Vercel preview) — recommendation A4
    - `github-ops` (#18 CI optimization) — recommendation A5
    - **Riesgo supply-chain**: próximo `claude plugin update` ECC sobreescribe edits. Mitigación: verificar si Claude Code soporta "override file" pattern + documentar re-apply procedure si update sobreescribe.
  - **(b) 1 context-mode mkt duplicate**: `improve-codebase-architecture` dup en context-mode marketplace (custom ya editada en Fase 1.7 sub-task bonus). Decision: sincronizar mkt dup o defer si runtime priority custom > mkt.
  - **(c) 4 catalog gaps re-classifications/adds** — recommendation Fase 1.7 P5a section B:
    - B1: `python-patterns` MEDIUM→HIGH (evidencia uso real pedido #2)
    - B2: `canary-watch` archive→HIGH (evidencia #19)
    - B3: `plan` ECC slash-cmd → AGREGAR HIGH catalog v4.x (scenario (a) confirmado parcial)
    - B4: `test-coverage` ECC slash-cmd → AGREGAR HIGH catalog v4.x (scenario (a) confirmado parcial)
  - **(d) 4 AMBIG-OK trios disambiguation arquitectural** (decision CEO required):
    - `tdd` custom × `test-driven-development` superpowers × `tdd-workflow` ECC
    - `prp-prd` ECC × `to-prd` custom × `product-lens` ECC
    - `write-a-skill` custom × `skill-creator` anthropic × `skill-create` ECC
    - `aprende` custom × `learn` custom alias × `learn-eval` ECC
  - **(e) DETECTION_SIGNALS.md update con v40**: "Draft mutating documentation/index/catalog file que pretende afectar runtime behavior sin verify previo que runtime read ese file → STOP". Path canonical: `C:/Users/Pablo/.claude/projects/C--Users-Pablo/memory/DETECTION_SIGNALS.md`. (Si Fase 1.7 P8 no incluye, hacer aquí.)
  - **(f) Cross-link Fase 1.7b agents clarity-audit**: 62 agents HIGH clarity protocolo separado — coordinar con Fase 1.7.5 o ejecutar sequential.
- **Pre-requisitos Fase 1.7.5**:
  - **CEO approval**: scope (a) supply-chain assessment ECC marketplace edits = gravedad ALTA Sec 3 ASK CEO formal con risk assessment
  - **Catalog v4.1 metadata** (Fase 1.7 P7 output) shipped como input doc
  - **Threshold 90% match-rate verificable post-mutation**: re-test 30 pedidos blind original + nuevos pedidos blind si test suite stale
- **Tiempo estimado**: 4-6h activa (1.5h supply-chain assessment + 1.5h ECC patches + 1h catalog re-class + 1h re-test + 1h cierre)
- **Dossier**: `D:/segundo-cerebro/meta/fase17-p5a-patches-doc.md` (6 recommendations + 4 gaps detallados) + `D:/segundo-cerebro/meta/fase17-p4-self-test-results.md` (M0 baseline + categoría stats)
- **Tripwire 1 (code TODO)**: N/A (mutaciones SKILL.md disco + catalog wiki)
- **Tripwire 2 (SPEC ref)**: N/A
- **Tripwire 3 (this BACKLOG entry)**: present
- **Risk if defer slips**: medio. Auto-fire mal-disparado en categorías data 50% / infra 62.5% / código 66.7% afecta operación Hakuna live (skills incorrectas se invocan, Claudia toma decisiones sub-óptimas). Pre-Hakuna-live aceptable defer con M0 73.3% baseline conocido + diagnóstico claro priorizar. Post-flipeo Hakuna live sube prioridad.
- **Lesson aplicada**: `fix-arquitectural-sin-testear-framework-wrapper` 4ta ocurrencia cross-domain (DB pg_cron 3 + catalog vs SKILL.md runtime 1). Pre-Fase-1.7.5 mandatory: verify per layer wrapper (catalog wiki vs SKILL.md disco vs runtime auto-fire engine) ANTES de proponer mutations.

---

## [W2.bis-DETECTION-SIGNAL-V40-CODIFY] Codify detection signal v40 en DETECTION_SIGNALS.md

- **Deferred from**: Fase 1.7 Triggers Audit re-plan turno 2026-05-23 (caso B blind-spot detectado mid-fase).
- **Trigger**: Fase 1.7 plan inicial WA propuso "catalog v4.1 metadata-only" como output. Yo y CEO aprobamos sin verificar empíricamente que Claude Code runtime lee catalog wiki (no lo lee — lee SKILL.md disco). Resultado: 9-12h plan parcial sin efecto runtime hasta surface mid-fase.
- **Signal v40 candidato**: "Draft mutating documentation/index/catalog file que pretende afectar runtime behavior sin verify previo que runtime read ese file → STOP. Test minimal: ¿qué archivo lee runtime para esta capability? Verify ANTES de proponer mutation a archivo diferente."
- **Path canonical**: `C:/Users/Pablo/.claude/projects/C--Users-Pablo/memory/DETECTION_SIGNALS.md` (6526B, mtime 2026-05-16. NO existe en D:/segundo-cerebro/meta/ — corrección path CEO mencionó en turno).
- **Closure target**: Fase 1.7 P8 cierre (si time-box permite) o W2.bis dedicated sub-task next session (15min).
- **Closure criterion**: signal v40 escrito DETECTION_SIGNALS.md + version bump frontmatter + cross-ref lesson `fix-arquitectural-sin-testear-framework-wrapper`.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: medio. Sin signal codificado, próxima fase mutando documentation/catalog/index sin verify runtime read repetirá el mismo blind spot. Cost defer: 1 fase repite el error.

---

## [W2.bis-FASE-1.7B-AGENTS-CLARITY-AUDIT] 62 agents HIGH clarity-audit + col `kind` catalog v4.x estructura

- **Deferred from**: Fase 1.7 Triggers Audit P3 SHIPPED (sesion s_fase_1_7_triggers_audit 2026-05-23) post-CEO recomendacion firme A (restringir Fase 1.7 a 101 items triggerable).
- **Trigger**: P3 empirical disco resolution revelo catalog v4 HIGH 163 = mezcla heterogenea 3 kinds (98 SKILL.md + 62 agent + 3 slash-command). Agents tienen activacion semantica distinta (subagent_type explicit Agent tool, NO trigger keyword match cabeza Claudia auto-fire). Aplicar mismo audit protocolo trigger-keyword-match a agents = category error (62 falsos negativos garantizados en test suite blind castellano natural).
- **Findings P3 empirical (V2 parser fixed CRLF custom files)**: 62/62 agents tienen description STRONG por construccion (median 216 chars, min 103, max 331, todos rango 80-400 STRONG, 0 MISS / 0 WEAK / 0 OVER). Calidad documentation agents uniformemente alta vs SKILL.md 98 items (2 WEAK + 13 OVER fuera rango). Implicacion: agents NO requieren patches por longitud — requieren audit clarity + uniqueness + overlap-with-SKILL.md homonimos (ej. agent `Backend Architect` vs SKILL.md `engineering-backend-architect` slash o `backend-patterns` skill).
- **Razon defer scope discipline Fase 1.7**: Fase 1.7 scope CEO explicit "triggers para skills se disparen correcto cuando Claudia procesa tarea auto". Agents no cumplen esa definicion. Auditar separadamente con protocolo apropiado = mejor rigor que mezclar.
- **Closure target**: Fase 1.7b dedicated session post-Fase-1.7 cerrada, o consolidar con W2.bis-CATALOG-PATCHES si scope alineable.
- **Scope propuesto Fase 1.7b**:
  - (a) Audit 62 agents HIGH: clarity check + uniqueness check + overlap detection vs 98 SKILL.md + 3 slash-cmd HIGH (potential disambiguation patches descriptions agents si overlap >40% Jaccard).
  - (b) Catalog v4.x estructura: agregar col `kind` (SKILL.md / agent / slash-command) en index maestro + secciones per kind separadas. Cost low (~30min mutation), benefit: futuras fases audit NO re-descubren empirico kind distribution.
  - (c) Validar el universo MEDIUM 89 + LOW 90 + archive 92 NO contiene agents perdidos (asegurar 62 = total agents HIGH definitive).
- **Tiempo estimado Fase 1.7b**: ~1.5-2h activa (60min agent audit + 30min catalog v4.x col kind + 30min validation universo MEDIUM/LOW/archive + 30min cierre).
- **Dossier**: session-boot.md entry "Fase 1.7 Triggers Audit P3 SHIPPED" + decision CEO A turn 14 sesion 2026-05-23 + temp output `C:/Users/Pablo/AppData/Local/Temp/fase17_high_frontmatters.json` (163 enriched preservado, NO cleanup until Fase 1.7b consume).
- **Tripwire 1 (code TODO)**: N/A (codigo externo Impluxa, mutaciones catalog `.segundo-cerebro`).
- **Tripwire 2 (SPEC ref)**: N/A.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: bajo. 62 agents activos funcionando correctamente (descripciones STRONG, invocacion explicit subagent_type OK). Defer agents audit NO afecta operacion sesion Hakuna live. Solo gap auditoria visibility (no se sabe si hay overlap silencioso entre agent `Security Engineer` y skill `security-review` para test mental Claudia). Pre-Hakuna live aceptable defer; post-incidente puede subir prioridad si Claudia confunde agent vs skill en triage real.
- **Lesson candidate vigilancia**: `catalog-mezcla-kinds-empirico-altera-audit-scope` (1era ocurrencia 2026-05-23 Fase 1.7 P3). Si 2 ocurrencias mas futuros catalog audits → codificar formal MEMORY.md.

---

## [W2.bis-B4-RESIDUAL] Vocab migration residual doc-only 58 actionable cross-repo

- **Deferred from**: s19b P7+P8+P9 apply impluxa-web subset (2026-05-25). Scope finding pre-empirical-check P7.0 (5to uso lesson `pre-empirical-check-pre-mutation-generalizado`) detecto v5.1 consolidated scope cruza 3 repos: impluxa-web (62 actionable runtime-critical) + impluxa-utils (45 doc-only B2 READMEs) + segundo-cerebro/wiki/meta (13 doc-only B1 hot.md + heartbeat-monitor.md). Plan v2 asumio single-repo single-feature-branch — incorrect. CEO Opcion A: apply impluxa-web esta sesion (cierra 4/4 pre-flipeo Hakuna live blockers runtime-critical), defer 58 doc-only post-Hakuna-live.
- **Defer reason**: B2 utils READMEs + B1 segundo-cerebro markdown son doc-only sin afectar runtime/build/Vercel/deploy. Blocker pre-flipeo Hakuna live era runtime-critical (codigo + runbooks + scripts), no doc-completeness. Aplicar runtime-critical primero respeta espiritu del blocker. Doc-only puede continuar post-Hakuna-live sin riesgo operacional.
- **Closure target**: post-Hakuna-live, sesion dedicada vocab-residual o split en 2 sub-sesiones (utils + segundo-cerebro).
- **Closure criterion**:
  - B2 impluxa-utils: 4 README.md actualizados (45 actionable) en branch separate impluxa-utils repo + PR + merge. Grep verify post-merge: 0 active `Rey|Lord Claude|Reino|Consejo` outside KEEP zones en `D:/impluxa-utils/**/*.md`.
  - B1 segundo-cerebro: 2 markdown actualizados (~13 actionable) en `D:/segundo-cerebro/wiki/meta/{hot.md,heartbeat-monitor.md}` commits direct knowledge base (no PR flow). Grep verify: 0 active outside KEEP.
- **Dossier**: `D:/impluxa-web/.planning/vocab-migration/s19a-take2-p5b-CONSOLIDATED-v5.md` (entries B1 + B2 ya clasificadas v5.1).
- **Tripwire 1 (code TODO)**: N/A (doc-only, no codigo).
- **Tripwire 2 (SPEC ref)**: N/A.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: bajo. Vocab nuevo (CEO/Claudia/Impluxa/Squad) ya prevalece runtime-critical impluxa-web. Doc-only inconsistency en utils/segundo-cerebro es cosmetic, no operational. NO bloquea Hakuna live flip.
- **Lesson aplicada**: `pre-empirical-check-pre-mutation-generalizado` 5to uso consecutivo cross-sesion (saved 4-5h overshoot 3-repo apply + Squad blind-spot honest declarado).

---

## [W2.bis-VERIFY-SCRIPTS-PIPESTATUS] Exit code bug pattern `cmd | tail $?` — verify scripts hygiene

- **Deferred from**: s19b P8.2 build verify (2026-05-25). Bash script con `npm run build 2>&1 | tail -40 ; echo "BUILD_EXIT=$?"` captura exit code de `tail` (siempre 0) en lugar de `npm run build` (real exit code). Falsa señal "BUILD_EXIT=0" mientras build realmente fallaba con env-guard error. Cachado por Claudia honest-declaration pre-claim SHIPPED (no propagado regression silenciosa).
- **Defer reason**: instancia UNICA observable. NO lesson formal aun (regla 3+ ocurrencias). Nota tracking para mejorar hygiene scripts futuros.
- **Closure target**: cualquier sesion futura con verify scripts shell.
- **Closure criterion**: verify scripts shell capture exit code via PIPESTATUS array (`${PIPESTATUS[0]}`) o variable explicit pre-pipe (`cmd; CODE=$?; echo "$CODE" | tail`) en lugar de `cmd | tail $?`. Patron aplicable a npm/tsc/curl/git verifies.
- **Dossier**: N/A (1 line nota).
- **Tripwire**: 3 ocurrencias futuras → codificar lesson formal `verify-scripts-exit-code-pipestatus`.
- **Risk if defer slips**: bajo. Patron habit auto-correctible cuando Claudia detecta falsa señal verde mid-flow.

---

## [W2.bis-HOST-ROUTING-PREVIEW-BASELINE] Vercel preview hostnames vs custom domain 200/404 divergence — baseline-check obligatorio pre-claim regression

- **Deferred from**: s19b P8.5 Vercel preview smoke (2026-05-25). Smoke GET / sobre preview URL `*.vercel.app` returns 404 Next.js not-found (host-routing pre-existing — preview hostnames NO matchean impluxa.com tenant routes). Custom domain `impluxa.com` returns 200 marketing landing. Falsa señal regression si solo comparas contra spec "200 + HTML" sin baseline-check pre-vocab preview previo.
- **Defer reason**: instancia UNICA observable. NO lesson formal aun. Nota tracking para smoke tests futuros.
- **Closure target**: cualquier sesion futura con Vercel preview smoke test.
- **Closure criterion**: smoke tests Vercel preview deploys deben incluir baseline comparison contra preview pre-mutation (cualquier preview reciente d3c56e4 era baseline correct esta sesion). Diferenciar:
  - "404 IDENTICO baseline = host-routing pre-existing, NO regression"
  - "404 NEW post-mutation vs 200 baseline = regression real"
- **Dossier**: N/A (1 line nota).
- **Tripwire**: 3 ocurrencias futuras → codificar lesson formal `vercel-preview-baseline-check-pre-regression-claim` o agregar al detection signal `pre-empirical-check`.
- **Risk if defer slips**: bajo. Patron auto-correctible cuando Claudia hace baseline check ANTES claim regression.

---

## [SEC-LEADS-1] `/api/leads` write-injection — trusts `tenant_id` from request body (severidad MEDIA)

- **Deferred from**: s31 turismo thin-slice A build (2026-05-29). CEO directive: write-injection a BACKLOG ahora, fix antes de que el form de leads colecte en prod.
- **Defer reason**: `POST /api/leads` valida `LeadSchema` (que solo exige `tenant_id` UUID bien formado) e inserta en `leads_tenant` via `getSupabaseServiceClient()` que **BYPASSEA RLS**, confiando el `tenant_id` que viene en el body del request (`route.ts:28`). Un actor puede POSTear cualquier `tenant_id` arbitrario e inyectar filas de lead en el `leads_tenant` de **cualquier** tenant. NO es leak de lectura cross-tenant (RLS protege los SELECT); es una **escritura** no autenticada de basura/spam en la tabla de leads de un tenant. Mitigacion del corte v1 turismo: el form de leads quedo **fuera del critical path publicado** via `show_lead_form: false` en el `content_json` de turismo (decouple barato elegido s31, el CTA publicado es WhatsApp wa.me nativo) → turismo NO colecta leads en prod ahora. PERO el endpoint sigue vivo y el form de **Hakuna** sigue activo (`show_lead_form` default true) → la exposicion pre-existente de Hakuna permanece. Por eso va a BACKLOG con nota explicita, no se cierra con el decouple.
- **Closure target**: pre-publish de cualquier tenant que active el form de leads (`show_lead_form: true`) en prod — incluye Hakuna si se audita su superficie de leads, y turismo si el CEO decide reactivar el form. Fix OBLIGATORIO antes de que el form de leads colecte en prod.
- **Closure criterion**: `/api/leads` resuelve el `tenant_id` desde el **contexto resuelto del request** (host/subdominio → tenant lookup, mismo mecanismo que usa el render de la landing), NO desde el body. El `tenant_id` del body se ignora o se valida contra el tenant resuelto y se rechaza (400/403) si no coincide. Regression test: POST con `tenant_id` de un tenant distinto al host del request → rechazado, 0 filas insertadas en el tenant ajeno; POST con `tenant_id` correcto del host → 1 fila insertada.
- **Dossier**: este BACKLOG entry (hallazgo empirico s31, sin design doc dedicado aun).
- **Tripwire 1 (code TODO)**: `D:\impluxa-web\src\app\api\leads\route.ts:28` — `tenant_id: parsed.data.tenant_id` confia el body; el insert en `leads_tenant` (lineas 27-33) corre via service client RLS-bypass (`route.ts:26`).
- **Tripwire 2 (SPEC ref)**: `D:\impluxa-web\src\templates\eventos\schema.ts` — `ContactoSchema.show_lead_form` (decouple flag, default true) es la mitigacion de scope, NO el fix.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: MEDIA. Si un tenant activa el form en prod sin el fix, un actor externo puede inyectar leads spam/basura en el `leads_tenant` de ese tenant (write-only, no exfiltracion de lectura). Impacto: contaminacion de la bandeja de leads del cliente + posible costo de triage/limpieza. NO escala a leak cross-tenant ni a escritura sobre otras tablas. Direccion: el fix es pre-requisito de habilitar `show_lead_form: true` en prod, no de publicar turismo (que va con el form OFF).

---

## [TONE-TURISMO-1] `AboutStrip` label "familias atendidas" hardcodeado — tone-fit pre-publish turismo (severidad LOW)

- **Deferred from**: s31 turismo thin-slice A build (2026-05-29). CEO directive: a BACKLOG LOW pre-publish, no resolver ahora.
- **Defer reason**: `AboutStrip.tsx` hardcodea el label "familias atendidas" (`AboutStrip.tsx:33,35`) y renderiza `+{content.families_count}` (`AboutStrip.tsx:29`); la seccion **siempre renderiza** sin condicional. El label NO es content-swappable via `content_json` (esta en el JSX del template, no en el schema). Para turismo queda off-tone ("+0 familias atendidas" con el borrador `families_count:0`). Invisible hoy: el tenant turismo es draft y 404ea publico (`page.tsx:41`). No bloquea nada del corte v1 (CTA = WhatsApp, form OFF).
- **Closure target**: pre-publish del tenant turismo (antes de `status=published`), como item de tone-fit junto con el swap de copy/assets reales.
- **Closure criterion**: el label de `AboutStrip` se parametriza (campo en `EventosContentSchema.about`, ej. `social_proof_label`, default "familias atendidas" para backward-compat Hakuna) O la seccion se gatea con un flag (ej. `show_about_strip`) para tenants sin social proof. Turismo render con copy de tono turismo o con la strip oculta; Hakuna intacto.
- **Dossier**: este BACKLOG entry (hallazgo empirico s31).
- **Tripwire 1 (code TODO)**: `D:\impluxa-web\src\templates\eventos\components\AboutStrip.tsx:33` (label hardcodeado) + `:29` (`+{content.families_count}`) + seccion sin condicional de render.
- **Tripwire 2 (SPEC ref)**: `D:\impluxa-web\src\templates\eventos\schema.ts` — `EventosContentSchema.about` no tiene campo de label ni flag de visibilidad de la strip.
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: LOW. Solo cosmetico/tone. Si se publica turismo sin el fix, la landing muestra "+0 familias atendidas" — poco profesional pero no roto, no afecta seguridad ni datos. Pre-requisito de publicar turismo con tono pulido, no de funcionalidad.

---

## [RECOVERY-1] Flujo recovery/reset-password muere en coming-soon — sin UI de callback de links de auth (severidad LOW hoy)

- **Deferred from**: s51 (2026-06-11) — discovery acceso de emergencia dueño PV. CEO marcó RECOVERY-1 como fix futuro al cerrar el workstream.
- **Defer reason**: Causa medida s51 (Management API GET /config/auth): `site_url = https://app.impluxa.com` + la app NO tiene UI de callback para tokens de link de GoTrue (recovery/invite/magic-link) → cualquier link de recovery aterriza en coming-soon y muere. NO afecta el acceso vigente: el login de la app es SOLO-OTP código tipeado (`signInWithOtp shouldCreateUser:false` + `verifyOtp type email`), no existe password-grant en UI → "olvidé mi contraseña" no es un flujo que exista hoy. El alta del dueño real PV se resolvió sin links (admin.createUser + OTP, CERRADA s51 bilateral).
- **Closure target**: antes del primer flujo que dependa de links de auth (recovery con password, invites por mail, magic links) o del onboarding masivo de usuarios reales (bundle con T-v025-01 gate cyber-neo).
- **Closure criterion**: un link de recovery emitido por GoTrue completa end-to-end en una pantalla funcional (callback handler + set-new-password) — O decisión documentada de permanecer OTP-only deshabilitando los flujos de link. Verify: emitir recovery de prueba y seguir el link hasta el final del flujo.
- **Dossier**: entries `s51-discovery-acceso-dueno-PV` + `s51-alta-dueno-PV` en decisions_log de `D:\segundo-cerebro\wiki\meta\session-boot.md`.
- **Tripwire 1 (code TODO)**: N/A — la ausencia de UI de callback ES el gap (grep `resetPasswordForEmail` en src = 0 hits, medido s51).
- **Tripwire 2 (SPEC ref)**: config GoTrue `site_url=https://app.impluxa.com` + `uri_allow_list` sin hosts tenant (medido s51 vía Management API).
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: LOW hoy (app OTP-only, cero consumidores de links). Sube a MEDIA cuando existan usuarios reales esperando "olvidé mi contraseña" o invitaciones por mail: el link muerto en coming-soon es una pared sin mensaje.

---

## [BRIDGE-KEY-1] Clave estable servicios↔excursions — el puente público joinea por nombre (frágil ante renames)

- **Deferred from**: s51 (2026-06-11) — plan C12+C13a puente público (GO CEO). Decisión firme BA Pass-1 (`a5035ed742732a20d`) + Pass-2 cold (`a214b065706ae2541`): defer con log, no bloquea la demo.
- **Defer reason**: El puente panel→pública matchea `excursions.name = content_json.servicios[].title` (join natural medido 6/6 en PV s51). No existe FK ni clave estable entre los dos mundos (`excursions` no tiene slug; el servicio tiene `key`/`title`). Un rename de la excursión en el panel O un edit del title en el content editor rompe el match → el precio público queda congelado en el valor content_json (fail-open al comportamiento pre-puente, NO rotura) + log estructurado de no-match. Persistir la clave YA costaría mutación DATA sobre `sites.content_json` PV + edit al schema compartido, ampliando el gate de la ola para cero beneficio en la demo (6/6 match hoy).
- **Closure target**: primera sesión que toque el content editor de servicios o el CRUD de excursions (lo que ocurra primero), o al primer no-match real loggeado en prod.
- **Closure criterion**: `excursion_id` persistido en `content_json.servicios[]` + campo `optional()` agregado a `ServicioSchema` (NOTA TÉCNICA: zod `z.object` STRIPPEA unknown keys en el parse — sin el campo en el schema, el merge post-parse no lo ve) + el helper `applyCurrentRates` prefiere `excursion_id` y cae a name-match como fallback. Verify: rename de excursión de prueba en preview → el precio sigue actualizando.
- **Dossier**: plan C12-C13a s51 (este chat) + discovery medido en entry `s51` decisions_log session-boot.md.
- **Tripwire 1 (code TODO)**: `src/lib/public/rates.ts` (Corte 1 C12) — comentario JOIN-BY-NAME + log `public_rates_unmatched` señalan el gap en el código.
- **Tripwire 2 (SPEC ref)**: `src/templates/eventos/schema.ts` `ServicioSchema` — sin campo `excursion_id` (estado actual).
- **Tripwire 3 (this BACKLOG entry)**: present.
- **Risk if defer slips**: LOW-MEDIA. Sin clave estable, un rename silencioso congela el precio público en el último valor content (el dueño cree que actualizó y la web muestra el viejo). Mitigado por el log de no-match (observable en runtime logs) y porque hoy el único editor de names es el propio dueño en un catálogo de 6.

---

## Change log

| Session                                          | Author                                                                                                                                                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| s15                                              | Claudia + Squad caso #8 fresh + re-review fresh BA+SE                                                                                                                | Initial BACKLOG. 4 entries: DB-H1, C-H2, post-v0.2.6 Sentinel `check_sensitive_env`, post-v0.2.6 partition rotation backfill.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| s15                                              | Claudia (post 5B.9 tests run + CEO directive)                                                                                                                        | Added 5th entry: `tests/unit/auth-guard.test.ts` local-dev environment gap (pre-existing, NOT caused by 5B.9 commit `8f74946`). Tag: `local-dev gap, fix opcional post-v0.2.6`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| s19                                              | Claudia + Squad Pass-2 cold SE+DevOps + CEO challenge                                                                                                                | Added POST-s19 entry: monitor.py alerta cascada Telegram on credentials read fail. Verificacion empirica corrigio Squad asuncion. CEO lean (b) aceptar riesgo modo prueba.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| s19a                                             | Claudia (take-2 ajustes diferidos CEO turn 10 take-1)                                                                                                                | Added POST-s19 PRIORIDAD MEDIA: paquete dual texto+audio cierre Sec 6 monitorear 3-5 cierres antes codificar CLAUDE.md v2.2 Sec 6.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| fase-1.5-cierre-sync                             | Claudia (T1 docs sync 2026-05-21 sin Squad)                                                                                                                          | Added POST-Fase-1.6 entry: compactacion MEMORY.md target <22KB (actual 25.9KB sobre cap warning 24.4KB).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| post-fase-1.6 housekeeping                       | Claudia + Squad Two-Pass extended (PM `ad066` + WA `aa0de`) + CEO challenge H4 + Opcion A                                                                            | POST-Fase-1.6 Compactacion MEMORY.md SHIPPED parcial: 30,247B→23,565B (-22.1%), bajo cap warning con margen 835B. Sub-item DEFER s19b: 15 entries vocab viejo (8 lessons C6 + 7 B Bloque) compactar post-migration vocab. Target hard <22KB no cumplido por disciplina vocab > numero.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| s_W2_burn_preview cierre                         | Claudia + Squad fresh (BA `af30d9` + DBO `a50a12` + SE `aa758a`) + CEO override (Y) append-only                                                                      | Added post-v0.2.6 W2 cierre B10.1 — WAL spike protection revisit pre-Hakuna-live. Trade-off Opcion A (Bug 2 fix function single-tx) pierde B10.1 vs procedure COMMIT loop original. Threshold metric 50K expired backlog → migracion v0.3.x Edge Function path (unico managed preservando COMMIT). Discovery parcial ya hecha (pg_settings + Supabase docs + GH #30168 confirmado). Owner CEO pre-flipeo `hakuna_live: true`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| s_sec3_merge_main sub-paso 2                     | Claudia + Squad Pass-1 fresh (PM `a5c725` + BA `a9a95a` + SE `af23a8`) + CEO over-rule SIGNAL 1 latente                                                              | Added post-v0.2.6 W2.bis-g4-FK — `audit-dedup-bypass-non-tenant-action` integration tests fail FK constraint (3/3 g4 dynamic tests fail con `audit_log_actor_user_id_fkey` violation). Pre-existing test setup defect (randomUUID actor_user_id NOT in auth.users), NO Bug 2 regression (append_audit signature unchanged v026_004 confirmed BA). Fix scope ~30-45min seed fixture user beforeAll+afterAll. Tracked W2.bis dedicated session pre-flipeo Hakuna live.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| s_fase_1_6_catalog_v4 P1                         | Claudia + Squad fresh paralelo (Tool Evaluator `aae9f7` + Workflow Architect `a90d49` + Senior PM `a635283`) + CEO GO Plan T2                                        | Added W2.bis-CLEANUP-1 carpeta `~/.claude/plugins/claude-banana/` candidato remove. Detectada P1 Discovery Fase 1.6 catalog v4. 4 criterios objetivos VETO catalog v4 (no manifest plugin + no enabledPlugins + proyecto stand-alone Anthropic Nano Banana Pro + no invocable Claude Code). Scope discipline PM Sec 3 → cleanup defer W2.bis dedicated session CEO confirma uso/no-uso. Risk cero operacional.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| s_fase_1_7_triggers_audit P3                     | Claudia + Squad fresh (PM `a0d48f` + TE `ac0cdb` + WA `a021f1`) + CEO recomendacion firme A turn 14                                                                  | Added W2.bis-FASE-1.7B-AGENTS-CLARITY-AUDIT entry (62 agents clarity-audit + col `kind` catalog v4.x). Trigger: P3 empirical disco resolution detecto catalog v4 HIGH 163 = mezcla 3 kinds (98 SKILL.md + 62 agent + 3 slash-cmd) con activacion semantica heterogenea. Agents subagent_type explicit invoke NO trigger keyword match. CEO firme A: restringir Fase 1.7 a 101 items triggerable, defer agents protocolo dedicado clarity-audit. Lesson candidate vigilancia `catalog-mezcla-kinds-empirico-altera-audit-scope` 1/3 ocurrencias.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| s_fase_1_7_triggers_audit P5 RE-PLAN-2           | Claudia + CEO RE-PLAN-2 acceptance honest doc-only post finding CASO B blind-spot intent-vs-plan                                                                     | Added W2.bis-FASE-1.7.5-MUTATIONS-EXEC entry (4 ECC SKILL.md upstream supply-chain + 4 catalog re-class/adds + 4 AMBIG-OK trios + cross-link agents 1.7b + signal v40). Trigger: Fase 1.7 P5 pre-empirical-check disco revelo catalog metadata-only NO afecta runtime auto-fire (lee SKILL.md disco directo). CEO honest re-frame Fase 1.7 doc-only + threshold 90% movido Fase 1.7.5. Lesson `fix-arquitectural-sin-testear-framework-wrapper` 4ta ocurrencia cross-domain DB→catalog applied. Empirical validación intra-Fase-1.7: custom SKILL.md edit SI hot-reload mid-session (skill list refresh confirmado fixing-motion-performance). 5ta acceptance wrong-call honest. Added W2.bis-DETECTION-SIGNAL-V40-CODIFY entry parallel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| s_fase_1_6_catalog_v4 P7+P8                      | Claudia + Squad chain Fase 1.6 (TE `aae9f7` + WA `a90d49` + PM `a635283`) + CEO GO P8                                                                                | Added W2.bis-CATALOG-PATCHES 4 anotaciones revisit catalog v4 detectadas P7 validacion empirica (6/7 PASS + 1 PARTIAL). Patches: (a) nextjs-turbopack archive→MEDIUM/HIGH stack Impluxa / (b) prp-prd MEDIUM→HIGH PRD workflow CoS / (c) diagnose duplicate entries verify dedup / (d) claude-obsidian:save no top T7 verify HIGH. Scope discipline → defer Fase 1.7. Risk bajo (clasificacion aisladas, no afectan invocacion).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| s_B1_24h_cron_verify                             | Claudia (T1 BACKLOG annotation sin Squad, CEO directive paralelo)                                                                                                    | Added W2.bis-MEMORY-RE-COMPACT-2 entry: MEMORY.md re-creció 28.3KB > 24.4KB cap warning (post-Fase-1.6 compact landed 23.5KB pero acumuló +4.8KB con nuevas lessons Fase 1.7 + s_fase_1_7_triggers_audit). NO bloqueante revenue. Target: post-B-blockers Hakuna live shipped. Approach: compactar entries vigilancia 1/3 acumuladas + consolidar duplicate cross-refs + DEFER s19b vocab entries pendientes. Owner: sesion dedicada post-Sentry+Logflare SHIPPED.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| s_B2_sentry_setup_paso1                          | Claudia (T1 BACKLOG annotation sin Squad, CEO directive paralelo)                                                                                                    | Added W2.bis-SENTINEL-ALLOWLIST-ENV-TEMPLATE entry: false-positive Sentinel recurring sobre archivos template env naming convention (placeholders, NO secrets reales). Bloqueó Grep B2.1 sentry env vars discovery (workaround: inferí 5 vars desde código Sentry.init lines). Hoy bloqueó tambien Edit este BACKLOG cuando intentaba escribir el path literal → self-meta loop confirma severidad pattern. NO urgente, NO revenue-blocking, defer post-B-blockers. Fix: add exception entry a `.security/sentinel-allowlist.json` para extension template (sin dot delante de env, sin extension .local/.production). Owner: sesion W2.bis sentinel hygiene.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| s_B2_sentry_D5_FAIL_defer                        | Claudia + CEO D4 defer pre-autorizado D5_FAIL (decision tree binary post-protocol)                                                                                   | Added W2.bis-B2-SENTRY-RUNTIME-CAPTURE-FIX entry: B2 PARTIAL — Sentry project + DSN + Vercel env vars + canonical+flush hybrid instrumentation pattern shipped, BUT 7 verify attempts (B2/P2/DEBUG/R3FIX/R3HYBRID/D1/D5) all returned 0 events Sentry except R1 (manual Sentry.init inline en route handler SI captura, proven empirical). H5 root cause hypothesis: SDK 10.53.1 auto-init via instrumentation.ts dynamic-import pipeline incompat Next.js 16.2.6 (canonical docs pattern matched exact pero falla runtime). T2, requires Squad fresh + supply-chain assessment ECC formal, posible upgrade @sentry/nextjs 11.x. Owner: sesion dedicada W2.bis post-B3+B-blockers SHIPPED. Branch feature/sentry-verify-b2 (9 commits) preservar evidence chain para fix futuro. Files preservar: instrumentation.ts canonical+flush + sentry.{server,edge}.config.ts D1 probes + /api/sentry-verify-b2 + /api/sentry-debug-env + /api/sentry-debug-send R1 inline init.                                                                                                                                                                                                                                                                                                                    |
| s_b3_routing_decision_ruta_0c                    | Claudia + CEO confirma Ruta 0c Sentry app-side Arquitectura B 2026-05-24                                                                                             | UPDATE W2.bis-B2-SENTRY-RUNTIME-CAPTURE-FIX context post-B3 routing decided: B3 BUNDLED dentro fix B2 (NO workstream paralelo independiente). Ruta 0c Sentry app-side $0 incremental Supabase (Pro $25 sunk cost, Log Drain add-on $60/mes NO activado). Sentry Logs GA confirmed septiembre 2025 + free tier 5GB/mes incluido todos planes + overage $0.50/GB + retention 30d Developer / 90d Team. Post fix B2 SHIPPED: Sentry SDK Next.js app-side cubre errors+traces+logs simultaneamente via Sentry.logger.\* o Sentry.captureMessage en code paths app-tier. Trade-off explicit: NO captura Postgres/Auth/Storage server-side logs centralizados Sentry — disponibles via Supabase managed dashboard 7d retention Pro (sunk cost). Plan B explicit si fix B2 falla post-Squad: Ruta 2 defer total — managed dashboard cubre debugging server-side pre-launch hasta volumen prod justifique Log Drain add-on $60/mes/proyecto (reversible 1 paso post-launch). Logflare descartado: NO destino nativo Supabase Log Drains (workaround generic HTTP no oficial). Axiom descartado: equivale Sentry desde cost-Supabase perspective + agrega vendor management overhead separado de Sentry errors+traces.                                                                               |
| s_B2_sentry_D5_FAIL_defer                        | Claudia + CEO D4 defer pre-autorizado                                                                                                                                | Added W2.bis-FEATURE-BRANCH-CLEANUP entry: feature/sentry-verify-b2 con 9 commits acumulados (1 canonical + 1 hybrid + 1 D1 probes + 1 D5 nodejs + 5 endpoints test/diagnostic). Post fix definitivo W2.bis-B2-SENTRY-RUNTIME-CAPTURE-FIX SHIPPED: cleanup endpoints + revert console.log probes + squash branch + extract 1-2 commits utiles (instrumentation.ts final pattern + cualquier middleware/runtime declaration arquitectural) + PR a main lean. Antes fix definitivo NO PR (sin codigo util mainline). Owner: junto con W2.bis-B2-SENTRY-RUNTIME-CAPTURE-FIX.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| s29 hotfix RLS audit_log partitions              | Claudia + Squad SE Pass-1 `a030188a7f4c93b3d` + Pass-2 cold NUEVO `a9fca52dfa9aa6d73` + CEO Sec 3 #21.f Caso 3                                                       | Added W2.bis-NIT-1-FORCE-RLS-AUDIT-LOG-PARTITIONS entry T1 priority LOW: defense-in-depth FORCE ROW LEVEL SECURITY parent audit_log + 3 partitions audit_log_2026_05/06/07. Razon: bloquear table-owner bypass futuro si propietario cambia. NO bloquea Hito 1 ni Hito 2. Risk cero. Estimate 5min `ALTER TABLE ... FORCE RLS` 4 statements + verify. Owner: sesion W2.bis security hygiene post-Hito-1 decision.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| s29 hotfix RLS audit_log partitions              | Claudia + Squad SE Pass-2 cold NUEVO `a9fca52dfa9aa6d73`                                                                                                             | Added W2.bis-NIT-2-REVOKE-GRANT-ANON-AUTH-AUDIT-LOG-PARTITIONS entry T1 priority LOW: defense-in-depth REVOKE INSERT/UPDATE/DELETE ON audit_log_2026_05/06/07 FROM anon, authenticated. Razon: GRANT layer hoy permisivo (RLS bloquea pero defense-in-depth REVOKE explicit). NO bloquea Hito 1 ni Hito 2. Risk cero. Estimate 5min `REVOKE` 3 partitions x 2 roles + verify. Owner: sesion W2.bis junto con NIT-1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| s29 hotfix RLS audit_log partitions              | Claudia + Squad SE Pass-2 cold NUEVO `a9fca52dfa9aa6d73`                                                                                                             | Added W2.bis-NIT-3-AUDIT-LOG-COMPUTE-HASH-SECDEF-ANON entry T1 priority LOW: Supabase advisor flag pre-existing `audit_log_compute_hash` SECURITY DEFINER executable por anon. NO regresion fix v026_005 (pre-existente fix v0.2.5 W2 audit_log). NO bloquea Hito 1 ni Hito 2. Fix candidato: REVOKE EXECUTE ... FROM anon o restringir SECDEF function permissions. Risk bajo. Estimate 5-10min verify scope + REVOKE. Owner: sesion W2.bis security hygiene.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| s29 ASK 2 cleanup Vercel orphan                  | Claudia + CEO ASK 2 OPCION (a) ARCHIVAR + Capability-Gap REST API DELETE (SIGNAL 11)                                                                                 | **STATUS DONE inmediato** W2.bis-CLEANUP-vercel-hakuna-web-archived-s29. Vercel proyecto orphan `hakuna-web` (ID `prj_yLIA7CmnZN0HsCVyNqz0RiwYG8WN`) DELETE via REST API `DELETE /v9/projects/{id}?teamId=...` Bearer VERCEL_TOKEN. HTTP 204 No Content. Verify empirico post-delete: get_project 404 NOT FOUND. impluxa-web intacto 8 dominios + latestDeployment READY. Snapshot pre-delete: ID prj_yLIA7Cmn... / created 2026-05-23 16:01 UTC / 1 deploy ERROR `dpl_D3kUHVjMqd5DcRFx4QQpRHvmT5MR` / sin custom domain / repo IMPLUXA/impluxa-web. Rollback path: recreate manual dashboard si necesario (low priority, orphan). NO cascada cross-project. 0 mutaciones DNS Cloudflare. Audit trail: capability-gap MCP delete_project no expone → REST API direct via token guardado (lesson `ask-ceo-policy-mecanica-vs-pedir-mano-evitable` SIGNAL 11). Closure target: cierre s29 dashboard audit_trail.                                                                                                                                                                                                                                                                                                                                                                              |
| s29 cierre Re-compact-6 MEMORY URGENT            | Claudia (T1 BACKLOG annotation cierre s29 sin Squad, CEO directive cierre)                                                                                           | **STATUS P0 URGENT s30** W2.bis-MEMORY-RE-COMPACT-6. MEMORY.md headroom post-cierre s29 **20.6% bordering piso 20%** (24391b / cap 30720b margin 6329b). Append +1 entry adicional cae <20% piso (3era vigilancia `auditor-recomendacion-policy-sin-verify-stakeholder-empirico` DEFERRED s30 explicit autorizado CEO cierre s29). Trigger Re-compact-6 OBLIGATORIO antes append normal s30. Approach: consolidate sub-pattern entries vigilancia 1/3 acumulados s27-s29 + archive cluster topic-file emergentes (lesson #1 inflation factor 1.79-2.00x range archives + 1.18x one-liner refactor patterns). Squad Two-Pass cold 3 agents firme (PM + BA + Compliance Pass-2 cold NUEVO). Target band 25-30% headroom post-fix dentro band fallback autorizado CEO. Owner: sesion s30 P0 PRIORITARIO ANTES arranque triplete paralelo Stream A+B+D plan integrado Hito 1+2 (per plan-integrado-hito1-hito2-s29.md disco trail). Riesgo NO ejecutar: append normal s30 triggea drift piso violation + posible MISS estructural workstream. Closure target: s30 inicio ritual /aprende post-Re-compact-6 + register 3era vigilancia + arranque triplete paralelo + 3 ASKs CEO bundled UPFRONT (branding turismo + template strategy + MP scope) + pre-condicion familia Hakuna independiente. |
| s30 Re-compact-6 MEMORY SHIPPED                  | Claudia (T2 mutation MEMORY.md + 2 archives + Squad Two-Pass cold 3/3 firme PM `a0c943d2be4e16dcc` + BA `a510a12bc4bbc1a16` + Compliance Pass-2 `a7a734354e05bea1b`) | **STATUS DONE s30** W2.bis-MEMORY-RE-COMPACT-6. MEMORY.md 25063b → 23436b (cut 1627b / 98 lines). Headroom honest cap **23.71%** (piso 20% +3.71pp buffer, MISS band fallback Squad 25-30% por 1.29pp aceptado honest declaration). 2 archives canonical disco memory folder: `cluster_vigilancias_meta_s21_s24_pre_formalize.md` 3032b (5 vigilancias 1/3 PARCIAL cubiertas Sec 1) + `cluster_setup_historico_arsenal_workflow_int.md` 3406b (14 entries Setup historico + Arsenal workflow). Snapshot pre-mutation `MEMORY.md.pre-recompact-6-s30.bak` 25063b intacto safety net. Verify Compliance Pass-2: tokens criticos 14/14 PASS + cross-refs 85 refs / 0 dead-links reales + archives integrity PASS. 4 nuevas correcciones-empirica-mid-turn cumulative s18-s30 (53va-56va) → cumulative 56 / 13 sesiones / threshold x11.2. Auto-catch-pre-send-auditor BILATERAL 3/3 firme PROMOTION-ready. Closure target: DONE.                                                                                                                                                                                                                                                                                                                                                               |
| s30 Vision IMPLUXA V6.2 RATIFIED CEO             | Claudia (T1 docs NO Squad dispatch per CEO instruction V1-V6.2) + CEO ratification 13 decisions UPFRONT bundled                                                      | **STATUS DONE s30** commit-final-s30-V6.2-RATIFIED-CEO. Path: `D:\segundo-cerebro\meta\impluxa-product-vision.md`. Vision producto SaaS agentic-native LATAM + arquitectura modular M2 6 sub-modulos 2 ejes (outbound M2a-M2e + inbound M2f Business Copilot Agentic BI) + M11 5 sub-capas (12 tematicas IP-free RATIFIED) + pricing 3 tiers RATIFICADO (Starter USD 38/Growth USD 79/Scale USD 169) margen 66-75% + D1-D16 firmes + 13 P RATIFICADAS (P1-P28) + **Opt-in Overage architecture** P4 + **Guest Generation Cap architecture** M11 + Hackathon GEMINI XPRIZE 82 dias roadmap H1.0-H1.7 + D8 V6.2 build-time/run-time separation. Lectura obligatoria arranque T2+ CLAUDE.md Sec 13 ref. Closure target: DONE (ratified). Lesson #1 datapoints cumulative s30: 8vo V1 0.91x naive / 9no V6 0.97x naive / 10mo V6→V6.2 Edit targeted 1.222x baseline → 5to modo emerging confirmed product-vision-doc content-type 0.91-0.97x naive.                                                                                                                                                                                                                                                                                                                                             |
| s30 Programas creditos LLM APPLY ESTA SEMANA     | Claudia + CEO P24 strategy mitigation cash flow + Squad PM Senior H1.0 dia 0-3 bundle PARALELO desarrollo                                                            | **STATUS PENDING s30 H1.0 dia 0-3** WORKSTREAM. Aplicar 3 programas creditos LLM startups PARALELO desarrollo Hakuna refactor sprint (NO bloquea sprint, NO defer septiembre): (a) **Anthropic Startup Program** USD 1K-5K creditos / (b) **Google for Startups Cloud Program** USD 2K-10K creditos / (c) **OpenAI Startup Program** USD ?K creditos. Trigger D6 V6 deferred condition met: solicitar applications BEFORE 3-5 clientes pagando (CEO override s30 V6.2 strategy mitigation cash flow P24 fijos USD 125/mes + budget extra USD 100-200 max). Squad PM Senior bundle prep applications (forms + pitch + traction evidence + team + roadmap). Si creditos USD 3K-15K total obtenidos → budget sprint comodo. Si NO creditos → Opcion B MVP reduced scope manageable USD 200. Closure target: applications submitted semana 1 junio + outcome notification 2-6 semanas + Cost Modeling Pass-2 incorpora ambos paths (escenarios B + C).                                                                                                                                                                                                                                                                                                                                          |
| s30 Hackathon GEMINI XPRIZE scope FULL V6.2      | Claudia + Squad arquitectura modular Hito 1 hackathon scope FULL post-Cost-Modeling + CEO P28 D8 V6.2 RATIFIED                                                       | **STATUS PENDING dispatch s30 post-Compliance Pass-2** WORKSTREAM Hakuna refactor + nuevos modulos M2 6 sub-modulos 2 ejes + M11 5 sub-capas + arquitectura multi-tenant + custom domain wildcard + RLS v2. Timeline 82 dias submission deadline 17 agosto 2026. Stack RUN-TIME 100% Gemini (Vertex AI Agent Builder + Gemini 2.5 Pro/Flash + Imagen 4 + Veo 3 + Cloud Run + Supabase + MercadoPago). BUILD-TIME Claude Code (CEO Max) + Claudia CoS dev tool. Onboarding clientes pagables real: Patagonia Viva H1.4 Tier 2 USD 79 trigger dia 40 + Hakuna H1.1-H1.4 finishing + Mihese H1.5 Tier 3 USD 169 + Lenga + Chucao + restaurante OPCIONAL H1.6 (decision dia 10). Diversidad vertical demostrable submission. Registration xprize.devpost.com semana 1 junio post-Compliance Pass-2 Cost Modeling. Closure target: hackathon submission package SHIPPED H1.7 dia 72-80 + Patagonia Viva pago real evidence before deadline.                                                                                                                                                                                                                                                                                                                                                      |
| s30 Compliance Pass-2 Cost Modeling 3 escenarios | Squad Compliance Pass-2 cold post-sintesis PENDING dispatch fresh agentId harness NO reuso s28/s29/s30                                                               | **STATUS PENDING dispatch s30 post-cascade-docs-SHIPPED** WORKSTREAM cost modeling 3 escenarios per CEO P27 RATIFIED: (A) V6 full sin creditos extras / (B) MVP reduced sin creditos extras / (C) V6 full CON creditos USD 1K-10K obtenidos applications. Scope verify: costos reales Gemini API per feature (M2 conv + M2e trans + M2f query + M2b voice + M11 generations) + Vercel for Platforms multi-tenant + Supabase Pro + MercadoPago fees + telefonia Twilio Voice (M2b Tier 3) + verify margen 66% Tier 1 sostenible empirico + flag dependencies bloqueantes per escenario. Output: tabla 3 escenarios costos mensuales tenant + breakeven analysis + recomendacion firme arranque sprint. Closure target: Compliance Pass-2 dispatch + 3-tabla cost modeling SHIPPED + dispatch Squad arquitectura modular Hito 1 unblocked.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| s30 Hakuna chatbot LLM run-time AUDIT empirico   | Squad BA Backend Architect H1.1 dia 3 PRIMER paso AUDIT antes assumption migration                                                                                   | **STATUS PENDING dispatch s30 post-cascade-docs-SHIPPED** WORKSTREAM AUDIT empirico Hakuna chatbot production actual: que LLM API esta llamando run-time clientes finales? 3 hipotesis evaluar: (A) Claude API per-token → SI legacy Claude run-time + necesita migration → Gemini API durante H1.1 dia 3-15 / (B) Otro LLM API o stack distinto → NO legacy Claude run-time + nada migrar / (C) CEO programo Hakuna con Claude Code en build-time pero chatbot run-time usa otro modelo → "Claude legacy" V6 era falso, Hakuna ya Gemini-compatible o agnostic. BA scope: grep Hakuna repo gh impluxa env vars + API endpoints + LLM client SDK + observabilidad logs runtime + chatbot widget code. Output: hipotesis confirmada + migration plan IF aplicable (H1.1 dia 3-15) OR skip migration nada-cambiar OR analisis stack agnostic. Closure target: AUDIT BA dia 3 SHIPPED + Squad arquitectura modular Hito 1 H1.1 dia 3-15 ejecutable scope confirmado.                                                                                                                                                                                                                                                                                                                           |
| s30 Opt-in Overage architecture V6.2             | Squad BA Backend Architect H1.x design + CEO P4 RATIFICADO V6.2 refinamiento                                                                                         | **STATUS PENDING design Squad BA H1.x** WORKSTREAM architecture. Toggle "permitir overage" ON/OFF per tier feature + cap mensual USD maximo configurable admin tenant panel. Toggle OFF → al alcanzar cap baseline tier, sistema responde cliente final "este mes ya no hay generaciones disponibles, contacta administrador" + standby hasta proximo periodo billing o admin activa overage manual. Schema: `tenant_settings.overage_enabled` bool + `tenant_settings.overage_cap_usd` numeric. UX admin panel: 2 inputs (toggle + cap). UX cliente final: error message friendly. Audit trail: `audit_log` entry per cap-hit event. PROTEGE cliente gastos imprevistos + UX profesional SaaS + diferenciador competencia silent overage. Closure target: design Squad BA H1.x + implementation H1.3 modulos M2/M2e/M2f/M11.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| s31 turismo thin-slice A AboutStrip tone         | Claudia (T1 BACKLOG annotation s31 sin Squad, CEO directive)                                                                                                         | Added [TONE-TURISMO-1] severidad LOW: `AboutStrip` label "familias atendidas" hardcodeado (`AboutStrip.tsx:33`) + seccion siempre renderiza → off-tone turismo ("+0 familias atendidas"). NO content-swappable (requiere parametrizar label o flag visibilidad). Invisible hoy (draft 404). Item pre-publish tone-fit, no bloquea.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| s31 turismo thin-slice A write-injection         | Claudia (T1 BACKLOG annotation s31 sin Squad, CEO directive)                                                                                                         | Added [SEC-LEADS-1] severidad MEDIA: `/api/leads` confia `tenant_id` del body + insert via service client RLS-bypass (`route.ts:28`) → write-injection cross-tenant en `leads_tenant`. Mitigado en corte v1 turismo via `show_lead_form: false` (form fuera del critical path publicado, CTA = WhatsApp wa.me). Exposicion Hakuna pre-existente permanece. Nota CEO: fix antes de que el form de leads colecte en prod. Closure criterion: resolver `tenant_id` desde host→tenant, NO desde body.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| s51 cierre alta dueño PV                         | Claudia (T1 BACKLOG annotation s51, cierre workstream CEO)                                                                                                           | Added [RECOVERY-1] severidad LOW: recovery/reset-password muere en coming-soon (`site_url=app.impluxa.com` + sin UI callback de links, medido s51). NO afecta acceso vigente (app SOLO-OTP). Claim CEO "RECOVERY-1 ya en BACKLOG" REFUTADO contra disco (grep 0 matches) → entry creada mismo turno (Sec 1 corrección empírica). Contexto: alta dueño real PV CERRADA s51 (uid `14a67547`, Paso 4 PASS bilateral).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| s51 GO puente público C12+C13a                   | Claudia + Squad Two-Pass (BA `a5035ed742732a20d` + SWArch cold `a214b065706ae2541`) + GO CEO plan                                                                    | Added [BRIDGE-KEY-1]: clave estable servicios↔excursions (excursion_id en content_json + schema optional, nota zod-strip). Join por nombre 6/6 medido pero frágil ante renames; mientras tanto fail-open al precio content + log no-match. Defer firme del Two-Pass: persistir clave ya = mutación DATA + schema compartido sin beneficio para la demo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| s30 Guest Generation Cap architecture V6.2       | Squad BA Backend Architect H1.x design + CEO P16 RATIFICADO V6.2 refinamiento                                                                                        | **STATUS PENDING design Squad BA H1.x** WORKSTREAM architecture. Schema diferencial `tenant_admin_cap` vs `guest_user_cap` en M11 (Content Studio). Caso fundacional: madre Hakuna (familia/usuario invitado de tenant) generando invitacion cumpleaños Tomy = **guest** cap diferencial: 3 imagenes max + 0 videos + 0 avatares por sesion. Admin tenant configura `guest_user_cap` en panel para evitar quemar tokens del tenant. Schema: `tenant_settings.guest_cap_images` int default 3 + `guest_cap_videos` int default 0 + `guest_cap_avatars` int default 0 + scope `per_session` enum vs `per_day` enum vs `per_month` enum (TBD design). UX admin panel: 3 inputs cap per kind + scope dropdown. Closure target: design Squad BA H1.x + implementation H1.2 M11 baseline core dia 15-32.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
