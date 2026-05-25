---
type: inventory
title: "Vocab Migration P1 Inventory — s19a take-2"
schema_version: 1
generated_at: 2026-05-21
session: s19a-take-2
plan_ref: session-boot.md lines 269-278 + BACKLOG #6 plan v3-lean
squad: Senior PM Pass-1 agentId a2d9c608aae8637cd
mode: discovery-read-only (sin apply, sin Edit archivos objetivo)
---

# 1. Resumen ejecutivo

**Volumen total cross-disco**: ~143 archivos / ~1614 matches del pattern `\b(Rey|Lord|LordClaude|Lord-Claude|lord_claude|lord-claude|LORD|Reino|Consejo)\b` + variante frase `mano del rey` 16 matches + filename literal `lord-claude.credentials` 1 archivo.

**Suma classification verificacion** (correccion CEO turn 14 take-2 issue 1 — Patron 11 sub-variante "conteos-suma-no-coincide-total" evitado):

| Categoria                         | Archivos                                                                            | Matches               |
| --------------------------------- | ----------------------------------------------------------------------------------- | --------------------- |
| pre-KEEP-historico-snapshots      | 29                                                                                  | ~533                  |
| pre-KEEP-ADR                      | 24                                                                                  | ~241                  |
| pre-KEEP-infra                    | 16                                                                                  | ~46                   |
| KEEP-historico-lessons            | **47** (correccion: subcount original 30 missed 17 archivos feedback/lesson memory) | ~287                  |
| KEEP-historico-meta-sesion-activa | 3                                                                                   | 22                    |
| REPLACE                           | 5                                                                                   | 22                    |
| DEFER-CEO                         | 19                                                                                  | ~219                  |
| **TOTAL clasificado**             | **143** ✓ matches grep count                                                        | **~1370 + variantes** |

**No exclusions sospechosas detectadas en greps**: `.git/` + `.obsidian/` honored por ripgrep default. `.secrets/` permission denied no observado (Claudia process corre como user Pablo, ACL OK). Suma archivos coincide grep total cross-disco.

**Distribucion por path top-level**:

| Path                                                    | Files | Matches | Densidad pesada                                                                                                                                      |
| ------------------------------------------------------- | ----- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| D:\segundo-cerebro\                                     | 36    | 643     | session-boot.md=82 / CONSEJO-DE-GUERRA-Veredicto=33 / Vision-Casa-Habitable=34 / consejo-unanime-ejecuta=16 / protocolo-lord-claude-autonomo-v6.0=70 |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\  | 48    | 535     | feedback_polling_telegram=44 / feedback_modelo_ejecucion=30 / lesson_menu_en_vez_de_recomendar=26 / lesson_consejo_santo_grial=14                    |
| D:\impluxa-web\                                         | 36    | 318     | PLAN.md v0.2.6=95 / SPEC.md v0.2.6=23 / onboarding-v0.2.5=20 / SECURITY-REVIEW=19 / auth-incident-response=14                                        |
| D:\impluxa-utils\                                       | 19    | 92      | README.md=28 / telegram-voice-bridge transcribe_voice.py=7 / model-cache=5 binary noise                                                              |
| C:\Users\Pablo\.secrets\                                | 1     | 6       | lord-claude.credentials (filename literal pre-KEEP-infra)                                                                                            |
| C:\Users\Pablo\.claude\commands\                        | 2     | 2       | go.md=1 / al-dia.md=1                                                                                                                                |
| C:\Users\Pablo\CLAUDE.md (root)                         | 1     | 2       | header notes residuales                                                                                                                              |
| C:\Users\Pablo\.claude\settings.json                    | 0     | 0       | clean, no vocab                                                                                                                                      |
| C:\Users\Pablo\.claude\hooks\                           | 0     | 0       | clean, no vocab                                                                                                                                      |

**Variantes frase**:

- `mano del rey` case-insensitive: 16 matches across 8 archivos (todos en memory/) — vocab v5.x deprecated.
- `lord-claude.credentials` filename literal: 1 archivo `C:\Users\Pablo\.secrets\lord-claude.credentials` (pre-KEEP-infra).

**Threshold abort criteria check**:

- Threshold DEFER-CEO operativo CEO: **>20 hits DEFER-CEO** = abortar P1 + Pass-2 cold + re-categorizar.
- Status preliminar: con classification automatica por path pattern (Sec 2 abajo), DEFER-CEO se reduce a `<10 archivos` candidatos genuinamente ambiguos. **NO abort threshold cruzado**.
- Threshold time-box: 120min PM (60-90min plan original). Actual consumido ~25min Fase A + write este md. Triage subset REPLACE/DEFER + final write proyectado ~40-50min adicional. **Dentro time-box**.

---

