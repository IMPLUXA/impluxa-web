# P5b Batch B5 — DEFER code .ts comments dry-run (v4 classifier)

Generated: 2026-05-25

## Summary

| File                              | Total | REPL | R-surg | KEEP-h | KEEP-M | KEEP-wl | KEEP-pop | KEEP-data |
| --------------------------------- | ----- | ---- | ------ | ------ | ------ | ------- | -------- | --------- |
| observe-rls-burn-readiness.ts     | 2     | 2    | 0      | 0      | 0      | 0       | 0        | 0         |
| force-global-signout.ts           | 3     | 3    | 0      | 0      | 0      | 0       | 0        | 0         |
| src/templates/eventos/defaults.ts | 2     | 1    | 0      | 0      | 0      | 0       | 1        | 0         |
| src/lib/auth/audit.ts             | 1     | 1    | 0      | 0      | 0      | 0       | 0        | 0         |

**Grand total:** 8 / 7 clean / 0 surgical / **7 actionable**

## observe-rls-burn-readiness.ts

### L7 — REPLACE

**Reason:** active text

```
OLD:  * 2026-05-15 consejo veredict on SPEC OQ-7).
NEW:  * 2026-05-15 Squad veredict on SPEC OQ-7).
```

### L283 — REPLACE

**Reason:** active text

```
OLD:       "Next: Rey OK explicit (gravedad #21.a) → apply burn → 1h post-burn intensive monitoring.",
NEW:       "Next: CEO OK explicit (gravedad #21.a) → apply burn → 1h post-burn intensive monitoring.",
```

## force-global-signout.ts

### L15 — REPLACE

**Reason:** active text

```
OLD:  * **NO CORRER SIN SIGN-OFF EXPLÍCITO DEL REY** (T4 irreversible sobre prod
NEW:  * **NO CORRER SIN SIGN-OFF EXPLÍCITO DEL REY** (T4 irreversible sobre prod
```

### L67 — REPLACE

**Reason:** active text

```
OLD:       "Esta es protección defense-in-depth — el Rey debe firmar explícito.",
NEW:       "Esta es protección defense-in-depth — el CEO debe firmar explícito.",
```

### L146 — REPLACE

**Reason:** active text

```
OLD:     "Smoketest: Pablo (Rey Jota) debe ver session expired + recibir magic link al re-login.",
NEW:     "Smoketest: Pablo (CEO Jota) debe ver session expired + recibir magic link al re-login.",
```

## src/templates/eventos/defaults.ts

### L59 — REPLACE

**Reason:** active text

```
OLD:       key: "rey-leon",
NEW:       key: "rey-leon",
```

### L60 — KEEP-popcultureref

**Reason:** pop culture proper noun

```
OLD:       name: "Rey León",
```

## src/lib/auth/audit.ts

### L89 — REPLACE

**Reason:** active text

```
OLD:   // SAFE direction (real gate is human Rey sign-off per SPEC.md:60).
NEW:   // SAFE direction (real gate is human CEO sign-off per SPEC.md:60).
```
