# P5b Consolidated Dry-Run (v5.1 classifier) — FINAL package P6

Generated: 2026-05-25
Classifier: v5.1 = v4 + R11 case-preserving substitution + R9 extended kebab-case popcultureref

## V5.1 changes

1. **Detection regex**: case-insensitive `/\b(Rey|Lord Claude|...)\b/i` (preserved from v4)
2. **Substitution**: case-aware — UPPERCASE first then titlecase (REY→CEO, Rey→CEO; REINO→IMPLUXA, Reino→Impluxa; etc)
3. **R9 extended**: `Rey León|Reyes Magos|Día de Reyes|Tres Reyes|rey-leon|reyes-magos|dia-de-reyes|tres-reyes` → KEEP-popcultureref

## V5.1 NEW findings vs v4

- force-global-signout.ts:L15 [UPPERCASE] → bucket=REPLACE
- defaults.ts:L59 [kebab-popcultureref] → bucket=KEEP-popcultureref

## Per-batch totals (FINAL)

| Batch         | Total   | REPL    | R-surg | KEEP-h | KEEP-M | KEEP-wl | KEEP-pop | KEEP-data | Actionable |
| ------------- | ------- | ------- | ------ | ------ | ------ | ------- | -------- | --------- | ---------- |
| B1            | 19      | 10      | 3      | 4      | 0      | 2       | 0        | 0         | 13         |
| B2            | 47      | 40      | 5      | 2      | 0      | 0       | 0        | 0         | 45         |
| B3            | 13      | 7       | 0      | 1      | 3      | 2       | 0        | 0         | 7          |
| B4            | 51      | 49      | 0      | 1      | 0      | 0       | 1        | 0         | 49         |
| B5            | 8       | 6       | 0      | 0      | 0      | 0       | 2        | 0         | 6          |
| **P5b TOTAL** | **138** | **112** | **8**  | **8**  | **3**  | **4**   | **3**    | **0**     | **120**    |

- **P5a session-boot.md**: 89 matches / 0 actionable NO-OP

**GRAND TOTAL P5 (P5a + P5b):** 227 matches / **120 REPLACE actionable** (session-boot NO-OP)

## Full per-file detail (sorted by batch)

### B1 — CLAUDE.md

#### L785 — KEEP-historico

**Reason:** Sec 14 cross-ref

```
OLD: el CLAUDE.md y se mapean al Protocolo Lord Claude Autonomo v6.0 (ver
```

### B1 — go.md

#### L69 — KEEP-whitelist

**Reason:** lesson kebab ref

```
OLD: 5. SI Squad recomienda algo, INVOCAR realmente el agent (no citar veredicto sin invocación) — lección `recomendacion-sin-consejo`
```

### B1 — al-dia.md

No matches.

### B1 — hot.md

#### L103 — KEEP-historico

**Reason:** cita textual audit

```
OLD: - **Anotaciones observaciones-claudia-v22.md s14**: SIGNAL 6 corregido 3 TP (s10a + s13 + s14), 2 patrones nuevos TP caso fundacional (`internalizacion-prematura-de-refinamiento-propuesto` + `inflar-conteo-SIGNAL`), microviolacion vocabulario "Rey-gated" flagueada como cita textual audit cold s13, lesson nueva `dossier-two-pass-extended-no-archivado-pre-cierre` (observacion no politica activa), patron nuevo `estimacion-%-completion-Claudia-sin-Squad-ni-criterios` (TP caso fundacional s13 identificado s14).
```

#### L126 — KEEP-whitelist

**Reason:** lesson kebab ref

```
OLD: - Microviolacion vocabulario `Rey-gated` [NOTED — cita textual audit cold s13 archivado, no violacion propia]: flagueada para audits/archivos pre-vocabulario-migracion.
```

#### L143 — REPLACE

**Reason:** active text

```
OLD: - ✅ **Sub-paso 5.B fresh s15 (5B.7-5B.10 SHIPPED, 5B.11 + 5B.12 SLIP s16)** — 5B.7 SPEC `daeac2b` + 5B.8 ADR-0010 `a9ff1e5` + 5B.9 tests `8f74946` + 5B.10 Diff Two-Pass cold DONE (3 cold agents + 4 HIGH fixes applied s15 cierre). **5B.11 SLIP A s16** (Rey-gated gravedad #21.f; coincide con 5B.12 slip; cierre conjunto). **5B.12 SLIP A s16** (OQ-PM-1 resuelta s15). Both slips: `hakuna_live=false` → riesgo nulo. **Caso #8 fresh CERRADO**: 11 dossiers archivados en `.planning/v0.2.6/` (3 PASS-1 + 3 PASS-2 + 2 REREVIEW C-H2 + 3 5B.10 cold). Lesson `dossier-two-pass-extended-no-archivado-pre-cierre` SATISFECHA por Path B (SPEC §10 + §10.10 References como sintesis consolidada; 8+ archivos `.md aparte` satisfacen el "artefacto .md aparte" de la lesson).
NEW: - ✅ **Sub-paso 5.B fresh s15 (5B.7-5B.10 SHIPPED, 5B.11 + 5B.12 SLIP s16)** — 5B.7 SPEC `daeac2b` + 5B.8 ADR-0010 `a9ff1e5` + 5B.9 tests `8f74946` + 5B.10 Diff Two-Pass cold DONE (3 cold agents + 4 HIGH fixes applied s15 cierre). **5B.11 SLIP A s16** (CEO-gated gravedad #21.f; coincide con 5B.12 slip; cierre conjunto). **5B.12 SLIP A s16** (OQ-PM-1 resuelta s15). Both slips: `hakuna_live=false` → riesgo nulo. **Caso #8 fresh CERRADO**: 11 dossiers archivados en `.planning/v0.2.6/` (3 PASS-1 + 3 PASS-2 + 2 REREVIEW C-H2 + 3 5B.10 cold). Lesson `dossier-two-pass-extended-no-archivado-pre-cierre` SATISFECHA por Path B (SPEC §10 + §10.10 References como sintesis consolidada; 8+ archivos `.md aparte` satisfacen el "artefacto .md aparte" de la lesson).
```

### B1 — heartbeat-monitor.md

#### L3 — REPLACE

**Reason:** active text

```
OLD: title: "Lord Claude Heartbeat Monitor — operación + shutdown"
NEW: title: "Claudia CoS Heartbeat Monitor — operación + shutdown"
```

#### L12 — REPLACE

**Reason:** active text

