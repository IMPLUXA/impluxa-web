# P5b Batch B1 — REPLACE low-vol dry-run FINAL

Generated: 2026-05-25

## Refinements aplicados

1. Lesson/topic kebab-case filename refs → KEEP-whitelist (ej `recomendacion-sin-consejo`)
2. Filename literal pattern (`pending-rey-messages.jsonl`, `lord-claude.credentials`, `LordClaudeHeartbeat`, `protocolo-lord-claude-autonomo`) → KEEP-whitelist
3. Sec 14 cross-ref archived protocol title → KEEP-historico (`Protocolo Lord Claude Autonomo v6`)
4. Inline dated decree/event (Decreto X 2026-MM-DD / Caso fundacional dated) → KEEP-historico
5. Cita textual audit archived (`Rey-gated` quoted) → KEEP-historico
6. DEPRECATED/Legacy block walkback → KEEP-historico
7. Meta-references migration spec self-ref → KEEP-META

## Summary table

| File                 | Total | REPLACE | KEEP-historico | KEEP-META | KEEP-whitelist |
| -------------------- | ----- | ------- | -------------- | --------- | -------------- |
| CLAUDE.md            | 1     | 0       | 1              | 0         | 0              |
| go.md                | 1     | 0       | 0              | 0         | 1              |
| al-dia.md            | 0     | 0       | 0              | 0         | 0              |
| hot.md               | 3     | 1       | 1              | 0         | 1              |
| heartbeat-monitor.md | 14    | 9       | 2              | 0         | 3              |

**Grand total:** 19 matches / **10 REPLACE actionable**.

## C:/Users/Pablo/CLAUDE.md

### L785 — KEEP-historico

**Reason:** Sec 14 cross-ref archived protocol title

```
OLD: el CLAUDE.md y se mapean al Protocolo Lord Claude Autonomo v6.0 (ver
```

## C:/Users/Pablo/.claude/commands/go.md

### L69 — KEEP-whitelist

**Reason:** lesson kebab-case filename ref

```
OLD: 5. SI Squad recomienda algo, INVOCAR realmente el agent (no citar veredicto sin invocación) — lección `recomendacion-sin-consejo`
```

## C:/Users/Pablo/.claude/commands/al-dia.md

No matches.

## D:/segundo-cerebro/wiki/meta/hot.md

### L103 — KEEP-historico

**Reason:** cita textual audit archived

```
OLD: - **Anotaciones observaciones-claudia-v22.md s14**: SIGNAL 6 corregido 3 TP (s10a + s13 + s14), 2 patrones nuevos TP caso fundacional (`internalizacion-prematura-de-refinamiento-propuesto` + `inflar-conteo-SIGNAL`), microviolacion vocabulario "Rey-gated" flagueada como cita textual audit cold s13, lesson nueva `dossier-two-pass-extended-no-archivado-pre-cierre` (observacion no politica activa), patron nuevo `estimacion-%-completion-Claudia-sin-Squad-ni-criterios` (TP caso fundacional s13 identificado s14).
```

### L126 — KEEP-whitelist

**Reason:** lesson kebab-case filename ref

```
OLD: - Microviolacion vocabulario `Rey-gated` [NOTED — cita textual audit cold s13 archivado, no violacion propia]: flagueada para audits/archivos pre-vocabulario-migracion.
```

### L143 — REPLACE

**Reason:** active text

```
OLD: - ✅ **Sub-paso 5.B fresh s15 (5B.7-5B.10 SHIPPED, 5B.11 + 5B.12 SLIP s16)** — 5B.7 SPEC `daeac2b` + 5B.8 ADR-0010 `a9ff1e5` + 5B.9 tests `8f74946` + 5B.10 Diff Two-Pass cold DONE (3 cold agents + 4 HIGH fixes applied s15 cierre). **5B.11 SLIP A s16** (Rey-gated gravedad #21.f; coincide con 5B.12 slip; cierre conjunto). **5B.12 SLIP A s16** (OQ-PM-1 resuelta s15). Both slips: `hakuna_live=false` → riesgo nulo. **Caso #8 fresh CERRADO**: 11 dossiers archivados en `.planning/v0.2.6/` (3 PASS-1 + 3 PASS-2 + 2 REREVIEW C-H2 + 3 5B.10 cold). Lesson `dossier-two-pass-extended-no-archivado-pre-cierre` SATISFECHA por Path B (SPEC §10 + §10.10 References como sintesis consolidada; 8+ archivos `.md aparte` satisfacen el "artefacto .md aparte" de la lesson).
NEW: - ✅ **Sub-paso 5.B fresh s15 (5B.7-5B.10 SHIPPED, 5B.11 + 5B.12 SLIP s16)** — 5B.7 SPEC `daeac2b` + 5B.8 ADR-0010 `a9ff1e5` + 5B.9 tests `8f74946` + 5B.10 Diff Two-Pass cold DONE (3 cold agents + 4 HIGH fixes applied s15 cierre). **5B.11 SLIP A s16** (CEO-gated gravedad #21.f; coincide con 5B.12 slip; cierre conjunto). **5B.12 SLIP A s16** (OQ-PM-1 resuelta s15). Both slips: `hakuna_live=false` → riesgo nulo. **Caso #8 fresh CERRADO**: 11 dossiers archivados en `.planning/v0.2.6/` (3 PASS-1 + 3 PASS-2 + 2 REREVIEW C-H2 + 3 5B.10 cold). Lesson `dossier-two-pass-extended-no-archivado-pre-cierre` SATISFECHA por Path B (SPEC §10 + §10.10 References como sintesis consolidada; 8+ archivos `.md aparte` satisfacen el "artefacto .md aparte" de la lesson).
```

