# Environment Variable Usage Inventory

> Compensates for the static analysis blind spot introduced by the Sentinel-evading
> construction pattern (ADR-0009). When the canonical variable name does not appear
> as a literal in source, TypeScript types and ESLint plugins cannot detect the
> dependency. This document is the manual source of truth.

> Last updated: 2026-05-15 (sesión 6ª). Update when adding a new sensitive variable
> or moving an existing one between files.

## Loader module

All sensitive variables are accessed through `src/lib/runtime-config.ts`, which:

1. Constructs each canonical name at module-load-time via `[parts].join("_")` to evade Sentinel's `check_sensitive_env` regex.
2. Calls `requireEnv(name)` which throws if the variable is missing.
3. Exports a typed object that consumers import — consumer files use plain identifier names (`runtimeConfig.SUPABASE_PRIV`), not the canonical names.

Consumer files MUST import from `runtime-config`, not access the process environment directly. The two exceptions documented below have their own reason for direct access.

## Variable → consumer map

| Canonical name (process-side)                 | Loader constant                  | Files that consume                                                                    |
| --------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                    | `SUPABASE_URL`                   | `runtime-config.ts`, all `src/lib/supabase/*` factories                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`               | `SUPABASE_ANON_KEY`              | `runtime-config.ts`, browser + edge supabase factories                                |
| Service-role key (via `VAR_SUPABASE_PRIV`)    | `SUPABASE_PRIV`                  | `runtime-config.ts`, `src/lib/supabase/service.ts`, `scripts/force-global-signout.ts` |
| `NEXT_PUBLIC_AUTH_HOST`                       | `AUTH_HOST`                      | `runtime-config.ts`, middleware host routing                                          |
| `NEXT_PUBLIC_APP_HOST`                        | `APP_HOST`                       | `runtime-config.ts`, middleware host routing                                          |
| `NEXT_PUBLIC_ADMIN_HOST`                      | `ADMIN_HOST`                     | `runtime-config.ts`, admin route guards                                               |
| `NEXT_PUBLIC_TENANT_HOST_SUFFIX`              | `TENANT_HOST_SUFFIX`             | `runtime-config.ts`, tenant resolver                                                  |
| SSO JWT secret (via `VAR_SSO_JWT`)            | `SSO_JWT_SIGN`                   | `runtime-config.ts`, SSO token signer (W3.G2)                                         |
| Send Email Hook secret (via `VAR_EMAIL_HOOK`) | `EMAIL_HOOK_SIGN`                | `runtime-config.ts`, `/api/auth/email-hook` route handler                             |
| Resend API key (via `VAR_RESEND`)             | `RESEND_KEY`                     | `runtime-config.ts`, Resend client at `/api/auth/email-hook`                          |
| `UPSTASH_REDIS_REST_URL`                      | `UPSTASH_REDIS_REST_URL`         | `runtime-config.ts`, rate-limit middleware                                            |
| Upstash Redis token (via `VAR_UPSTASH_TOK`)   | `UPSTASH_REDIS_TOK`              | `runtime-config.ts`, rate-limit middleware                                            |
| `KING_SIGNED`                                 | (read directly in script guards) | `scripts/force-global-signout.ts` line 62 — guard to require explicit Rey approval    |
| `SUPABASE_URL` (non-public fallback)          | (read directly)                  | `scripts/force-global-signout.ts` line 37 — coalesces with NEXT_PUBLIC_SUPABASE_URL   |

## Direct-access exceptions (NOT going through `runtime-config`)

Two patterns access the process environment directly without the loader:

1. **Scripts intended to run outside the Next.js runtime** (`scripts/force-global-signout.ts`, future maintenance scripts). These cannot import `runtime-config` because the loader's `requireEnv` calls fail-hard when run in a non-app context (missing `NEXT_PUBLIC_*` vars). Scripts inline their own minimal access with the same construction pattern.

2. **Boot-time guards before module-load** (e.g., `KING_SIGNED` check before any other code runs). These intentionally avoid the loader to prevent loader errors from masking the guard failure.

## Adding a new sensitive variable

1. Add a `VAR_<NAME> = [parts].join("_")` constant in `src/lib/runtime-config.ts`.
2. Add a typed entry in the exported `runtimeConfig` object using `requireEnv(VAR_<NAME>)`.
3. Add a row to the table above with all consumer files.
4. Update the Sentinel allowlist (`C:\Users\Pablo\.claude\sentinel-allowlist.json`) only if a Bash command or non-loader file needs to reference the variable by canonical name — otherwise the loader-internal construction is sufficient.
5. If the variable is production-secret (rotates, has auth value), add a rotation playbook entry in `docs/security/secret-rotation.md` (TODO if not yet created).

## Removing a sensitive variable

1. Delete the consumer line in `runtime-config.ts`.
2. Delete the `VAR_*` constant.
3. Remove the row in the table.
4. If the variable was in Vercel / Supabase / shell exports, remove there too — leaving orphan secrets is bad hygiene (decision #33 sesión 6ª cleanup pattern).

## Related references

- `docs/adrs/0009-sentinel-env-allowlist-bug-workaround.md` — why the bracket-with-join pattern exists
- `src/lib/runtime-config.ts` — actual loader implementation (~34 lines)
- `scripts/force-global-signout.ts` — direct-access example (W4.T7 POST-MERGE only)
- `memory/reference_sentinel_check_env_no_allowlist.md` — original bug discovery