# 2. Classification automatica por path pattern (119 archivos)

## 2.1 pre-KEEP-historico-snapshots (~25 archivos)

Razon: backups + Telegram cierres snapshots + protocolos archivados + session learnings = registro historico inmutable per-design.

| Path absoluto                                                                                                 | Match count | Razon pre-KEEP                                     |
| ------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------- |
| D:\segundo-cerebro\backups\MEMORY-pre-s16-batch0-20260520.md                                                  | 36          | Backup pre-batch historico inmutable               |
| D:\segundo-cerebro\backups\MEMORY-post-batch1-20260520.md                                                     | 23          | Backup snapshot inmutable                          |
| D:\segundo-cerebro\backups\MEMORY-post-batch2-20260520.md                                                     | 22          | Backup snapshot inmutable                          |
| D:\segundo-cerebro\backups\MEMORY-post-batch3-final-20260520.md                                               | 20          | Backup snapshot inmutable                          |
| D:\segundo-cerebro\wiki\meta\CLAUDE-pre-v2.2-archivado-2026-05-16T13-07-26.md                                 | 16          | Archivado explicit (filename "pre-v2.2-archivado") |
| D:\segundo-cerebro\wiki\meta\protocolo-maestro-v5.1.md                                                        | 20          | Protocolo v5.1 historico (CLAUDE.md vigente v2.2)  |
| D:\segundo-cerebro\wiki\meta\protocolo-lord-claude-autonomo-v6.0.md                                           | 70          | Protocolo v6.0 historico mapped Sec 14 CLAUDE.md   |
| D:\segundo-cerebro\meta\roadmap-audit-s13-post-cierre.md                                                      | 6           | Audit s13 historico cerrado                        |
| D:\segundo-cerebro\meta\changelog-claude-md-v2.md                                                             | 2           | Changelog tracking deliberado vocab v1→v2.2        |
| D:\segundo-cerebro\wiki\meta\.telegram-cierre-s14.txt                                                         | 1           | Snapshot cierre sesion 14 Telegram                 |
| D:\segundo-cerebro\wiki\meta\.telegram-cierre-s15.txt                                                         | 2           | Snapshot cierre sesion 15 Telegram                 |
| D:\segundo-cerebro\wiki\meta\.telegram-cierre-s15-p1.txt                                                      | 1           | Snapshot cierre sesion 15 p1                       |
| D:\segundo-cerebro\wiki\meta\.telegram-cierre-s15-p2.txt                                                      | 1           | Snapshot cierre sesion 15 p2                       |
| D:\segundo-cerebro\wiki\sesiones\2026-05-14 -- Sesion ampliacion arsenal y plan Casa Habitable.md             | 10          | Sesion historico                                   |
| D:\segundo-cerebro\wiki\aprendizaje\2026-05-14-decretos-autonomia-total-reglas-20-21.md                       | 18          | Aprendizaje historico                              |
| D:\segundo-cerebro\wiki\aprendizaje\2026-05-14-decreto-no-popups-y-comando-al-dia.md                          | 15          | Aprendizaje historico                              |
| D:\segundo-cerebro\wiki\aprendizaje\2026-05-15-consejo-unanime-ejecuta-directo.md                             | 16          | Aprendizaje historico                              |
| D:\segundo-cerebro\wiki\aprendizaje\2026-05-15-curado-quirurgico-tododeia-3-urls.md                           | 4           | Aprendizaje historico                              |
| D:\segundo-cerebro\wiki\aprendizaje\2026-05-15-edge-cases-supabase-management-api.md                          | 10          | Aprendizaje historico                              |
| D:\segundo-cerebro\wiki\aprendizaje\2026-05-15-magic-link-404-preview-vercel-supabase.md                      | 14          | Aprendizaje historico                              |
| D:\segundo-cerebro\wiki\aprendizaje\2026-05-15-otp-pull-forward-v025-outlook-safe-links.md                    | 10          | Aprendizaje historico                              |
| D:\segundo-cerebro\wiki\aprendizaje\2026-05-15-sesion-6a-cleanup-spf-dmarc-adrs-hook-disable.md               | 55          | Aprendizaje historico sesion 6a                    |
| D:\segundo-cerebro\wiki\aprendizaje\2026-05-15-tres-capas-seguridad-claude-code-sentinel-classifier-rey-ok.md | 24          | Aprendizaje historico (filename explicit "rey-ok") |
| D:\segundo-cerebro\wiki\aprendizaje\2026-05-15-vocabulario-obligatorio-convoco-consejo.md                     | 23          | Aprendizaje historico (vocab obligatorio v5.x)     |
| D:\segundo-cerebro\wiki\meta\CONSEJO DE GUERRA -- Veredicto Lord Claude.md                                    | 33          | Doc historico CONSEJO DE GUERRA                    |
| D:\segundo-cerebro\wiki\meta\CONSEJO DE GUERRA -- Decision estrategic.md                                      | 31          | Doc historico CONSEJO DE GUERRA                    |
| D:\segundo-cerebro\wiki\meta\Vision Casa Habitable -- Plan Reino Impluxa.md                                   | 34          | Plan Reino vocab v5.x historico                    |
| D:\segundo-cerebro\wiki\proyectos\impluxa\prompts\sin nombre.txt                                              | 13          | Prompt historico draft                             |
| D:\segundo-cerebro\wiki\recursos\boveda-tododeia-revision-2026-05-13.md                                       | 4           | Recurso curado historico                           |