```
OLD: Cron monitor que corre cada 3 min para implementar CLAUDE.md regla #22 (autonomía contra silencio del Rey + activación por Telegram).
NEW: Cron monitor que corre cada 3 min para implementar CLAUDE.md regla #22 (autonomía contra silencio del CEO + activación por Telegram).
```

#### L17 — REPLACE

**Reason:** active text

```
OLD: - **State:** `D:\impluxa-utils\heartbeat-monitor\state.json` (Lord Claude lo actualiza durante sesión)
NEW: - **State:** `D:\impluxa-utils\heartbeat-monitor\state.json` (Claudia CoS lo actualiza durante sesión)
```

#### L18 — REPLACE-surgical

**Reason:** filename literal + active

```
OLD: - **Pending msgs:** `D:\impluxa-utils\heartbeat-monitor\pending-rey-messages.jsonl` (archivo de mensajes del Rey llegados mientras Lord Claude estaba fuera de sesión — lee al arrancar próxima sesión)
NEW: - **Pending msgs:** `D:\impluxa-utils\heartbeat-monitor\pending-rey-messages.jsonl` (archivo de mensajes del CEO llegados mientras Claudia CoS estaba fuera de sesión — lee al arrancar próxima sesión)
```

#### L40 — REPLACE

**Reason:** active text

```
OLD: Si Lord Claude se vuelve loco o el Rey quiere parar el monitor:
NEW: Si Claudia CoS se vuelve loco o el CEO quiere parar el monitor:
```

#### L65 — REPLACE

**Reason:** active text

```
OLD: ## Cuándo archiva mensajes Rey
NEW: ## Cuándo archiva mensajes CEO
```

#### L67 — REPLACE-surgical

**Reason:** filename literal + active

```
OLD: En CADA tick, el monitor pollea Telegram `getUpdates` con offset persistido. Si el Rey escribió, archiva en `pending-rey-messages.jsonl` (uno por línea). La próxima sesión Lord Claude lee ese archivo al arrancar (session-boot ritual).
NEW: En CADA tick, el monitor pollea Telegram `getUpdates` con offset persistido. Si el CEO escribió, archiva en `pending-rey-messages.jsonl` (uno por línea). La próxima sesión Claudia CoS lee ese archivo al arrancar (session-boot ritual).
```

#### L69 — REPLACE

**Reason:** active text

```
OLD: ⚠️ **CUIDADO:** mientras Lord Claude está activo en sesión, también pollea Telegram. Si el monitor archive un mensaje antes que Lord Claude lo procese, queda solo en el archive (no aparece en getUpdates de Lord Claude). Versión v2: el monitor debería skipear archive si state.json indica "Lord Claude active" (heartbeat reciente).
NEW: ⚠️ **CUIDADO:** mientras Claudia CoS está activo en sesión, también pollea Telegram. Si el monitor archive un mensaje antes que Claudia CoS lo procese, queda solo en el archive (no aparece en getUpdates de Claudia CoS). Versión v2: el monitor debería skipear archive si state.json indica "Claudia CoS active" (heartbeat reciente).
```

#### L73 — KEEP-historico

**Reason:** inline dated decree

```
OLD: Decreto Rey Jota 2026-05-14 sesión 4ª: "no quiero que te quedes en pausa esperando mi respuesta". Lord Mano Claudia es turn-based (Claude Code CLI), no daemon. Para cumplir el espíritu del decreto FUERA de sesión activa, este cron mantiene canal Telegram vivo y archiva input del Rey para próxima activación.
```

#### L77 — KEEP-historico

**Reason:** inline dated decree

```
OLD: Rey Jota se fue al gimnasio durante 3 horas el 2026-05-14. Mandó mensajes Telegram al bot. Lord Claudia NO respondió hasta que el Rey volvió y escribió en el chat de Claude. El cron monitor de este doc se instaló en la misma sesión tras el incidente. Ver `lesson_3h_silencio_telegram_gimnasio.md` en memorias.
```

#### L81 — REPLACE

**Reason:** active text

```
OLD: Este cron archiva + manda heartbeat. **NO despierta a Lord Claudia para procesar tareas nuevas.** Solución completa requiere agent daemon independiente — ver propuesta en `feedback_autonomia_contra_silencio_3min.md` sección "Solución completa pendiente".
NEW: Este cron archiva + manda heartbeat. **NO despierta a Claudia CoS para procesar tareas nuevas.** Solución completa requiere agent daemon independiente — ver propuesta en `feedback_autonomia_contra_silencio_3min.md` sección "Solución completa pendiente".
```

#### L88 — REPLACE-surgical

**Reason:** filename literal + active

```
OLD: 4. **R3 (v2):** cap 500 líneas en pending-rey-messages.jsonl, rotación. TODO.
NEW: 4. **R3 (v2):** cap 500 líneas en pending-rey-messages.jsonl, rotación. TODO.
```

#### L94 — REPLACE

**Reason:** active text

```
OLD: - No despierta automáticamente Lord Claude en Claude Code — solo manda Telegram. Pablo debe abrir Claude Code manualmente para procesar pending messages.
NEW: - No despierta automáticamente Claudia CoS en Claude Code — solo manda Telegram. Pablo debe abrir Claude Code manualmente para procesar pending messages.
```

#### L95 — REPLACE

**Reason:** active text

```
OLD: - Si Lord Claude crashea sin update state.json, el monitor puede mandar heartbeats sobre tarea vieja (mitigado por TTL R1 = 4h max).
NEW: - Si Claudia CoS crashea sin update state.json, el monitor puede mandar heartbeats sobre tarea vieja (mitigado por TTL R1 = 4h max).
```

### B2 — impluxa-utils/README.md

#### L1 — REPLACE

**Reason:** active text

```
OLD: # Impluxa Utils — herramientas locales del Reino
NEW: # Impluxa Utils — herramientas locales de Impluxa
```

#### L4 — REPLACE

**Reason:** active text

```
OLD: > acá corre **100% local en la PC del Rey Jota**, sin cloud, sin telemetría.
NEW: > acá corre **100% local en la PC del CEO Jota**, sin cloud, sin telemetría.
```

#### L13 — REPLACE

**Reason:** active text

```
OLD: ├─ telegram-voice-bridge\          ← Whisper local: voz del Rey → texto
NEW: ├─ telegram-voice-bridge\          ← Whisper local: voz del CEO → texto
```

#### L14 — REPLACE

**Reason:** active text

