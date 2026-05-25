# P5b Batch B3 — DEFER planning/release dry-run (v3 classifier)

Generated: 2026-05-25
Classifier: v3 (v2 + expanded META slash-vocab + auto-surgical for backtick-protected vocab)

## V3 refinements vs v2

1. **Expanded META rule**: slash-vocab pattern `(Rey|Lord|Reino|Consejo)(\/(Rey|Lord|Reino|Consejo)){1,}` catches any order combination (caught BACKLOG L119)
2. **Auto-surgical for backtick-protected vocab**: any vocab inside backticks → preserve literal (caught BACKLOG L259 markdown filename + L237 schema spec)
3. **proposeReplace always backtick-aware**: even non-surgical bucket preserves backtick content

## Summary table

| File         | Total | REPLACE | R-surgical | KEEP-h | KEEP-META | KEEP-wl |
| ------------ | ----- | ------- | ---------- | ------ | --------- | ------- |
| BACKLOG.md   | 6     | 1       | 0          | 0      | 3         | 2       |
| CHANGELOG.md | 7     | 6       | 0          | 1      | 0         | 0       |

**Grand total:** 13 / 7 clean / 0 surgical / **7 actionable**

## BACKLOG.md

### L45 — REPLACE

**Reason:** active text

```
OLD: - **Defer reason**: when a tenant-claim action payload has `jwt_jti` null (gotrue/SDK regression scenario S2 from SE threat model — only reachable scenario in prod), `audit.ts:86-98` emits a `console.warn` but does NOT short-circuit, so `append_audit` proceeds and the dedup gate at `20260518_v026_001_audit_dedup.sql:143` skips its `if` block (it requires non-null `v_jti`), inserting a fresh `audit_log` row per retry. Cold-round BA cold flagged this as HIGH "corrupts FR-RLS-BURN-2 readiness signal". Re-review fresh BA + SE concur it is MED (not HIGH): the gate at `observe-rls-burn-readiness.ts:249-254` is binary (`claim_missing > 0` → NO-GO), count inflation does NOT flip the verdict; SPEC.md:60 confirms the real gate is human Rey sign-off, not script auto-flip; direction of corruption is fail-closed (false NO-GO = safe direction, not exploitable false GO). All proposed FIX-AHORA mitigations are out of scope for Cut B (auth-boundary reject breaks T5 compat; fail-closed at audit.ts reverses fail direction to UNSAFE; synthetic dedup PK is schema change).
NEW: - **Defer reason**: when a tenant-claim action payload has `jwt_jti` null (gotrue/SDK regression scenario S2 from SE threat model — only reachable scenario in prod), `audit.ts:86-98` emits a `console.warn` but does NOT short-circuit, so `append_audit` proceeds and the dedup gate at `20260518_v026_001_audit_dedup.sql:143` skips its `if` block (it requires non-null `v_jti`), inserting a fresh `audit_log` row per retry. Cold-round BA cold flagged this as HIGH "corrupts FR-RLS-BURN-2 readiness signal". Re-review fresh BA + SE concur it is MED (not HIGH): the gate at `observe-rls-burn-readiness.ts:249-254` is binary (`claim_missing > 0` → NO-GO), count inflation does NOT flip the verdict; SPEC.md:60 confirms the real gate is human CEO sign-off, not script auto-flip; direction of corruption is fail-closed (false NO-GO = safe direction, not exploitable false GO). All proposed FIX-AHORA mitigations are out of scope for Cut B (auth-boundary reject breaks T5 compat; fail-closed at audit.ts reverses fail direction to UNSAFE; synthetic dedup PK is schema change).
```

### L119 — KEEP-META

**Reason:** migration mapping slash-separated

```
OLD:   - **Migracion vocabulario completa segundo-cerebro**: grep masivo + reemplazo `Rey/Lord/Reino/Consejo → CEO/Claudia/Impluxa/Squad` en todos los archivos (notes, lessons, transcripts, topic files no tocados, lo que aparezca). Ya migrado: CLAUDE.md v2.2 + MEMORY.md s16 + topic file `feedback_vocabulario_convoco_consejo.md` s16. Pendiente: resto de `D:\segundo-cerebro\` (lessons, aprendizajes, hot.md, session-boot legacy entries, scripts, Task Scheduler names, `audit-decisions.ps1`, credentials filename, etc).
```

