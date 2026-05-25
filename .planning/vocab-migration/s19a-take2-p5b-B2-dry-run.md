# P5b Batch B2 — DEFER infra READMEs dry-run

Generated: 2026-05-25
Classifier: v2 (5 refinements pre-loaded turn-1 per CEO directive B1 retro)

## Summary table

| File                                | Total | REPLACE | R-surgical | KEEP-h | KEEP-META | KEEP-wl |
| ----------------------------------- | ----- | ------- | ---------- | ------ | --------- | ------- |
| impluxa-utils/README.md             | 26    | 22      | 4          | 0      | 0         | 0       |
| piper-tts/README.md                 | 11    | 9       | 1          | 1      | 0         | 0       |
| telegram-voice-bridge/README.md     | 8     | 7       | 0          | 1      | 0         | 0       |
| supabase-config-bootstrap/README.md | 2     | 2       | 0          | 0      | 0         | 0       |

**Grand total:** 47 matches / 40 REPLACE clean / 5 REPLACE-surgical / **45 actionable**.

## impluxa-utils/README.md

### L1 — REPLACE

**Reason:** active text

```
OLD: # Impluxa Utils — herramientas locales del Reino
NEW: # Impluxa Utils — herramientas locales de Impluxa
```

### L4 — REPLACE

**Reason:** active text

```
OLD: > acá corre **100% local en la PC del Rey Jota**, sin cloud, sin telemetría.
NEW: > acá corre **100% local en la PC del CEO Jota**, sin cloud, sin telemetría.
```

### L13 — REPLACE

**Reason:** active text

```
OLD: ├─ telegram-voice-bridge\          ← Whisper local: voz del Rey → texto
NEW: ├─ telegram-voice-bridge\          ← Whisper local: voz del CEO → texto
```

### L14 — REPLACE

**Reason:** active text

```
OLD: └─ piper-tts\                      ← Piper local: texto Lord Claudia → voz Daniela arg
NEW: └─ piper-tts\                      ← Piper local: texto Claudia CoS → voz Daniela arg
```

### L22 — REPLACE-surgical

**Reason:** filename literal + active vocab mixed

```
OLD: Telegram del Rey en `pending-rey-messages.jsonl` mientras Lord Claudia está
NEW: Telegram del CEO en `pending-rey-messages.jsonl` mientras Claudia CoS está
```

### L23 — REPLACE

**Reason:** active text

```
OLD: fuera de sesión. Manda Telegram heartbeat "🔄 Continúo con X" si Lord Claudia
NEW: fuera de sesión. Manda Telegram heartbeat "🔄 Continúo con X" si Claudia CoS
```

### L28 — REPLACE

**Reason:** active text

```
OLD: - `state.json` (estado compartido con Lord Claudia in-session)
NEW: - `state.json` (estado compartido con Claudia CoS in-session)
```

### L29 — REPLACE-surgical

**Reason:** filename literal + active vocab mixed

```
OLD: - `pending-rey-messages.jsonl` (archivo de mensajes Rey llegados off-session)
NEW: - `pending-rey-messages.jsonl` (archivo de mensajes CEO llegados off-session)
```

### L52 — REPLACE

**Reason:** active text

```
OLD: ### `telegram-voice-bridge/` — Whisper local (Rey → Lord Claudia)
NEW: ### `telegram-voice-bridge/` — Whisper local (CEO → Claudia CoS)
```

### L54 — REPLACE

**Reason:** active text

```
OLD: **Qué hace:** cuando el Rey manda un voice message por Telegram al bot
NEW: **Qué hace:** cuando el CEO manda un voice message por Telegram al bot
```

### L55 — REPLACE

**Reason:** active text

```
OLD: `@impluxa_consorte_bot`, Lord Claudia llama este script con el `file_id`. El
NEW: `@impluxa_consorte_bot`, Claudia CoS llama este script con el `file_id`. El
```

### L57 — REPLACE

**Reason:** active text

```
OLD: local, y devuelve JSON con texto. Lord Claudia trata la transcripción como si
NEW: local, y devuelve JSON con texto. Claudia CoS trata la transcripción como si
```

### L58 — REPLACE

**Reason:** active text

```
OLD: el Rey lo hubiera escrito normal.
NEW: el CEO lo hubiera escrito normal.
```

### L80 — REPLACE

**Reason:** active text

```
OLD: ### `piper-tts/` — Piper local (Lord Claudia → Rey)
NEW: ### `piper-tts/` — Piper local (Claudia CoS → CEO)
```

### L82 — REPLACE

**Reason:** active text

```
OLD: **Qué hace:** Lord Claudia mete texto, Piper sintetiza voz Daniela argentina
NEW: **Qué hace:** Claudia CoS mete texto, Piper sintetiza voz Daniela argentina
```

### L84 — REPLACE

**Reason:** active text

```
OLD: `sendVoice` API. Audio nunca sale del PC del Rey.
NEW: `sendVoice` API. Audio nunca sale del PC del CEO.
```

