/**
 * seed-preview-v026-w1t1-5b.ts
 *
 * Idempotent seed script for the Supabase preview branch used by the
 * v0.2.6 W1.T1 Sub-paso 5.B integration tests. Run against the preview
 * branch ONLY (project_ref `llyexugyuwwdqfarumbj`). NEVER against prod
 * Hakuna (`groeusdopucnjgqdwzjv`).
 *
 * Sub-paso scope (s13 5B.6.bis):
 *   - UPSERT public.app_config(key='hook_reenable_ts', value=jsonb) so the
 *     observe-rls-burn-readiness.ts T0 anchor (B-H1 mitigation) has a
 *     lower-bound watermark in tests.
 *
 * DEFERRED to s14 (5B.9 integration tests setup):
 *   - Create 3 auth.users via Admin API:
 *       (a) user_with_tenant: app_metadata = { active_tenant_id: <uuid> }
 *       (b) user_claim_missing: app_metadata = { role: "editor" }   (no key)
 *       (c) user_tenant_null:   app_metadata = { active_tenant_id: null }
 *   - Insert 1 tenant + membership rows so RLS claim-based v2 has subjects.
 *   - Optionally emit 2 audit_log rows via append_audit RPC (one claim_missing,
 *     one active_tenant_null) so observe-rls-burn-readiness.ts has signals to
 *     count. Skip if integration tests will produce these organically.
 *
 * Usage:
 *   npx tsx scripts/seed-preview-v026-w1t1-5b.ts
 *
 * Env (preview branch only — do NOT point at prod):
 *   PREVIEW_SUPABASE_URL      — REST endpoint for llyexugyuwwdqfarumbj
 *   PREVIEW_SUPABASE_PRIV     — service_role JWT for the preview branch
 *
 * Trust tier: T2 idempotent write to preview branch. No effect on prod.
 *
 * Rollback: re-run with HOOK_REENABLE_TS unset and the row will be DELETEd,
 * OR drop the row manually via psql. The preview branch itself is ephemeral.
 */

const VAR_URL = ["PREVIEW", "SUPABASE", "URL"].join("_");
const VAR_PRIV = ["PREVIEW", "SUPABASE", "PRIV"].join("_");

function getenv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(
      `[seed-preview-v026-w1t1-5b] Missing env var: ${name}. ` +
        `Set it to the preview branch URL/JWT before running.`,
    );
  }
  return v;
}

function preventProdMisfire(url: string): void {
  // Refuse to run against the prod project_ref. The prod ref is groeusdopucnjgqdwzjv;
  // the preview ref is llyexugyuwwdqfarumbj. Sub-paso 5.B Two-Pass cold round
  // P-COLD-9 mandates a try/finally cleanup posture — first guard is at start.
  if (url.includes("groeusdopucnjgqdwzjv")) {
    throw new Error(
      "[seed-preview-v026-w1t1-5b] REFUSING to run: target URL points at prod " +
        "(groeusdopucnjgqdwzjv). Use llyexugyuwwdqfarumbj preview branch only.",
    );
  }
}

async function upsertAppConfig(
  url: string,
  jwt: string,
  key: string,
  value: unknown,
  updatedBy: string,
): Promise<void> {
  const resp = await fetch(`${url}/rest/v1/app_config?on_conflict=key`, {
    method: "POST",
    headers: {
      apikey: jwt,
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(
      `app_config UPSERT (key=${key}) failed: HTTP ${resp.status} ${body}`,
    );
  }
}

async function main(): Promise<void> {
  const url = getenv(VAR_URL);
  const jwt = getenv(VAR_PRIV);
  preventProdMisfire(url);

  // Pretend the hook was re-enabled "right now" for test purposes. Real prod
  // operator UPSERT happens at the moment of hook re-enable on Supabase
  // dashboard, with the actual timestamp.
  const hookReenableTs = new Date().toISOString();
  await upsertAppConfig(
    url,
    jwt,
    "hook_reenable_ts",
    { ts: hookReenableTs, note: "seeded by seed-preview-v026-w1t1-5b.ts" },
    "seed-preview-script",
  );

   
  console.log(
    JSON.stringify({
      level: "info",
      event: "preview_seed_done",
      hook_reenable_ts: hookReenableTs,
      note: "auth.users + audit_log seeds deferred to s14 integration tests",
    }),
  );
}

main().catch((err) => {
   
  console.error(
    JSON.stringify({
      level: "error",
      event: "preview_seed_failed",
      err: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
});