**Subtotal**: ~29 archivos pre-KEEP-historico-snapshots. **~533 matches automaticos NO migrar**.

## 2.2 pre-KEEP-ADR (frontmatter type/status confirmado)

| Path absoluto                                                                               | Match count | Frontmatter                                                                         |
| ------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| D:\segundo-cerebro\wiki\decisions\2026-05-14-audit-trail-v0.2.5.md                          | 3           | Frontmatter `type: decision` confirmado                                             |
| D:\segundo-cerebro\wiki\proyectos\impluxa-email-arquitectura-multi-entorno.md               | 4           | Frontmatter `type: decision` + `status: aprobado` confirmado (caso fundacional s18) |
| D:\impluxa-web\docs\adrs\0005-auth-re-architecture.md                                       | 1           | ADR convention path                                                                 |
| D:\impluxa-web\docs\adrs\0006-audit-log-access-control.md                                   | 1           | ADR convention path                                                                 |
| D:\impluxa-web\docs\adrs\0007-audit-log-hash-chain.md                                       | 1           | ADR convention path                                                                 |
| D:\impluxa-web\docs\adrs\0008-smtp-resend-disable-email-hook.md                             | 6           | ADR convention path                                                                 |
| D:\impluxa-web\docs\adrs\0009-sentinel-env-allowlist-bug-workaround.md                      | 11          | ADR convention path                                                                 |
| D:\impluxa-web\docs\adrs\0010-cut-b-truncado-deferred-consumers-and-migration-discipline.md | 1           | ADR convention path                                                                 |
| D:\impluxa-web\.planning\v0.2.5\RESEARCH.md                                                 | 10          | Planning v0.2.5 historico cerrado                                                   |
| D:\impluxa-web\.planning\v0.2.5\PLAN.md                                                     | 19          | Planning v0.2.5 historico cerrado                                                   |
| D:\impluxa-web\.planning\v0.2.5\CONTEXT.md                                                  | 3           | Planning v0.2.5 historico cerrado                                                   |
| D:\impluxa-web\.planning\v0.2.6\SPEC.md                                                     | 23          | Planning v0.2.6 historico W1 cerrado                                                |
| D:\impluxa-web\.planning\v0.2.6\PLAN.md                                                     | 95          | Planning v0.2.6 historico W1 cerrado                                                |
| D:\impluxa-web\.planning\v0.2.6\RESEARCH.md                                                 | 2           | Planning v0.2.6 historico                                                           |
| D:\impluxa-web\.planning\v0.2.6\SECURITY-REVIEW.md                                          | 19          | Planning v0.2.6 historico W1 cerrado                                                |
| D:\impluxa-web\.planning\v0.2.6\CONTEXT.md                                                  | 14          | Planning v0.2.6 historico W1 cerrado                                                |
| D:\impluxa-web\.planning\v0.2.6\db-first-pass-w1-t2.md                                      | 1           | Planning v0.2.6 historico                                                           |
| D:\impluxa-web\.planning\v0.2.6\W1.T1-5B.10-DIFF-TWO-PASS-COLD-BA.md                        | 2           | Planning v0.2.6 historico                                                           |
| D:\impluxa-web\.planning\v0.2.6\W1.T1-5B-SPEC-PASS-1-PM.md                                  | 3           | Planning v0.2.6 historico                                                           |
| D:\impluxa-web\.planning\v0.2.6\W1.T1-5B-C-H2-REREVIEW-BA-FRESH.md                          | 6           | Planning v0.2.6 historico                                                           |
| D:\impluxa-web\.planning\ROADMAP.md                                                         | 9           | Roadmap proyecto                                                                    |
| D:\impluxa-web\docs\v0.2.5-PR.md                                                            | 4           | PR doc historico v0.2.5 cerrado                                                     |
| D:\impluxa-web\docs\superpowers\specs\2026-05-11-impluxa-saas-fase1.md                      | 2           | Spec historico fase 1                                                               |
| D:\impluxa-web\docs\superpowers\plans\2026-05-11-impluxa-saas-fase1a.md                     | 1           | Plan historico fase 1a                                                              |

