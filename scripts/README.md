# scripts/

Cross-shell verify scripts for v0.3.0 quality gates.
Designed to run on PowerShell, bash, zsh equally — all logic in TypeScript via `npx tsx`.

## Quick reference

| Script                      | Purpose                                                  | Used in PLAN.md task |
| --------------------------- | -------------------------------------------------------- | -------------------- |
| `check-no-any.ts`           | Assert 0 `as any` + 0 unjustified `@ts-ignore` in `src/` | A2, A5 verify        |
| `check-coverage.ts`         | Assert per-handler ≥70% + global ≥60% coverage           | A3 verify            |
| `check-security-headers.ts` | Assert CSP/HSTS/etc. headers present on URL              | B5, post-C1 verify   |
| `check-reviews-resolved.ts` | Assert review file has 0 Open HIGH findings              | A2 verify            |
| `lighthouse-mobile.ts`      | Lighthouse mobile audit + thresholds                     | A6, B5 verify        |
| `verify-pablo-jwt.ts`       | Assert Pablo's JWT has admin role + Hakuna owner         | B4 verify            |

## Running

```powershell
npx tsx scripts/check-no-any.ts
npx tsx scripts/check-coverage.ts --handlers=70 --global=60
npx tsx scripts/check-security-headers.ts https://hakunamatata.impluxa.com
npx tsx scripts/check-reviews-resolved.ts docs/reviews/fase1a-handlers.md
npx tsx scripts/lighthouse-mobile.ts http://localhost:3000 hakunamatata
npx tsx scripts/verify-pablo-jwt.ts https://app.impluxa.com
```

## Dependencies

- `tsx` — installed as devDependency (assumed already present from FASE 1A)
- `glob` — used by `check-no-any.ts` (install: `npm i -D glob`)
- `lighthouse` + `chrome-launcher` — required for `lighthouse-mobile.ts` (install: `npm i -D lighthouse chrome-launcher`)

## Exit codes (convention)

| Code | Meaning                                                                        |
| ---- | ------------------------------------------------------------------------------ |
| 0    | Pass — all assertions met                                                      |
| 1    | Fail — assertion violation (gate blocked)                                      |
| 2    | Error — script can't run (missing config, missing endpoint, fetch error, etc.) |

CI scripts should treat 1 and 2 differently: 1 means "developer needs to fix code", 2 means "tooling/env broken — fix scripts or setup".