```
OLD: └─ piper-tts\                      ← Piper local: texto Lord Claudia → voz Daniela arg
NEW: └─ piper-tts\                      ← Piper local: texto Claudia CoS → voz Daniela arg
```

#### L22 — REPLACE-surgical

**Reason:** filename literal + active

```
OLD: Telegram del Rey en `pending-rey-messages.jsonl` mientras Lord Claudia está
NEW: Telegram del CEO en `pending-rey-messages.jsonl` mientras Claudia CoS está
```

#### L23 — REPLACE

**Reason:** active text

```
OLD: fuera de sesión. Manda Telegram heartbeat "🔄 Continúo con X" si Lord Claudia
NEW: fuera de sesión. Manda Telegram heartbeat "🔄 Continúo con X" si Claudia CoS
```

#### L28 — REPLACE

**Reason:** active text

```
OLD: - `state.json` (estado compartido con Lord Claudia in-session)
NEW: - `state.json` (estado compartido con Claudia CoS in-session)
```

#### L29 — REPLACE-surgical

**Reason:** filename literal + active

```
OLD: - `pending-rey-messages.jsonl` (archivo de mensajes Rey llegados off-session)
NEW: - `pending-rey-messages.jsonl` (archivo de mensajes CEO llegados off-session)
```

#### L52 — REPLACE

**Reason:** active text

```
OLD: ### `telegram-voice-bridge/` — Whisper local (Rey → Lord Claudia)
NEW: ### `telegram-voice-bridge/` — Whisper local (CEO → Claudia CoS)
```

#### L54 — REPLACE

**Reason:** active text

```
OLD: **Qué hace:** cuando el Rey manda un voice message por Telegram al bot
NEW: **Qué hace:** cuando el CEO manda un voice message por Telegram al bot
```

#### L55 — REPLACE

**Reason:** active text

```
OLD: `@impluxa_consorte_bot`, Lord Claudia llama este script con el `file_id`. El
NEW: `@impluxa_consorte_bot`, Claudia CoS llama este script con el `file_id`. El
```

#### L57 — REPLACE

**Reason:** active text

```
OLD: local, y devuelve JSON con texto. Lord Claudia trata la transcripción como si
NEW: local, y devuelve JSON con texto. Claudia CoS trata la transcripción como si
```

#### L58 — REPLACE

**Reason:** active text

```
OLD: el Rey lo hubiera escrito normal.
NEW: el CEO lo hubiera escrito normal.
```

#### L80 — REPLACE

**Reason:** active text

```
OLD: ### `piper-tts/` — Piper local (Lord Claudia → Rey)
NEW: ### `piper-tts/` — Piper local (Claudia CoS → CEO)
```

#### L82 — REPLACE

**Reason:** active text

```
OLD: **Qué hace:** Lord Claudia mete texto, Piper sintetiza voz Daniela argentina
NEW: **Qué hace:** Claudia CoS mete texto, Piper sintetiza voz Daniela argentina
```

#### L84 — REPLACE

**Reason:** active text

```
OLD: `sendVoice` API. Audio nunca sale del PC del Rey.
NEW: `sendVoice` API. Audio nunca sale del PC del CEO.
```

#### L92 — REPLACE-surgical

**Reason:** filename literal + active

```
OLD: - Bot token + chat_id Rey leídos de `%USERPROFILE%\.secrets\lord-claude.credentials`
NEW: - Bot token + chat_id CEO leídos de `%USERPROFILE%\.secrets\lord-claude.credentials`
```

#### L96 — REPLACE

**Reason:** active text

```
OLD: python D:/impluxa-utils/piper-tts/send_voice.py --text "Hola Rey, mensaje urgente"
NEW: python D:/impluxa-utils/piper-tts/send_voice.py --text "Hola CEO, mensaje urgente"
```

#### L105 — REPLACE

**Reason:** active text

```
OLD: - Audio TTS: Rey lo pide explícito / alerta urgente sin pantalla / demo capacidad
NEW: - Audio TTS: CEO lo pide explícito / alerta urgente sin pantalla / demo capacidad
```

#### L115 — REPLACE

**Reason:** active text

```
OLD: | `D:\segundo-cerebro\wiki\meta\session-boot.md` | Fuente única de verdad para arranque de sesión (Lord Claudia lee primero) |
NEW: | `D:\segundo-cerebro\wiki\meta\session-boot.md` | Fuente única de verdad para arranque de sesión (Claudia CoS lee primero) |
```

#### L118 — REPLACE

**Reason:** active text

```
OLD: | `C:\Users\Pablo\.claude\CLAUDE.md` | 24 reglas operativas del Reino |
NEW: | `C:\Users\Pablo\.claude\CLAUDE.md` | 24 reglas operativas de Impluxa |
```

#### L121 — REPLACE-surgical

**Reason:** filename literal + active

```
OLD: | `%USERPROFILE%\.secrets\lord-claude.credentials` | Llaves del reino (Telegram + Cloudflare + Resend + Upstash + Vercel) |
NEW: | `%USERPROFILE%\.secrets\lord-claude.credentials` | Llaves del reino (Telegram + Cloudflare + Resend + Upstash + Vercel) |
```

#### L125 — REPLACE

**Reason:** active text

```
OLD: 1. **100% local** — sin cloud TTS/STT, sin telemetría, audio nunca sale del PC del Rey.
NEW: 1. **100% local** — sin cloud TTS/STT, sin telemetría, audio nunca sale del PC del CEO.
```

#### L130 — REPLACE

**Reason:** active text

```
OLD: 6. **Run as Pablo (no SYSTEM)** — el cron monitor + tareas Windows usan el usuario del Rey, no privilegios elevados.
NEW: 6. **Run as Pablo (no SYSTEM)** — el cron monitor + tareas Windows usan el usuario del CEO, no privilegios elevados.
```

#### L146 — REPLACE

**Reason:** active text

```
OLD: - `heartbeat-monitor` es **solución parcial** al problema "Rey ausente largo" — archiva mensajes pero no despierta a Lord Claudia para procesarlos. Solución completa: daemon agente independiente (propuesto, pendiente sign-off Rey, ver `feedback_autonomia_contra_silencio_3min.md` sección "Solución completa pendiente").
NEW: - `heartbeat-monitor` es **solución parcial** al problema "CEO ausente largo" — archiva mensajes pero no despierta a Claudia CoS para procesarlos. Solución completa: daemon agente independiente (propuesto, pendiente sign-off CEO, ver `feedback_autonomia_contra_silencio_3min.md` sección "Solución completa pendiente").
```