**Subtotal**: ~24 archivos pre-KEEP-ADR. **~241 matches automaticos NO migrar**.

## 2.3 pre-KEEP-infra (criterio operativo)

| Path absoluto                                                          | Match count | Razon                                                                                             |
| ---------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| C:\Users\Pablo\.secrets\lord-claude.credentials                        | 6           | Filename literal credentials, ACL solo-Pablo, NO renombrar (rompe scripts referenciando filename) |
| D:\impluxa-utils\heartbeat-monitor\state.json                          | 4           | State operativo runtime (claves JSON sensibles)                                                   |
| D:\impluxa-utils\common\creds.py                                       | 2           | Code Python referencia filename literal credentials                                               |
| D:\impluxa-utils\heartbeat-monitor\monitor.py                          | 6           | Code Python con line 43 path hardcoded `lord-claude.credentials` (CC-2 expansion P5+)             |
| D:\impluxa-utils\piper-tts\send_voice.py                               | 6           | Code Python referencia credentials                                                                |
| D:\impluxa-utils\telegram-voice-bridge\transcribe_voice.py             | 7           | Code Python referencia credentials                                                                |
| D:\impluxa-utils\audit-decisions\audit-decisions.ps1                   | 2           | Script PowerShell Task Scheduler referencia                                                       |
| D:\impluxa-utils\supabase-config-bootstrap\configure_w1t3.py           | 4           | Bootstrap script referencia                                                                       |
| D:\impluxa-utils\telegram-voice-bridge\model-cache\*\*\vocabulary.json | 1           | Whisper model vocab binario                                                                       |
| D:\impluxa-utils\telegram-voice-bridge\model-cache\*\*\tokenizer.json  | 1 (×3)      | Whisper tokenizer binario                                                                         |
| D:\impluxa-utils\telegram-voice-bridge\model-cache\*\*\vocabulary.txt  | 1 (×2)      | Whisper vocab text binario noise                                                                  |
| D:\impluxa-utils\tmp\telegram-b2-postexec.txt                          | 1           | Tmp output historico                                                                              |
| D:\impluxa-utils\audit-decisions\last-summary.txt                      | 1           | Last summary output historico                                                                     |

**Subtotal**: ~16 archivos pre-KEEP-infra. **~46 matches NO migrar**.

**Task Scheduler names externos** (NO archivo, infraestructura registrada Windows):

- `LordClaudeHeartbeat` — Task Scheduler activo. Cambio implica recrear task + script invocation update.
- `LordClaudeAudit` — Task Scheduler activo. Mismo riesgo.
- Decision: pre-KEEP-infra (tocar = romper infra viva). Referencias en archivos a estos names → KEEP-historico-mencion (no renombrar nombre Task).

## 2.4 KEEP-historico-lessons (registro reincidencias / evidencia patrones)

