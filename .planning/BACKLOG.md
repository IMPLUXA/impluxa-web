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

## Change log

| Session | Author                                                | Change                                                                                                                                                                          |
| ------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| s15     | Claudia + Squad caso #8 fresh + re-review fresh BA+SE | Initial BACKLOG. 4 entries: DB-H1, C-H2, post-v0.2.6 Sentinel `check_sensitive_env`, post-v0.2.6 partition rotation backfill.                                                   |
| s15     | Claudia (post 5B.9 tests run + CEO directive)         | Added 5th entry: `tests/unit/auth-guard.test.ts` local-dev environment gap (pre-existing, NOT caused by 5B.9 commit `8f74946`). Tag: `local-dev gap, fix opcional post-v0.2.6`. |