#### L148 — REPLACE

**Reason:** active text

```
OLD: - Voice transcription en CPU: ~9x realtime. Audios largos del Rey (>30s) toman 5+ min. Avisar.
NEW: - Voice transcription en CPU: ~9x realtime. Audios largos del CEO (>30s) toman 5+ min. Avisar.
```

### B2 — piper-tts/README.md

#### L1 — REPLACE

**Reason:** active text

```
OLD: # Piper TTS Bridge — Lord Claude → Rey por Telegram (audio)
NEW: # Piper TTS Bridge — Claudia CoS → CEO por Telegram (audio)
```

#### L3 — KEEP-historico

**Reason:** inline dated decree

```
OLD: Lord Claude → audio voice messages al Rey por Telegram, sintetizado 100% local. Built 2026-05-14 sesión 4ª.
```

#### L12 — REPLACE-surgical

**Reason:** filename literal + active

```
OLD: | **bot token + chat_id Rey** | env from `lord-claude.credentials` | `%USERPROFILE%\.secrets\` | ACL solo-Pablo |
NEW: | **bot token + chat_id CEO** | env from `lord-claude.credentials` | `%USERPROFILE%\.secrets\` | ACL solo-Pablo |
```

#### L17 — REPLACE

**Reason:** active text

```
OLD: # Mandar texto como voice message al Rey
NEW: # Mandar texto como voice message al CEO
```

#### L18 — REPLACE

**Reason:** active text

```
OLD: python send_voice.py --text "Hola Rey, mensaje urgente"
NEW: python send_voice.py --text "Hola CEO, mensaje urgente"
```

#### L66 — REPLACE

**Reason:** active text

```
OLD: ## Cuándo Lord Claude usa esto
NEW: ## Cuándo Claudia CoS usa esto
```

#### L72 — REPLACE

**Reason:** active text

```
OLD: | Reporte cierre de sesión (#16) | Texto (no audio) — el Rey debe poder copiar/leer en su tiempo |
NEW: | Reporte cierre de sesión (#16) | Texto (no audio) — el CEO debe poder copiar/leer en su tiempo |
```

#### L73 — REPLACE

**Reason:** active text

```
OLD: | Lord Claude trabado | Texto en ambos canales |
NEW: | Claudia CoS trabado | Texto en ambos canales |
```

#### L74 — REPLACE

**Reason:** active text

```
OLD: | Rey escribió por Telegram | Lord Claude responde por Telegram (texto por default, audio TTS si el Rey lo pide explícitamente) |
NEW: | CEO escribió por Telegram | Claudia CoS responde por Telegram (texto por default, audio TTS si el CEO lo pide explícitamente) |
```

#### L75 — REPLACE

**Reason:** active text

```
OLD: | Rey escribió audio por Telegram → Lord Claude transcribe | Responde texto por Telegram (mostrando la transcripción) — NO audio TTS (sería ping-pong audio) |
NEW: | CEO escribió audio por Telegram → Claudia CoS transcribe | Responde texto por Telegram (mostrando la transcripción) — NO audio TTS (sería ping-pong audio) |
```

#### L76 — REPLACE

**Reason:** active text

```
OLD: | Alerta urgente del bot | Audio TTS opcional para que el Rey "escuche" la alerta cuando no puede leer |
NEW: | Alerta urgente del bot | Audio TTS opcional para que el CEO "escuche" la alerta cuando no puede leer |
```

### B2 — telegram-voice-bridge/README.md

#### L1 — REPLACE

**Reason:** active text

```
OLD: # Telegram Voice Bridge — Lord Claude
NEW: # Telegram Voice Bridge — Claudia CoS
```

#### L3 — KEEP-historico

**Reason:** inline dated decree

```
OLD: Local-only voice→text transcription for Telegram voice messages the Rey sends to `@impluxa_consorte_bot`. Built 2026-05-14 sesión 4ª.
```

#### L14 — REPLACE

**Reason:** active text

```
OLD: | Whisper model | large-v3 (Systran/faster-whisper-large-v3, rev `edaa852e`) | "Que sea preciso" (Rey 2026-05-14) |
NEW: | Whisper model | large-v3 (Systran/faster-whisper-large-v3, rev `edaa852e`) | "Que sea preciso" (CEO 2026-05-14) |
```

#### L69 — REPLACE

**Reason:** active text

```
OLD: 5. No transcript ever logged to disk or Impluxa Hakuna — it's a tool result handed to Lord Claude only.
NEW: 5. No transcript ever logged to disk or Impluxa Hakuna — it's a tool result handed to Claudia CoS only.
```

#### L79 — REPLACE

**Reason:** active text

```
OLD: ## Lord Claude integration (polling loop)
NEW: ## Claudia CoS integration (polling loop)
```

#### L81 — REPLACE

**Reason:** active text

```
OLD: When Lord Claude's `getUpdates` poll returns a message with `message.voice`, he calls:
NEW: When Claudia CoS's `getUpdates` poll returns a message with `message.voice`, he calls:
```

#### L87 — REPLACE

**Reason:** active text

```
OLD: Parses the JSON, treats `result.text` as if it were a regular text message from the Rey on Telegram (per regla CLAUDE.md #14.c: respond IMMEDIATELY on Telegram + chat mirror).
NEW: Parses the JSON, treats `result.text` as if it were a regular text message from the CEO on Telegram (per regla CLAUDE.md #14.c: respond IMMEDIATELY on Telegram + chat mirror).
```

#### L89 — REPLACE

**Reason:** active text

```
OLD: The Rey's voice message is acknowledged with "🎤 Audio recibido — transcripción: [text]. Entendido, ejecuto [action]." in both channels.
NEW: The CEO's voice message is acknowledged with "🎤 Audio recibido — transcripción: [text]. Entendido, ejecuto [action]." in both channels.
```

### B2 — supabase-config-bootstrap/README.md

#### L4 — REPLACE

**Reason:** active text

```
OLD: Supabase Management API. Reemplaza los 3 sub-pasos que el Rey iba a hacer
NEW: Supabase Management API. Reemplaza los 3 sub-pasos que el CEO iba a hacer
```

#### L52 — REPLACE

**Reason:** active text

```
OLD:   con ACL solo-Pablo, NUNCA commitear, rotación cada 90d o post-uso si el Rey
NEW:   con ACL solo-Pablo, NUNCA commitear, rotación cada 90d o post-uso si el CEO
```