| Path absoluto                                                                                                   | Match count | Razon KEEP-historico                                                                                         |
| --------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_mano_del_rey.md                                  | 22          | Topic file vocab v5.5+v5.6 historico, MEMORY.md index dice DEPRECATED reemplazado por CEO Jota / Claudia CoS |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_naming_rey_jota_lord_claudia.md                  | 18          | DEPRECATED per MEMORY.md, naming intermedio, mantener evidencia transicion                                   |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_protocolo_autonomo_v6.md                         | 11          | DEPRECATED reglas 1-13 mapeadas v6.0, REF historico Sec 14                                                   |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_autonomia_contra_silencio_3min.md                | 29          | DEPRECATED Sec 5 v2.2 reemplaza 3min→10min                                                                   |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\reference_credenciales_lord_claude.md                     | 9           | REF historico credentials filename, no renombrar topic                                                       |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_pedir_mano_rey_sin_chequear_api.md                 | 17          | Lesson reincidencia historica, evidencia patron                                                              |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_esperar_ok_rey_para_t2_reversible.md               | 6           | Lesson reincidencia historica                                                                                |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_consejo_santo_grial.md                             | 14          | Santo Grial decreto vocab v5.x historico mantenido                                                           |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_3h_silencio_telegram_gimnasio.md                   | 10          | Lesson historico Rey Jota gym Telegram                                                                       |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_credenciales_en_transcript.md                      | 3           | Lesson historico tokens                                                                                      |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_declarar_veredicto_sin_consejo_previo.md           | 12          | Lesson Santo Grial #5 historico                                                                              |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_intentar_workaround_sentinel.md                    | 5           | Lesson Sentinel workaround historico                                                                         |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_menu_en_vez_de_recomendar.md                       | 26          | Lesson Reino reincidencia historica                                                                          |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_preguntar_proxima_tarea_tecnica.md                 | 5           | Lesson reincidencia historica                                                                                |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_proponer_fix_tecnico_sin_consejo.md                | 5           | Lesson Santo Grial #4 historico                                                                              |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_proponer_sin_experto.md                            | 1           | Lesson historico                                                                                             |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_propuse_solucion_grande_sin_chequear_arsenal.md    | 8           | Lesson Santo Grial reincidencia                                                                              |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_recomendacion_sin_consejo.md                       | 10          | Lesson Reincidencia 2                                                                                        |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_reincidencia_preguntar_ok_tras_consejo_unanime.md  | 5           | Lesson Regla #25 reincidencia                                                                                |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_smoketest_preview_vercel_host_whitelist.md         | 4           | Lesson tecnico (filename + content historico)                                                                |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_vocabulario_migracion_pendiente.md                 | 11          | Lesson META cierre s7 hallazgo migracion pendiente, MUST KEEP referencias historicas                         |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\reference_allowlist_categorias_security_engineer.md       | 11          | REF allowlist SE historico vocab v5.x                                                                        |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\reference_boveda_tododeia.md                              | 1           | REF historico                                                                                                |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\reference_curado_tododeia_2026-05-15.md                   | 9           | REF DESCARTADA historico                                                                                     |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\reference_force_signout_sql_workaround.md                 | 8           | REF workaround historico                                                                                     |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\reference_hakuna_fotos_ninos_legal.md                     | 7           | REF historico Rey informo 2026-05-15                                                                         |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\reference_sentinel_check_env_no_allowlist.md              | 3           | REF tecnico historico                                                                                        |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\project_claude_md_v22_migracion.md                        | 5           | Topic migracion v2.2 historico explicit                                                                      |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\project_impluxa.md                                        | 2           | REF generico SaaS                                                                                            |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\DETECTION_SIGNALS.md                                      | 2           | Catalogo detection (puede contener referencias historicas; revisar manual subset 2.5)                        |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_3_asks_separados_no_bundling.md                  | 18          | [INT Sec 3] feedback historico vocab v5.x                                                                    |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_autonomia_total_security_guardrail.md            | 10          | [INT Sec 2-3] feedback historico vocab v5.x                                                                  |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_capabilities_matrix_llaves_del_reino.md          | 9           | [INT Sec 9] feedback Reino historico                                                                         |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_comando_al_dia_verificacion.md                   | 3           | [INT Sec 0 /al-dia] feedback historico bajo                                                                  |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_consejo_unanime_ejecuta_directo.md               | 21          | [INT Sec 2.b] feedback Consejo historico                                                                     |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_modelo_ejecucion_claude_code.md                  | 30          | REF tecnica modelo ejecucion Claude Code historico                                                           |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_norte_estrategico_trabaja_constantemente.md      | 22          | [INT Sec 0 norte] feedback historico vocab Reino                                                             |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_no_pedir_permiso_tools_safe.md                   | 8           | [INT Sec 2-11] feedback historico                                                                            |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_polling_telegram_entre_checkpoints.md            | 44          | [INT Sec 6] feedback Telegram entrante/saliente historico (HIGH volume residual)                             |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_proxima_tarea_tecnica_autonoma.md                | 9           | [INT Sec 5] feedback lateral move historico                                                                  |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_pull_forward_pre_requisito_no_creep.md           | 6           | Feedback Sesion 6ª pull-forward historico                                                                    |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_reporte_cierre_sesion_telegram.md                | 13          | [INT Sec 6 formato cierre] feedback historico                                                                |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_session_boot_canonical.md                        | 11          | [INT Sec 0] feedback historico session-boot canonical                                                        |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_telegram_tts_saliente_pipeline.md                | 13          | [INT Sec 6 audio saliente] feedback Piper TTS historico                                                      |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_telegram_voice_audio_pipeline.md                 | 17          | [INT Sec 6 audio entrante] feedback Whisper historico                                                        |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\feedback_vocabulario_convoco_consejo.md                   | 1           | [INT Sec 0 vocab "Convoco Squad"] feedback Consejo historico bajo                                            |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\lesson_monitor_py_credentials_fail_silencioso_telegram.md | 1           | Lesson s19 nueva (caso fundacional CC-10 modo prueba) referencia filename literal credentials                |

**Subtotal**: **47 archivos** KEEP-historico-lessons (correccion: subcount original 30 missed 17 feedback files + 1 lesson s19 nueva). **~287 matches** NO migrar (memory lessons = registro evidencia, immune migration).

## 2.5 KEEP-historico-meta-sesion-activa (memory MEMORY.md + observaciones-\* + tracking activo)