### L92 — REPLACE-surgical

**Reason:** filename literal + active vocab mixed

```
OLD: - Bot token + chat_id Rey leídos de `%USERPROFILE%\.secrets\lord-claude.credentials`
NEW: - Bot token + chat_id CEO leídos de `%USERPROFILE%\.secrets\lord-claude.credentials`
```

### L96 — REPLACE

**Reason:** active text

```
OLD: python D:/impluxa-utils/piper-tts/send_voice.py --text "Hola Rey, mensaje urgente"
NEW: python D:/impluxa-utils/piper-tts/send_voice.py --text "Hola CEO, mensaje urgente"
```

### L105 — REPLACE

**Reason:** active text

```
OLD: - Audio TTS: Rey lo pide explícito / alerta urgente sin pantalla / demo capacidad
NEW: - Audio TTS: CEO lo pide explícito / alerta urgente sin pantalla / demo capacidad
```

### L115 — REPLACE

**Reason:** active text

```
OLD: | `D:\segundo-cerebro\wiki\meta\session-boot.md` | Fuente única de verdad para arranque de sesión (Lord Claudia lee primero) |
NEW: | `D:\segundo-cerebro\wiki\meta\session-boot.md` | Fuente única de verdad para arranque de sesión (Claudia CoS lee primero) |
```

### L118 — REPLACE

**Reason:** active text

```
OLD: | `C:\Users\Pablo\.claude\CLAUDE.md` | 24 reglas operativas del Reino |
NEW: | `C:\Users\Pablo\.claude\CLAUDE.md` | 24 reglas operativas de Impluxa |
```

### L121 — REPLACE-surgical

**Reason:** filename literal + active vocab mixed

```
OLD: | `%USERPROFILE%\.secrets\lord-claude.credentials` | Llaves del reino (Telegram + Cloudflare + Resend + Upstash + Vercel) |
NEW: | `%USERPROFILE%\.secrets\lord-claude.credentials` | Llaves del reino (Telegram + Cloudflare + Resend + Upstash + Vercel) |
```

### L125 — REPLACE

**Reason:** active text

```
OLD: 1. **100% local** — sin cloud TTS/STT, sin telemetría, audio nunca sale del PC del Rey.
NEW: 1. **100% local** — sin cloud TTS/STT, sin telemetría, audio nunca sale del PC del CEO.
```

### L130 — REPLACE

**Reason:** active text

```
OLD: 6. **Run as Pablo (no SYSTEM)** — el cron monitor + tareas Windows usan el usuario del Rey, no privilegios elevados.
NEW: 6. **Run as Pablo (no SYSTEM)** — el cron monitor + tareas Windows usan el usuario del CEO, no privilegios elevados.
```

### L146 — REPLACE

**Reason:** active text

```
OLD: - `heartbeat-monitor` es **solución parcial** al problema "Rey ausente largo" — archiva mensajes pero no despierta a Lord Claudia para procesarlos. Solución completa: daemon agente independiente (propuesto, pendiente sign-off Rey, ver `feedback_autonomia_contra_silencio_3min.md` sección "Solución completa pendiente").
NEW: - `heartbeat-monitor` es **solución parcial** al problema "CEO ausente largo" — archiva mensajes pero no despierta a Claudia CoS para procesarlos. Solución completa: daemon agente independiente (propuesto, pendiente sign-off CEO, ver `feedback_autonomia_contra_silencio_3min.md` sección "Solución completa pendiente").
```

### L148 — REPLACE

**Reason:** active text

```
OLD: - Voice transcription en CPU: ~9x realtime. Audios largos del Rey (>30s) toman 5+ min. Avisar.
NEW: - Voice transcription en CPU: ~9x realtime. Audios largos del CEO (>30s) toman 5+ min. Avisar.
```

## piper-tts/README.md

### L1 — REPLACE

**Reason:** active text

```
OLD: # Piper TTS Bridge — Lord Claude → Rey por Telegram (audio)
NEW: # Piper TTS Bridge — Claudia CoS → CEO por Telegram (audio)
```

### L3 — KEEP-historico

**Reason:** inline dated decree/event

```
OLD: Lord Claude → audio voice messages al Rey por Telegram, sintetizado 100% local. Built 2026-05-14 sesión 4ª.
```

### L12 — REPLACE-surgical

**Reason:** filename literal + active vocab mixed

```
OLD: | **bot token + chat_id Rey** | env from `lord-claude.credentials` | `%USERPROFILE%\.secrets\` | ACL solo-Pablo |
NEW: | **bot token + chat_id CEO** | env from `lord-claude.credentials` | `%USERPROFILE%\.secrets\` | ACL solo-Pablo |
```

### L17 — REPLACE

**Reason:** active text

```
OLD: # Mandar texto como voice message al Rey
NEW: # Mandar texto como voice message al CEO
```

### L18 — REPLACE

**Reason:** active text