### B3 — BACKLOG.md

#### L45 — REPLACE

**Reason:** active text

```
OLD: - **Defer reason**: when a tenant-claim action payload has `jwt_jti` null (gotrue/SDK regression scenario S2 from SE threat model — only reachable scenario in prod), `audit.ts:86-98` emits a `console.warn` but does NOT short-circuit, so `append_audit` proceeds and the dedup gate at `20260518_v026_001_audit_dedup.sql:143` skips its `if` block (it requires non-null `v_jti`), inserting a fresh `audit_log` row per retry. Cold-round BA cold flagged this as HIGH "corrupts FR-RLS-BURN-2 readiness signal". Re-review fresh BA + SE concur it is MED (not HIGH): the gate at `observe-rls-burn-readiness.ts:249-254` is binary (`claim_missing > 0` → NO-GO), count inflation does NOT flip the verdict; SPEC.md:60 confirms the real gate is human Rey sign-off, not script auto-flip; direction of corruption is fail-closed (false NO-GO = safe direction, not exploitable false GO). All proposed FIX-AHORA mitigations are out of scope for Cut B (auth-boundary reject breaks T5 compat; fail-closed at audit.ts reverses fail direction to UNSAFE; synthetic dedup PK is schema change).
NEW: - **Defer reason**: when a tenant-claim action payload has `jwt_jti` null (gotrue/SDK regression scenario S2 from SE threat model — only reachable scenario in prod), `audit.ts:86-98` emits a `console.warn` but does NOT short-circuit, so `append_audit` proceeds and the dedup gate at `20260518_v026_001_audit_dedup.sql:143` skips its `if` block (it requires non-null `v_jti`), inserting a fresh `audit_log` row per retry. Cold-round BA cold flagged this as HIGH "corrupts FR-RLS-BURN-2 readiness signal". Re-review fresh BA + SE concur it is MED (not HIGH): the gate at `observe-rls-burn-readiness.ts:249-254` is binary (`claim_missing > 0` → NO-GO), count inflation does NOT flip the verdict; SPEC.md:60 confirms the real gate is human CEO sign-off, not script auto-flip; direction of corruption is fail-closed (false NO-GO = safe direction, not exploitable false GO). All proposed FIX-AHORA mitigations are out of scope for Cut B (auth-boundary reject breaks T5 compat; fail-closed at audit.ts reverses fail direction to UNSAFE; synthetic dedup PK is schema change).
```

#### L119 — KEEP-META

**Reason:** migration mapping slash

```
OLD:   - **Migracion vocabulario completa segundo-cerebro**: grep masivo + reemplazo `Rey/Lord/Reino/Consejo → CEO/Claudia/Impluxa/Squad` en todos los archivos (notes, lessons, transcripts, topic files no tocados, lo que aparezca). Ya migrado: CLAUDE.md v2.2 + MEMORY.md s16 + topic file `feedback_vocabulario_convoco_consejo.md` s16. Pendiente: resto de `D:\segundo-cerebro\` (lessons, aprendizajes, hot.md, session-boot legacy entries, scripts, Task Scheduler names, `audit-decisions.ps1`, credentials filename, etc).
```

#### L230 — KEEP-whitelist

**Reason:** filename/Task literal

```
OLD: - **Nota agregada s18 turn 22**: considerar `pending-rey-messages.jsonl` rename como parte del scope s19:
```

#### L237 — KEEP-META

**Reason:** runtime schema spec

```
OLD:   - **`state.json` runtime schema migration**: keys del JSON activo escritas por `monitor.py` contienen vocab viejo: `identity.lord` → `identity.claudia` / `identity.rey` → `identity.ceo` / `consejo_validated.*` → `squad_validated.*` (verificar schema completo). Migration coordinated: actualizar (a) codigo Python que escribe el state + (b) codigo Python que lo lee + (c) state.json en sitio runtime + (d) doc heartbeat-monitor.md schema description. Riesgo: ventana mid-migration donde codigo escribe schema mixto (lee vocab nuevo + escribe vocab viejo o viceversa). Mitigacion: backup state.json pre-edit + apply orden codigo-reader → codigo-writer → state.json → doc.
```

#### L259 — KEEP-whitelist

**Reason:** backtick-protected vocab

```
OLD:   - `Vision Casa Habitable -- Plan Reino Impluxa.md` historico pre-pivot.
```

#### L337 — KEEP-META

**Reason:** migration mapping slash

```
OLD: - **Sub-item DEFER sweep s19b**: **15 entries MEMORY.md DEFER por vocab viejo inline (Rey/Lord/Reino/Consejo)** — compactar post-migration vocab completada. 8 lessons C6 (lineas 99 declarar-veredicto / 106 pedir-mano-rey / 108 propuse-solucion-grande / 116 recomendacion-sin-consejo / 118 Hakuna fotos / 120 esperar-ok-rey-t2 / 121 preguntar-proxima-tarea / 122 3h-silencio-telegram) + 7 B Bloque (29 Credenciales Lord Claude / 30 Protocolo v6.0 / 31 Capabilities matrix "reino" / 37 Modelo ejecucion / 38 Sentinel preflight / 39 Force-signout / 47 Pull-forward). Estimate compactacion DEFER sub-item: ~1h post-sweep s19b vocab migration.
```

### B3 — CHANGELOG.md

#### L22 — KEEP-historico

**Reason:** Changelog versioned

```
OLD: - Rey re-login OTP validated end-to-end + audit_log CHAIN_OK
```

#### L116 — REPLACE

**Reason:** active text

```
OLD:   Lord Claudia awaiting + chat silencio >3min.
NEW:   Claudia CoS awaiting + chat silencio >3min.
```

#### L117 — REPLACE

**Reason:** active text

```
OLD: - **Skill `/loop 4min`** (CronCreate job, session-only) — Lord Claudia trabaja
NEW: - **Skill `/loop 4min`** (CronCreate job, session-only) — Claudia CoS trabaja
```

#### L124 — REPLACE

**Reason:** active text

```
OLD:   porque dependen de secrets pendientes del Rey o decisiones estratégicas.
NEW:   porque dependen de secrets pendientes del CEO o decisiones estratégicas.
```

#### L140 — REPLACE

**Reason:** active text

```
OLD: ### Pending para cerrar 0.2.5 (no-autónomo, requieren ASK al Rey o input humano)
NEW: ### Pending para cerrar 0.2.5 (no-autónomo, requieren ASK al CEO o input humano)
```