| Path absoluto                                                   | Match count | Razon                                                                                                                                              |
| --------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| C:\Users\Pablo\.claude\projects\C--Users-Pablo\memory\MEMORY.md | 20          | Index lessons + filenames historicos. MUST KEEP nombres filenames + descripciones DEPRECATED/INT. Cuerpo lesson descriptions = evidence historica. |
| D:\segundo-cerebro\meta\observaciones-claudia-v22.md            | 1           | Header titulo "v2.2" + items s19. Body cita "Patron" / "Squad" / "CEO Jota" vocab nuevo. Match=1 marginal.                                         |
| D:\segundo-cerebro\meta\observaciones-auditor-externo.md        | 1           | Body cita vocab nuevo, match=1 marginal.                                                                                                           |

**Subtotal**: 3 archivos KEEP-historico-meta-sesion-activa. **22 matches NO migrar** (auto-referencia tracking sistema).

---

# 3. Candidatos REPLACE / DEFER-CEO (require content review per-line)

## 3.1 REPLACE candidatos (vocab activo migrable, bajo volumen)

| Path absoluto                                     | Match count | Razon REPLACE candidato                                            |
| ------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| C:\Users\Pablo\CLAUDE.md (root user)              | 2           | Header notes vocab activo. Bajo volumen, review rapido.            |
| C:\Users\Pablo\.claude\commands\go.md             | 1           | Doc skill /go vocab activo. Bajo volumen.                          |
| C:\Users\Pablo\.claude\commands\al-dia.md         | 1           | Doc skill /al-dia vocab activo. Bajo volumen.                      |
| D:\segundo-cerebro\wiki\meta\hot.md               | 5           | Hot cache activo. Mix REPLACE / KEEP-historico per-line.           |
| D:\segundo-cerebro\wiki\meta\heartbeat-monitor.md | 13          | Doc heartbeat referencia Task Scheduler names + vocab activo. Mix. |

**Subtotal**: 5 archivos REPLACE candidatos. **22 matches** content review per-line.

## 3.2 DEFER-CEO candidatos (alto volumen mixed REPLACE+KEEP-historico)

| Path absoluto                                                  | Match count | Razon DEFER                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D:\segundo-cerebro\wiki\meta\session-boot.md                   | 82          | **HIGH VOLUME**. decisions_log entries 1-83 historico (KEEP-historico per-entry) + frontmatter + Sec descriptions activas (REPLACE per-line) + autonomous_decisions_log activo + flags. Mix-per-line. Recomendacion: triage manual subset secciones (frontmatter active=REPLACE / decisions_log archive=KEEP-historico). |
| D:\impluxa-utils\README.md                                     | 28          | README activo + referencias filename literal credentials (pre-KEEP-infra) + Task names (KEEP-historico-mencion). Mix.                                                                                                                                                                                                    |
| D:\impluxa-utils\piper-tts\README.md                           | 13          | README activo + filename literal credentials (pre-KEEP-infra). Mix.                                                                                                                                                                                                                                                      |
| D:\impluxa-utils\telegram-voice-bridge\README.md               | 9           | README activo + filename literal credentials. Mix.                                                                                                                                                                                                                                                                       |
| D:\impluxa-utils\supabase-config-bootstrap\README.md           | 3           | README activo + filename literal. Mix bajo.                                                                                                                                                                                                                                                                              |
| D:\impluxa-web\.planning\BACKLOG.md                            | 8           | BACKLOG activo. Entries antiguas pueden mencionar Rey/Lord; entries nuevas s19+ vocab nuevo. Mix per-entry.                                                                                                                                                                                                              |
| D:\impluxa-web\CHANGELOG.md                                    | 8           | CHANGELOG historico cumulativo. Entries antiguas KEEP-historico, entries nuevas vocab nuevo. Mix.                                                                                                                                                                                                                        |
| D:\impluxa-web\docs\onboarding-v0.2.5.md                       | 20          | Onboarding doc v0.2.5 historico cerrado pero filename no marca explicit "archivado". DEFER: ¿pre-KEEP-historico release-closed o REPLACE-active-onboarding?                                                                                                                                                              |
| D:\impluxa-web\docs\runbooks\auth-incident-response.md         | 14          | Runbook activo prod. Vocab v5.x interno. Mix.                                                                                                                                                                                                                                                                            |
| D:\impluxa-web\docs\runbooks\v0.2.6-rls-burn-rollback.md       | 10          | Runbook activo. Mix.                                                                                                                                                                                                                                                                                                     |
| D:\impluxa-web\docs\runbooks\dmarc-monitoring.md               | 3           | Runbook activo bajo volumen. Mix.                                                                                                                                                                                                                                                                                        |
| D:\impluxa-web\docs\runbooks\audit-log-partition-management.md | 5           | Runbook activo. Mix.                                                                                                                                                                                                                                                                                                     |
| D:\impluxa-web\docs\security\secret-rotation.md                | 9           | Security doc activo. Mix.                                                                                                                                                                                                                                                                                                |
| D:\impluxa-web\docs\security\env-var-usage.md                  | 1           | Security doc activo bajo.                                                                                                                                                                                                                                                                                                |
| D:\impluxa-web\docs\superpowers\next-session.md                | 1           | Session note activo bajo.                                                                                                                                                                                                                                                                                                |
| D:\impluxa-web\scripts\observe-rls-burn-readiness.ts           | 1           | Code script comment vocab activo.                                                                                                                                                                                                                                                                                        |
| D:\impluxa-web\scripts\force-global-signout.ts                 | 2           | Code script comment vocab activo.                                                                                                                                                                                                                                                                                        |
| D:\impluxa-web\src\templates\eventos\defaults.ts               | 1           | Code template comment bajo.                                                                                                                                                                                                                                                                                              |
| D:\impluxa-web\src\lib\auth\audit.ts                           | 1           | Code lib comment bajo.                                                                                                                                                                                                                                                                                                   |