```
OLD: python send_voice.py --text "Hola Rey, mensaje urgente"
NEW: python send_voice.py --text "Hola CEO, mensaje urgente"
```

### L66 — REPLACE

**Reason:** active text

```
OLD: ## Cuándo Lord Claude usa esto
NEW: ## Cuándo Claudia CoS usa esto
```

### L72 — REPLACE

**Reason:** active text

```
OLD: | Reporte cierre de sesión (#16) | Texto (no audio) — el Rey debe poder copiar/leer en su tiempo |
NEW: | Reporte cierre de sesión (#16) | Texto (no audio) — el CEO debe poder copiar/leer en su tiempo |
```

### L73 — REPLACE

**Reason:** active text

```
OLD: | Lord Claude trabado | Texto en ambos canales |
NEW: | Claudia CoS trabado | Texto en ambos canales |
```

### L74 — REPLACE

**Reason:** active text

```
OLD: | Rey escribió por Telegram | Lord Claude responde por Telegram (texto por default, audio TTS si el Rey lo pide explícitamente) |
NEW: | CEO escribió por Telegram | Claudia CoS responde por Telegram (texto por default, audio TTS si el CEO lo pide explícitamente) |
```

### L75 — REPLACE

**Reason:** active text

```
OLD: | Rey escribió audio por Telegram → Lord Claude transcribe | Responde texto por Telegram (mostrando la transcripción) — NO audio TTS (sería ping-pong audio) |
NEW: | CEO escribió audio por Telegram → Claudia CoS transcribe | Responde texto por Telegram (mostrando la transcripción) — NO audio TTS (sería ping-pong audio) |
```

### L76 — REPLACE

**Reason:** active text

```
OLD: | Alerta urgente del bot | Audio TTS opcional para que el Rey "escuche" la alerta cuando no puede leer |
NEW: | Alerta urgente del bot | Audio TTS opcional para que el CEO "escuche" la alerta cuando no puede leer |
```

## telegram-voice-bridge/README.md

### L1 — REPLACE

**Reason:** active text

```
OLD: # Telegram Voice Bridge — Lord Claude
NEW: # Telegram Voice Bridge — Claudia CoS
```

### L3 — KEEP-historico

**Reason:** inline dated decree/event

```
OLD: Local-only voice→text transcription for Telegram voice messages the Rey sends to `@impluxa_consorte_bot`. Built 2026-05-14 sesión 4ª.
```

### L14 — REPLACE

**Reason:** active text

```
OLD: | Whisper model | large-v3 (Systran/faster-whisper-large-v3, rev `edaa852e`) | "Que sea preciso" (Rey 2026-05-14) |
NEW: | Whisper model | large-v3 (Systran/faster-whisper-large-v3, rev `edaa852e`) | "Que sea preciso" (CEO 2026-05-14) |
```

### L69 — REPLACE

**Reason:** active text

```
OLD: 5. No transcript ever logged to disk or Impluxa Hakuna — it's a tool result handed to Lord Claude only.
NEW: 5. No transcript ever logged to disk or Impluxa Hakuna — it's a tool result handed to Claudia CoS only.
```

### L79 — REPLACE

**Reason:** active text

```
OLD: ## Lord Claude integration (polling loop)
NEW: ## Claudia CoS integration (polling loop)
```

### L81 — REPLACE

**Reason:** active text

```
OLD: When Lord Claude's `getUpdates` poll returns a message with `message.voice`, he calls:
NEW: When Claudia CoS's `getUpdates` poll returns a message with `message.voice`, he calls:
```

### L87 — REPLACE

**Reason:** active text

```
OLD: Parses the JSON, treats `result.text` as if it were a regular text message from the Rey on Telegram (per regla CLAUDE.md #14.c: respond IMMEDIATELY on Telegram + chat mirror).
NEW: Parses the JSON, treats `result.text` as if it were a regular text message from the CEO on Telegram (per regla CLAUDE.md #14.c: respond IMMEDIATELY on Telegram + chat mirror).
```

### L89 — REPLACE

**Reason:** active text

```
OLD: The Rey's voice message is acknowledged with "🎤 Audio recibido — transcripción: [text]. Entendido, ejecuto [action]." in both channels.
NEW: The CEO's voice message is acknowledged with "🎤 Audio recibido — transcripción: [text]. Entendido, ejecuto [action]." in both channels.
```

## supabase-config-bootstrap/README.md

### L4 — REPLACE

**Reason:** active text

```
OLD: Supabase Management API. Reemplaza los 3 sub-pasos que el Rey iba a hacer
NEW: Supabase Management API. Reemplaza los 3 sub-pasos que el CEO iba a hacer
```

### L52 — REPLACE

**Reason:** active text

```
OLD:   con ACL solo-Pablo, NUNCA commitear, rotación cada 90d o post-uso si el Rey
NEW:   con ACL solo-Pablo, NUNCA commitear, rotación cada 90d o post-uso si el CEO
```