#### L150 — REPLACE

**Reason:** active text

```
OLD:   T4 irreversible que requiere sign-off explícito del Rey Jota.
NEW:   T4 irreversible que requiere sign-off explícito del CEO Jota.
```

#### L161 — REPLACE

**Reason:** active text

```
OLD: - Daemon Lord Claudia independiente (cuando se aprobe Opción A propuesta).
NEW: - Daemon Claudia CoS independiente (cuando se aprobe Opción A propuesta).
```

### B4 — onboarding-v0.2.5.md

#### L4 — REPLACE

**Reason:** active text

```
OLD: > sumen al Reino Impluxa, o auditorías técnicas externas.
NEW: > sumen al Impluxa, o auditorías técnicas externas.
```

#### L20 — REPLACE

**Reason:** active text

```
OLD:    sign-off explícito del Rey Jota en el mismo turn. Hay un hook PreToolUse
NEW:    sign-off explícito del CEO Jota en el mismo turn. Hay un hook PreToolUse
```

#### L114 — REPLACE

**Reason:** active text

```
OLD: | `SSO_JWT_SECRET`                     | Rey Jota     | `openssl rand -hex 32` + cargar a Vercel        |
NEW: | `SSO_JWT_SECRET`                     | CEO Jota     | `openssl rand -hex 32` + cargar a Vercel        |
```

#### L115 — REPLACE

**Reason:** active text

```
OLD: | `SEND_EMAIL_HOOK_SECRET`             | Rey Jota     | Lo genera Supabase al habilitar Send Email Hook |
NEW: | `SEND_EMAIL_HOOK_SECRET`             | CEO Jota     | Lo genera Supabase al habilitar Send Email Hook |
```

#### L116 — REPLACE

**Reason:** active text

```
OLD: | Habilitar Custom Access Token Hook   | Rey Jota     | Supabase Dashboard → Auth → Hooks               |
NEW: | Habilitar Custom Access Token Hook   | CEO Jota     | Supabase Dashboard → Auth → Hooks               |
```

#### L117 — REPLACE

**Reason:** active text

```
OLD: | Habilitar Send Email Hook            | Rey Jota     | Supabase Dashboard → Auth → Hooks               |
NEW: | Habilitar Send Email Hook            | CEO Jota     | Supabase Dashboard → Auth → Hooks               |
```

#### L118 — REPLACE

**Reason:** active text

```
OLD: | SMTP Resend configurado              | Rey Jota     | Supabase Dashboard → Auth → SMTP                |
NEW: | SMTP Resend configurado              | CEO Jota     | Supabase Dashboard → Auth → SMTP                |
```

#### L119 — REPLACE

**Reason:** active text

```
OLD: | W3.G3.T3 Send Email Hook route       | Lord Claudia | Bloqueado en `SEND_EMAIL_HOOK_SECRET`           |
NEW: | W3.G3.T3 Send Email Hook route       | Claudia CoS | Bloqueado en `SEND_EMAIL_HOOK_SECRET`           |
```

#### L120 — REPLACE

**Reason:** active text

```
OLD: | W3.G2 SSO provider choice            | Rey Jota     | Decisión estratégica Google/GitHub/SAML         |
NEW: | W3.G2 SSO provider choice            | CEO Jota     | Decisión estratégica Google/GitHub/SAML         |
```

#### L121 — REPLACE

**Reason:** active text

```
OLD: | W3.G4 MFA TOTP vs WebAuthn           | Rey Jota     | Decisión estratégica + recovery codes UX        |
NEW: | W3.G4 MFA TOTP vs WebAuthn           | CEO Jota     | Decisión estratégica + recovery codes UX        |
```

#### L122 — REPLACE

**Reason:** active text

```
OLD: | Merge a main + tag `v0.2.5` + deploy | Rey Jota     | T4 irreversible — sign-off explícito            |
NEW: | Merge a main + tag `v0.2.5` + deploy | CEO Jota     | T4 irreversible — sign-off explícito            |
```

#### L131 — REPLACE

**Reason:** active text

```
OLD: - Daemon Lord Claudia independiente (resuelve grieta sesión cerrada)
NEW: - Daemon Claudia CoS independiente (resuelve grieta sesión cerrada)
```

#### L135 — REPLACE

**Reason:** active text

```
OLD: - **#20** Próxima tarea técnica autónoma = Lord Claudia + consejo deciden, no preguntar al Rey
NEW: - **#20** Próxima tarea técnica autónoma = Claudia CoS + Squad deciden, no preguntar al CEO
```

#### L138 — REPLACE

**Reason:** active text

```
OLD: - **#23** Naming oficial: Rey Jota + Lord Mano Claudia (femenino, voz Daniela TTS)
NEW: - **#23** Naming oficial: CEO Jota + Claudia CoS (femenino, voz Daniela TTS)
```

#### L140 — REPLACE

**Reason:** active text

```
OLD: - **Santo Grial** (regla cardinal): ANTES de proponer cualquier solución al Rey → invocar consejo real + chequear arsenal de skills. Lord Claudia NUNCA decide sola.
NEW: - **Santo Grial** (regla cardinal): ANTES de proponer cualquier solución al CEO → invocar Squad real + chequear arsenal de skills. Claudia CoS NUNCA decide sola.
```

#### L153 — REPLACE

**Reason:** active text

```
OLD: ## Quién es quién del consejo del arsenal (top experts consultados en este sprint)
NEW: ## Quién es quién del Squad (top experts consultados en este sprint)
```

#### L159 — REPLACE

**Reason:** active text

```
OLD: | **Senior PM**          | Roadmap autónomo ~20h, scope safe vs ASK al Rey                                                           |
NEW: | **Senior PM**          | Roadmap autónomo ~20h, scope safe vs ASK al CEO                                                           |
```

#### L166 — REPLACE

**Reason:** active text

```
OLD: - **Telegram bot:** `@impluxa_consorte_bot` (chat_id Rey Jota = `6698732267`).
NEW: - **Telegram bot:** `@impluxa_consorte_bot` (chat_id CEO Jota = `6698732267`).
```

### B4 — auth-incident-response.md

#### L19 — REPLACE

**Reason:** active text

```
OLD: - TOTP/MFA reset request from Rey or admin user
NEW: - TOTP/MFA reset request from CEO or admin user
```

#### L30 — REPLACE

**Reason:** active text