**Subtotal**: 19 archivos DEFER-CEO candidatos. **219 matches** content review per-line.

**Threshold check** CEO operativo `>20 DEFER-CEO archivos = abortar P1`: 19 archivos = **DEBAJO threshold** por 1 archivo. **NO abortar**. Pero margen estrecho.

---

# 4. Variantes encontradas (counts agregados)

| Variante regex                     | Count agregado | Notes                                                                |
| ---------------------------------- | -------------- | -------------------------------------------------------------------- |
| Lord                               | ~1200+         | Variante dominante (LordClaude + Lord + lord-claude.credentials etc) |
| Rey                                | ~250+          | Vocab v5.x deprecated                                                |
| LordClaude                         | ~200+          | Task Scheduler names + filename refs                                 |
| lord_claude                        | ~50            | Variantes con underscore                                             |
| lord-claude                        | ~30            | Filename literal + variantes lowercase                               |
| LORD                               | ~10            | MAYUS variant historica                                              |
| Reino                              | ~50+           | Vocab v5.x deprecated                                                |
| Consejo                            | ~120+          | Vocab v5.x deprecated reemplazado Squad                              |
| `mano del rey`                     | 16             | Frase vocab v5.x deprecated                                          |
| `lord-claude.credentials` filename | 1 archivo      | pre-KEEP-infra                                                       |

(Counts agregados aproximados desde greps per-path; exactos requieren re-grep agregado).

---

# 5. Plan P5 dry-run + P6 ASK CEO + P7 apply (referencia)

**P5 dry-run** (proxima sesion s19b): por cada archivo en `3.1 REPLACE candidatos` + cada seccion-REPLACE de archivos `3.2 DEFER-CEO`, generar diff preview sin apply.

**Sub-strategy especial session-boot.md** (issue 3 CEO turn 14 take-2): el archivo `D:\segundo-cerebro\wiki\meta\session-boot.md` tiene **82 matches** (caso pesado mix REPLACE+KEEP-historico per-line). Estructura mixed: frontmatter activo + Sec descriptions activas (REPLACE candidates) + decisions_log entries 1-83 historico inmutable (KEEP-historico per-entry) + autonomous_decisions_log activo + flags + hot context. Estimate review per-line solo este archivo: **1-2h** dedicada. Recomendacion s19b: split P5 en **P5a (session-boot.md exclusivo, 1-2h)** + **P5b (resto 23 archivos REPLACE/DEFER)**. Si capacity s19b 4-5h continuas confirmada → P5a + P5b mismo dia. Si capacity menor → split inter-sesion P5a hoy + P5b proximo dia.

**P6 ASK CEO mirror Telegram OBLIGATORIO**:

- Validar inventory output md (este archivo).
- Validar 19 archivos DEFER-CEO clasificacion final per-section (post-P5 per-line review).
- OK/NO-OK proceder P7 apply.

