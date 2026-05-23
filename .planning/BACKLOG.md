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
- **Defer reason**: when a tenant-claim action payload has `jwt_jti` null (gotrue/SDK regression scenario S2 from SE threat model — only reachable scenario in prod), `audit.ts:86-98` emits a `console.warn` but does NOT short-circuit, so `append_audit` proceeds and the dedup gate at `20260518_v026_001_audit_dedup.sql:143` skips its `if` block (it requires non-null `v_jti`), inserting a fresh `audit_log` row per retry. Cold-round BA cold flagged this as HIGH "corrupts FR-RLS-BURN-2 readiness signal". Re-review fresh BA + SE concur it is MED (not HIGH): the gate at `observe-rls-burn-readiness.ts:249-254` is binary (`claim_missing > 0` → NO-GO), count inflation does NOT flip the verdict; SPEC.md:60 confirms the real gate is human Rey sign-off, not script auto-flip; direction of corruption is fail-closed (false NO-GO = safe direction, not exploitable false GO). All proposed FIX-AHORA mitigations are out of scope for Cut B (auth-boundary reject breaks T5 compat; fail-closed at audit.ts reverses fail direction to UNSAFE; synthetic dedup PK is schema change).
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

## Change log

| Session                      | Author                                                                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| s15                          | Claudia + Squad caso #8 fresh + re-review fresh BA+SE                                                   | Initial BACKLOG. 4 entries: DB-H1, C-H2, post-v0.2.6 Sentinel `check_sensitive_env`, post-v0.2.6 partition rotation backfill.                                                                                                                                                                                                                                                                                                                                        |
| s15                          | Claudia (post 5B.9 tests run + CEO directive)                                                           | Added 5th entry: `tests/unit/auth-guard.test.ts` local-dev environment gap (pre-existing, NOT caused by 5B.9 commit `8f74946`). Tag: `local-dev gap, fix opcional post-v0.2.6`.                                                                                                                                                                                                                                                                                      |
| s19                          | Claudia + Squad Pass-2 cold SE+DevOps + CEO challenge                                                   | Added POST-s19 entry: monitor.py alerta cascada Telegram on credentials read fail. Verificacion empirica corrigio Squad asuncion. CEO lean (b) aceptar riesgo modo prueba.                                                                                                                                                                                                                                                                                           |
| s19a                         | Claudia (take-2 ajustes diferidos CEO turn 10 take-1)                                                   | Added POST-s19 PRIORIDAD MEDIA: paquete dual texto+audio cierre Sec 6 monitorear 3-5 cierres antes codificar CLAUDE.md v2.2 Sec 6.                                                                                                                                                                                                                                                                                                                                   |
| fase-1.5-cierre-sync         | Claudia (T1 docs sync 2026-05-21 sin Squad)                                                             | Added POST-Fase-1.6 entry: compactacion MEMORY.md target <22KB (actual 25.9KB sobre cap warning 24.4KB).                                                                                                                                                                                                                                                                                                                                                             |
| post-fase-1.6 housekeeping   | Claudia + Squad Two-Pass extended (PM `ad066` + WA `aa0de`) + CEO challenge H4 + Opcion A               | POST-Fase-1.6 Compactacion MEMORY.md SHIPPED parcial: 30,247B→23,565B (-22.1%), bajo cap warning con margen 835B. Sub-item DEFER s19b: 15 entries vocab viejo (8 lessons C6 + 7 B Bloque) compactar post-migration vocab. Target hard <22KB no cumplido por disciplina vocab > numero.                                                                                                                                                                               |
| s_W2_burn_preview cierre     | Claudia + Squad fresh (BA `af30d9` + DBO `a50a12` + SE `aa758a`) + CEO override (Y) append-only         | Added post-v0.2.6 W2 cierre B10.1 — WAL spike protection revisit pre-Hakuna-live. Trade-off Opcion A (Bug 2 fix function single-tx) pierde B10.1 vs procedure COMMIT loop original. Threshold metric 50K expired backlog → migracion v0.3.x Edge Function path (unico managed preservando COMMIT). Discovery parcial ya hecha (pg_settings + Supabase docs + GH #30168 confirmado). Owner CEO pre-flipeo `hakuna_live: true`.                                        |
| s_sec3_merge_main sub-paso 2 | Claudia + Squad Pass-1 fresh (PM `a5c725` + BA `a9a95a` + SE `af23a8`) + CEO over-rule SIGNAL 1 latente | Added post-v0.2.6 W2.bis-g4-FK — `audit-dedup-bypass-non-tenant-action` integration tests fail FK constraint (3/3 g4 dynamic tests fail con `audit_log_actor_user_id_fkey` violation). Pre-existing test setup defect (randomUUID actor_user_id NOT in auth.users), NO Bug 2 regression (append_audit signature unchanged v026_004 confirmed BA). Fix scope ~30-45min seed fixture user beforeAll+afterAll. Tracked W2.bis dedicated session pre-flipeo Hakuna live. |