### L230 — KEEP-whitelist

**Reason:** filename/Task literal

```
OLD: - **Nota agregada s18 turn 22**: considerar `pending-rey-messages.jsonl` rename como parte del scope s19:
```

### L237 — KEEP-META

**Reason:** runtime schema mapping spec

```
OLD:   - **`state.json` runtime schema migration**: keys del JSON activo escritas por `monitor.py` contienen vocab viejo: `identity.lord` → `identity.claudia` / `identity.rey` → `identity.ceo` / `consejo_validated.*` → `squad_validated.*` (verificar schema completo). Migration coordinated: actualizar (a) codigo Python que escribe el state + (b) codigo Python que lo lee + (c) state.json en sitio runtime + (d) doc heartbeat-monitor.md schema description. Riesgo: ventana mid-migration donde codigo escribe schema mixto (lee vocab nuevo + escribe vocab viejo o viceversa). Mitigacion: backup state.json pre-edit + apply orden codigo-reader → codigo-writer → state.json → doc.
```

### L259 — KEEP-whitelist

**Reason:** backtick-protected vocab (filename/code ref)

```
OLD:   - `Vision Casa Habitable -- Plan Reino Impluxa.md` historico pre-pivot.
```

### L337 — KEEP-META

**Reason:** migration mapping slash-separated

```
OLD: - **Sub-item DEFER sweep s19b**: **15 entries MEMORY.md DEFER por vocab viejo inline (Rey/Lord/Reino/Consejo)** — compactar post-migration vocab completada. 8 lessons C6 (lineas 99 declarar-veredicto / 106 pedir-mano-rey / 108 propuse-solucion-grande / 116 recomendacion-sin-consejo / 118 Hakuna fotos / 120 esperar-ok-rey-t2 / 121 preguntar-proxima-tarea / 122 3h-silencio-telegram) + 7 B Bloque (29 Credenciales Lord Claude / 30 Protocolo v6.0 / 31 Capabilities matrix "reino" / 37 Modelo ejecucion / 38 Sentinel preflight / 39 Force-signout / 47 Pull-forward). Estimate compactacion DEFER sub-item: ~1h post-sweep s19b vocab migration.
```

## CHANGELOG.md

### L22 — KEEP-historico

**Reason:** Changelog versioned entry

```
OLD: - Rey re-login OTP validated end-to-end + audit_log CHAIN_OK
```

### L116 — REPLACE

**Reason:** active text

```
OLD:   Lord Claudia awaiting + chat silencio >3min.
NEW:   Claudia CoS awaiting + chat silencio >3min.
```

### L117 — REPLACE

**Reason:** active text

```
OLD: - **Skill `/loop 4min`** (CronCreate job, session-only) — Lord Claudia trabaja
NEW: - **Skill `/loop 4min`** (CronCreate job, session-only) — Claudia CoS trabaja
```

### L124 — REPLACE

**Reason:** active text

```
OLD:   porque dependen de secrets pendientes del Rey o decisiones estratégicas.
NEW:   porque dependen de secrets pendientes del CEO o decisiones estratégicas.
```

### L140 — REPLACE

**Reason:** active text

```
OLD: ### Pending para cerrar 0.2.5 (no-autónomo, requieren ASK al Rey o input humano)
NEW: ### Pending para cerrar 0.2.5 (no-autónomo, requieren ASK al CEO o input humano)
```

### L150 — REPLACE

**Reason:** active text

```
OLD:   T4 irreversible que requiere sign-off explícito del Rey Jota.
NEW:   T4 irreversible que requiere sign-off explícito del CEO Jota.
```

### L161 — REPLACE

**Reason:** active text

```
OLD: - Daemon Lord Claudia independiente (cuando se aprobe Opción A propuesta).
NEW: - Daemon Claudia CoS independiente (cuando se aprobe Opción A propuesta).
```