## D:/segundo-cerebro/wiki/meta/heartbeat-monitor.md

### L3 — REPLACE

**Reason:** active text

```
OLD: title: "Lord Claude Heartbeat Monitor — operación + shutdown"
NEW: title: "Claudia CoS Heartbeat Monitor — operación + shutdown"
```

### L12 — REPLACE

**Reason:** active text

```
OLD: Cron monitor que corre cada 3 min para implementar CLAUDE.md regla #22 (autonomía contra silencio del Rey + activación por Telegram).
NEW: Cron monitor que corre cada 3 min para implementar CLAUDE.md regla #22 (autonomía contra silencio del CEO + activación por Telegram).
```

### L17 — REPLACE

**Reason:** active text

```
OLD: - **State:** `D:\impluxa-utils\heartbeat-monitor\state.json` (Lord Claude lo actualiza durante sesión)
NEW: - **State:** `D:\impluxa-utils\heartbeat-monitor\state.json` (Claudia CoS lo actualiza durante sesión)
```

### L18 — KEEP-whitelist

**Reason:** filename/Task literal

```
OLD: - **Pending msgs:** `D:\impluxa-utils\heartbeat-monitor\pending-rey-messages.jsonl` (archivo de mensajes del Rey llegados mientras Lord Claude estaba fuera de sesión — lee al arrancar próxima sesión)
```

### L40 — REPLACE

**Reason:** active text

```
OLD: Si Lord Claude se vuelve loco o el Rey quiere parar el monitor:
NEW: Si Claudia CoS se vuelve loco o el CEO quiere parar el monitor:
```

### L65 — REPLACE

**Reason:** active text

```
OLD: ## Cuándo archiva mensajes Rey
NEW: ## Cuándo archiva mensajes CEO
```

### L67 — KEEP-whitelist

**Reason:** filename/Task literal

```
OLD: En CADA tick, el monitor pollea Telegram `getUpdates` con offset persistido. Si el Rey escribió, archiva en `pending-rey-messages.jsonl` (uno por línea). La próxima sesión Lord Claude lee ese archivo al arrancar (session-boot ritual).
```

### L69 — REPLACE

**Reason:** active text

```
OLD: ⚠️ **CUIDADO:** mientras Lord Claude está activo en sesión, también pollea Telegram. Si el monitor archive un mensaje antes que Lord Claude lo procese, queda solo en el archive (no aparece en getUpdates de Lord Claude). Versión v2: el monitor debería skipear archive si state.json indica "Lord Claude active" (heartbeat reciente).
NEW: ⚠️ **CUIDADO:** mientras Claudia CoS está activo en sesión, también pollea Telegram. Si el monitor archive un mensaje antes que Claudia CoS lo procese, queda solo en el archive (no aparece en getUpdates de Claudia CoS). Versión v2: el monitor debería skipear archive si state.json indica "Claudia CoS active" (heartbeat reciente).
```

### L73 — KEEP-historico

**Reason:** inline dated decree/event

```
OLD: Decreto Rey Jota 2026-05-14 sesión 4ª: "no quiero que te quedes en pausa esperando mi respuesta". Lord Mano Claudia es turn-based (Claude Code CLI), no daemon. Para cumplir el espíritu del decreto FUERA de sesión activa, este cron mantiene canal Telegram vivo y archiva input del Rey para próxima activación.
```

### L77 — KEEP-historico

**Reason:** inline dated decree/event

```
OLD: Rey Jota se fue al gimnasio durante 3 horas el 2026-05-14. Mandó mensajes Telegram al bot. Lord Claudia NO respondió hasta que el Rey volvió y escribió en el chat de Claude. El cron monitor de este doc se instaló en la misma sesión tras el incidente. Ver `lesson_3h_silencio_telegram_gimnasio.md` en memorias.
```

### L81 — REPLACE

**Reason:** active text

```
OLD: Este cron archiva + manda heartbeat. **NO despierta a Lord Claudia para procesar tareas nuevas.** Solución completa requiere agent daemon independiente — ver propuesta en `feedback_autonomia_contra_silencio_3min.md` sección "Solución completa pendiente".
NEW: Este cron archiva + manda heartbeat. **NO despierta a Claudia CoS para procesar tareas nuevas.** Solución completa requiere agent daemon independiente — ver propuesta en `feedback_autonomia_contra_silencio_3min.md` sección "Solución completa pendiente".
```

### L88 — KEEP-whitelist

**Reason:** filename/Task literal

```
OLD: 4. **R3 (v2):** cap 500 líneas en pending-rey-messages.jsonl, rotación. TODO.
```

### L94 — REPLACE

**Reason:** active text

```
OLD: - No despierta automáticamente Lord Claude en Claude Code — solo manda Telegram. Pablo debe abrir Claude Code manualmente para procesar pending messages.
NEW: - No despierta automáticamente Claudia CoS en Claude Code — solo manda Telegram. Pablo debe abrir Claude Code manualmente para procesar pending messages.
```

### L95 — REPLACE

**Reason:** active text

```
OLD: - Si Lord Claude crashea sin update state.json, el monitor puede mandar heartbeats sobre tarea vieja (mitigado por TTL R1 = 4h max).
NEW: - Si Claudia CoS crashea sin update state.json, el monitor puede mandar heartbeats sobre tarea vieja (mitigado por TTL R1 = 4h max).
```