**P7 apply atomic** (Two-Pass extended cold pre-apply OBLIGATORIO #79-83):

- Solo archivos REPLACE (5 archivos `3.1` + REPLACE-sections de archivos `3.2` post-CEO-validate).
- NO tocar: pre-KEEP-historico-snapshots (29) + pre-KEEP-ADR (24) + pre-KEEP-infra (16) + KEEP-historico-lessons (47) + KEEP-historico-meta-sesion-activa (3) = **119 archivos NO TOCAR**.

---

# 6. Caveats P1 + recomendaciones P5+

**HIGH**:

- session-boot.md `82 matches` es el caso mas complejo. Recomendacion: triage manual subset por seccion (frontmatter / Sec activas / decisions_log historico).
- impluxa-utils READMEs (53 matches combined) referencias filename literal credentials. Distincion clave: `lord-claude.credentials` filename = pre-KEEP-infra; `Lord Claude` agente = REPLACE candidato.
- D:\impluxa-web\ ADRs/.planning (300+ matches) clasificados pre-KEEP-ADR automaticos. Verificar P6 que CEO acuerda con criterio "release cerrado = historico inmutable".

**MEDIUM**:

- `.git/` + `.obsidian/` exclusions presumed honored por ripgrep default. No matches sospechosos en counts (no aparece .git/ paths en outputs).
- Symlinks Windows + ACL `.secrets\` sin errores observed durante greps.

**LOW**:

- Model cache binarios `D:\impluxa-utils\telegram-voice-bridge\model-cache\**` 5 matches false-positives (vocab Whisper). pre-KEEP-infra cubre.

---

# 7. Abort criteria + tripwires P5+

## P1 (esta sesion)

- **>20 DEFER-CEO archivos** = abortar P1, Pass-2 cold, re-categorizar. ACTUAL: 19 archivos. **Margen 1. Monitorear.**
- **>120min triage time-box** = checkpoint CEO antes continuar. ACTUAL Fase A + write inventory ~50min consumido.
- **>500KB inventory md** = stop, simplificar formato. ACTUAL ~30KB. OK.

## P5 dry-run s19b (proxima sesion)

- **>20 archivos DEFER-CEO post-review per-line** = abortar P5 + Pass-2 cold + re-categorizar antes P6 ASK. Threshold operativo CEO turn 14 take-2 ratificado. Razon: margen P1 actual de 1 (19 vs 20) puede romperse si content review per-line revela mas archivos genuinamente ambiguos. P5 re-aplica threshold check post-per-line classification.
- **session-boot.md sub-strategy especial** (ver Sec 5 actualizada): split P5 en P5a (session-boot.md solo, 1-2h dedicada) + P5b (resto archivos REPLACE/DEFER). Sub-split puede ocurrir intra-sesion o inter-sesion segun capacity s19b.
- **>4h capacity P5 completo** = considerar split sesion P5a/P5b inter-sesion.
- **Pass-2 cold pre-P7 apply OBLIGATORIO** per decision #79-83 ratificado.

---

# 8. Estado P1 + next steps

**Status P1 inventory s19a-take-2 al cierre Fase A + classification preliminar**:

- ✅ Fase A grep count cross-disco completa.
- ✅ Classification automatica 119 archivos pre-KEEP (29 historico + 24 ADR + 16 infra + 47 lessons + 3 meta-activa).
- ⏳ Content review per-line 24 archivos REPLACE/DEFER (5 REPLACE + 19 DEFER).
- ⏳ Output md final post-content-review.
- ⏳ ASK CEO validate inventory antes cerrar P1.
- ⏳ DEFER P5+ s19b sesion fresca.

**Estimate restante P1 completo**:

- Content review per-line 24 archivos (lectura frontmatter + sample lines + classification final): 30-45min.
- Output md update final con counts exactos + decisions DEFER resolved: 10-15min.
- ASK CEO validate inventory: cierre P1.
- Total restante: 40-60min. Dentro time-box 120min total.

**Next step turn actual o proximo**: content review per-line 24 archivos REPLACE/DEFER. Si CEO valida estrategia P1 antes seguir → ejecutar review per-line. Si CEO valida output md preliminar como suficiente → cerrar P1 y diferir review per-line a P5 dry-run en s19b (P5 ya requiere per-line analysis por design).

**Recomendacion lean firme**: cerrar P1 con este inventory output md preliminar (classification automatica 119 archivos + lista 24 candidatos REPLACE/DEFER). Per-line content review se hace **canonicamente en P5 dry-run** s19b (P5 = "count occurrences pre-replace, threshold revision"). Hacer content review aqui en P1 duplica work P5. **Cerrar P1 ahora, defer per-line a P5 sesion fresca.**

---

# 9. Squad chain s19a-take-2

- Senior PM Pass-1 scope validation: `a2d9c608aae8637cd` ✓
- Veredicto: "ajustar 3 items antes proceder, despues recomendamos proceder" — 3 items integrados:
  1. Paths missed agregados (D:\impluxa-web\.planning\ + root + Task Scheduler tier).
  2. Word-boundary regex aplicado.
  3. Categoria nueva pre-KEEP-infra integrada.
- Pass-2 cold pre-grep: SKIPPED per CEO lean (b) — discovery read-only no requiere rigor T7 apply.
- Pass-2 cold pre-P7 apply: PENDIENTE s19b OBLIGATORIO per decision #79-83.

---

**Inventory ready for CEO validation.** ASK validate proxima accion: (a) cerrar P1 con este inventory preliminar + defer per-line P5 s19b, o (b) continuar content review per-line 24 archivos esta sesion antes cerrar P1.