```
OLD: | **AUTH-SEV-1** | Active cross-tenant data exposure OR all logins broken OR known credential leak in attacker hands               | RLS bug returning tenant B rows to tenant A user; mass `Error running hook URI`; service-role key in public commit | <30 min recovery, immediate Rey ASK    |
NEW: | **AUTH-SEV-1** | Active cross-tenant data exposure OR all logins broken OR known credential leak in attacker hands               | RLS bug returning tenant B rows to tenant A user; mass `Error running hook URI`; service-role key in public commit | <30 min recovery, immediate CEO ASK    |
```

#### L31 — REPLACE

**Reason:** active text

```
OLD: | **AUTH-SEV-2** | Single user locked out OR magic link broken for some receivers OR suspected (not confirmed) credential exposure | Hakuna user can't log in; Outlook spam folder for magic links; secret in private gist                              | <2 hours, Rey notify, scheduled fix    |
NEW: | **AUTH-SEV-2** | Single user locked out OR magic link broken for some receivers OR suspected (not confirmed) credential exposure | Hakuna user can't log in; Outlook spam folder for magic links; secret in private gist                              | <2 hours, CEO notify, scheduled fix    |
```

#### L32 — REPLACE

**Reason:** active text

```
OLD: | **AUTH-SEV-3** | Cosmetic UX issue OR suspected scan/probe in audit log                                                          | "Session expired" message confusing; failed login from unknown IP single hit                                       | <24 hours, Rey notify in cierre report |
NEW: | **AUTH-SEV-3** | Cosmetic UX issue OR suspected scan/probe in audit log                                                          | "Session expired" message confusing; failed login from unknown IP single hit                                       | <24 hours, CEO notify in cierre report |
```

#### L40 — REPLACE

**Reason:** active text

```
OLD: 1. **Immediate containment** (Lord Claudia executes WITHOUT Rey ASK — preventive, reversible):
NEW: 1. **Immediate containment** (Claudia CoS executes WITHOUT CEO ASK — preventive, reversible):
```

#### L51 — REPLACE

**Reason:** active text

```
OLD: 3. **Rey ASK** (gravedad #21.a) for next steps: rollback last migration / disable hook / etc.
NEW: 3. **CEO ASK** (gravedad #21.a) for next steps: rollback last migration / disable hook / etc.
```

#### L67 — REPLACE

**Reason:** active text

```
OLD:    - **DISABLE hook immediately** (Rey ASK gravedad #21.a, decision #38 pattern).
NEW:    - **DISABLE hook immediately** (CEO ASK gravedad #21.a, decision #38 pattern).
```

#### L87 — REPLACE

**Reason:** active text

```
OLD: 5. **Postmortem** mandatory + report to Rey + LGPD/AAIP notification check.
NEW: 5. **Postmortem** mandatory + report to CEO + LGPD/AAIP notification check.
```

#### L95 — REPLACE

**Reason:** active text

```
OLD: 3. Manual fix via SQL editor (Rey ASK gravedad #21.a, low-risk surgery):
NEW: 3. Manual fix via SQL editor (CEO ASK gravedad #21.a, low-risk surgery):
```

#### L126 — REPLACE

**Reason:** active text

```
OLD: | Incident type                     | TTR target                | Reversible?                     | Requires Rey OK          |
NEW: | Incident type                     | TTR target                | Reversible?                     | Requires CEO OK          |
```

#### L138 — REPLACE

**Reason:** active text

```
OLD: - **Skip Rey ASK on prod auth changes.** Even "obvious" rollback to prior known-good state needs explicit Rey OK per regla #21.a.
NEW: - **Skip CEO ASK on prod auth changes.** Even "obvious" rollback to prior known-good state needs explicit CEO OK per regla #21.a.
```

#### L142 — REPLACE

**Reason:** active text

```
OLD: - **Telegram secrets to Rey.** Even during incident. Use file paths + lengths + format prefixes per lesson `credenciales-en-transcript`.
NEW: - **Telegram secrets to CEO.** Even during incident. Use file paths + lengths + format prefixes per lesson `credenciales-en-transcript`.
```

### B4 — v0.2.6-rls-burn-rollback.md

#### L26 — REPLACE

**Reason:** active text

```
OLD: If only #1 + (suspicious symptom but not confirmed user impact) → STOP, escalate to consejo (Backend Architect + Security Engineer + Senior PM convene), do NOT roll back yet. False rollbacks during a real incident waste recovery time.
NEW: If only #1 + (suspicious symptom but not confirmed user impact) → STOP, escalate to Squad (Backend Architect + Security Engineer + Senior PM convene), do NOT roll back yet. False rollbacks during a real incident waste recovery time.
```

#### L45 — REPLACE

**Reason:** active text

```
OLD: 4. **Get Rey OK explicit** (gravedad #21.a, prod Hakuna live). Rollback is a write to prod DB; even though it restores known-good state, it is NOT auto-promoted by Lord Claudia. Telegram + chat ASK + Rey "OK procedo".
NEW: 4. **Get CEO OK explicit** (gravedad #21.a, prod Hakuna live). Rollback is a write to prod DB; even though it restores known-good state, it is NOT auto-promoted by Claudia CoS. Telegram + chat ASK + CEO "OK procedo".
```

#### L55 — REPLACE

**Reason:** active text

```
OLD: The file MUST be present. It was captured at burn-migration-write-time via `pg_dump --schema-only --table=public.{sites,leads_tenant,subscriptions,activity_log}` and frozen into the repo. If file is MISSING → STOP, escalate to consejo (this is an architecture violation; rollback cannot proceed safely without snapshot).
NEW: The file MUST be present. It was captured at burn-migration-write-time via `pg_dump --schema-only --table=public.{sites,leads_tenant,subscriptions,activity_log}` and frozen into the repo. If file is MISSING → STOP, escalate to Squad (this is an architecture violation; rollback cannot proceed safely without snapshot).
```

#### L70 — REPLACE

**Reason:** active text

```
OLD: ### Step 3 — Apply to prod (Rey-gated)
NEW: ### Step 3 — Apply to prod (CEO-gated)
```

#### L77 — REPLACE

**Reason:** active text

```
OLD: Or via Supabase MCP `apply_migration` with explicit migration body (recommended — same auth as Lord Claudia daily ops).
NEW: Or via Supabase MCP `apply_migration` with explicit migration body (recommended — same auth as Claudia CoS daily ops).
```

#### L92 — REPLACE

**Reason:** active text

```
OLD: 1. Rey re-loguea (logout + magic link) to refresh session.
NEW: 1. CEO re-loguea (logout + magic link) to refresh session.
```

#### L99 — REPLACE

**Reason:** active text

```
OLD: 1. Telegram al Rey: rollback applied + verify result + impact summary (downtime min, # users affected).
NEW: 1. Telegram al CEO: rollback applied + verify result + impact summary (downtime min, # users affected).
```

#### L106 — REPLACE

**Reason:** active text

```
OLD: - Detection → Rey OK ASK: <5 min
NEW: - Detection → CEO OK ASK: <5 min
```

#### L107 — REPLACE

**Reason:** active text

```
OLD: - Rey OK → migration applied: <2 min
NEW: - CEO OK → migration applied: <2 min
```

#### L116 — REPLACE

**Reason:** active text

```
OLD: - **Skip Rey OK on rollback because "we already have OK on the burn".** No — those are two distinct prod writes. Each requires its own ASK per regla #21.a.
NEW: - **Skip CEO OK on rollback because "we already have OK on the burn".** No — those are two distinct prod writes. Each requires its own ASK per regla #21.a.
```

### B4 — dmarc-monitoring.md

#### L28 — REPLACE

**Reason:** active text

```
OLD: 2. If alias only — set up forward to a Rey-readable inbox (Gmail, Outlook personal).
NEW: 2. If alias only — set up forward to a CEO-readable inbox (Gmail, Outlook personal).
```

#### L42 — REPLACE

**Reason:** active text

```
OLD: # - Send summary to Rey via Telegram OR write to D:/segundo-cerebro/wiki/meta/dmarc-weekly-<date>.md
NEW: # - Send summary to CEO via Telegram OR write to D:/segundo-cerebro/wiki/meta/dmarc-weekly-<date>.md
```

### B4 — audit-log-partition-management.md

#### L43 — REPLACE

**Reason:** active text

```
OLD: 1. **Manual partition creation** (T2, requires Rey OK gravedad #21.a):
NEW: 1. **Manual partition creation** (T2, requires CEO OK gravedad #21.a):
```

#### L74 — REPLACE

**Reason:** active text

```
OLD: **Procedure (T4, requires Rey OK gravedad #21.a + legal sign-off):**
NEW: **Procedure (T4, requires CEO OK gravedad #21.a + legal sign-off):**
```

#### L95 — REPLACE

**Reason:** active text

```
OLD: 3. **Document redaction** in `D:\segundo-cerebro\wiki\incidents\<DATE>-gdpr-erasure-<short>.md` with: request date + legal basis + rows affected + Rey approval timestamp.
NEW: 3. **Document redaction** in `D:\segundo-cerebro\wiki\incidents\<DATE>-gdpr-erasure-<short>.md` with: request date + legal basis + rows affected + CEO approval timestamp.
```

#### L102 — REPLACE

**Reason:** active text

```
OLD: **Procedure (T2, requires Rey OK):**
NEW: **Procedure (T2, requires CEO OK):**
```

#### L166 — REPLACE

**Reason:** active text

```
OLD: 4. **Re-enable rotation** after legal release with explicit Rey OK.
NEW: 4. **Re-enable rotation** after legal release with explicit CEO OK.
```

### B4 — secret-rotation.md

#### L56 — KEEP-historico

**Reason:** inline dated decree

```
OLD: - **Last rotation:** 2026-05-15 decision #28 sesión 5ª (generated locally, applied by Rey manual). Cleaned up local file decision #33 sesión 6ª.
```

#### L95 — REPLACE

**Reason:** active text

```
OLD:   4. Update any Vercel env if bot is used from server-side (currently CLI only from Lord Claudia).
NEW:   4. Update any Vercel env if bot is used from server-side (currently CLI only from Claudia CoS).
```

### B4 — env-var-usage.md

#### L37 — REPLACE

**Reason:** active text

```
OLD: | `KING_SIGNED`                                 | (read directly in script guards) | `scripts/force-global-signout.ts` line 62 — guard to require explicit Rey approval    |
NEW: | `KING_SIGNED`                                 | (read directly in script guards) | `scripts/force-global-signout.ts` line 62 — guard to require explicit CEO approval    |
```

### B4 — next-session.md

#### L45 — KEEP-popcultureref

**Reason:** pop culture proper noun (caps or kebab)

```
OLD: - Combos populares: **Hakuna Matata + Rey León**
```

### B5 — observe-rls-burn-readiness.ts

#### L7 — REPLACE

**Reason:** active text

```
OLD:  * 2026-05-15 consejo veredict on SPEC OQ-7).
NEW:  * 2026-05-15 Squad veredict on SPEC OQ-7).
```

#### L283 — REPLACE

**Reason:** active text

```
OLD:       "Next: Rey OK explicit (gravedad #21.a) → apply burn → 1h post-burn intensive monitoring.",
NEW:       "Next: CEO OK explicit (gravedad #21.a) → apply burn → 1h post-burn intensive monitoring.",
```

### B5 — force-global-signout.ts

#### L15 — REPLACE

**Reason:** active text

```
OLD:  * **NO CORRER SIN SIGN-OFF EXPLÍCITO DEL REY** (T4 irreversible sobre prod
NEW:  * **NO CORRER SIN SIGN-OFF EXPLÍCITO DEL CEO** (T4 irreversible sobre prod
```

#### L67 — REPLACE

**Reason:** active text

```
OLD:       "Esta es protección defense-in-depth — el Rey debe firmar explícito.",
NEW:       "Esta es protección defense-in-depth — el CEO debe firmar explícito.",
```

#### L146 — REPLACE

**Reason:** active text

```
OLD:     "Smoketest: Pablo (Rey Jota) debe ver session expired + recibir magic link al re-login.",
NEW:     "Smoketest: Pablo (CEO Jota) debe ver session expired + recibir magic link al re-login.",
```

### B5 — defaults.ts

#### L59 — KEEP-popcultureref

**Reason:** pop culture proper noun (caps or kebab)

```
OLD:       key: "rey-leon",
```

#### L60 — KEEP-popcultureref

**Reason:** pop culture proper noun (caps or kebab)

```
OLD:       name: "Rey León",
```

### B5 — audit.ts

#### L89 — REPLACE

**Reason:** active text

```
OLD:   // SAFE direction (real gate is human Rey sign-off per SPEC.md:60).
NEW:   // SAFE direction (real gate is human CEO sign-off per SPEC.md:60).
```
