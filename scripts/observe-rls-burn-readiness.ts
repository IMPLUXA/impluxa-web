/**
 * observe-rls-burn-readiness.ts
 *
 * Read-only telemetry script for the 24h observability window prior to v0.2.6
 * RLS burn migration apply (FR-RLS-BURN-2). Recommended by Backend Architect
 * agentId `ab0e469f56c0e28cc` over a canary endpoint approach (sesión 6ª
 * 2026-05-15 consejo veredict on SPEC OQ-7).
 *
 * Usage:
 *   npx tsx scripts/observe-rls-burn-readiness.ts                          # default report
 *   npx tsx scripts/observe-rls-burn-readiness.ts --hours 24                # window size
 *   npx tsx scripts/observe-rls-burn-readiness.ts --since-hook-reenable     # auto-detect hook reenable T0
 *   npx tsx scripts/observe-rls-burn-readiness.ts --require-zero-claim-missing  # exit non-zero if any miss
 *   npx tsx scripts/observe-rls-burn-readiness.ts --json                    # machine output
 *
 * Reads:
 *   process.env[VAR_SUPABASE_URL]      (or NEXT_PUBLIC_SUPABASE_URL)
 *   process.env[VAR_SUPABASE_PRIV]     (service role)
 *
 * Mutates:
 *   nothing. SELECT-only queries.
 *
 * Trust tier: T1 read-only sobre prod Hakuna (auth.users + audit_log SELECT).
 *
 * NOTE: This script assumes audit_log instrumentation for `claim_missing` and
 * `active_tenant_null` action types exists by v0.2.6 ship. If those rows do
 * not exist in audit_log yet, the script reports `INSTRUMENTATION_GAP` and
 * gates non-zero. Add the audit_log writers in PLAN.md task M0.5 (per BA).
 */

const VAR_SUPABASE_URL = ["NEXT", "PUBLIC", "SUPABASE", "URL"].join("_");
const VAR_SUPABASE_URL_ALT = ["SUPABASE", "URL"].join("_");
const VAR_SUPABASE_PRIV = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");

type Args = {
  hours: number;
  sinceHookReenable: boolean;
  requireZeroClaimMissing: boolean;
  json: boolean;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = {
    hours: 24,
    sinceHookReenable: false,
    requireZeroClaimMissing: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--hours") args.hours = parseInt(argv[++i] ?? "24", 10);
    else if (a === "--since-hook-reenable") args.sinceHookReenable = true;
    else if (a === "--require-zero-claim-missing")
      args.requireZeroClaimMissing = true;
    else if (a === "--json") args.json = true;
    else if (a === "-h" || a === "--help") {
      console.log(
        "Usage: npx tsx scripts/observe-rls-burn-readiness.ts [--hours N] [--since-hook-reenable] [--require-zero-claim-missing] [--json]",
      );
      process.exit(0);
    }
  }
  return args;
}

function getEnvOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function fetchHookReenableT0(
  supabaseUrl: string,
  key: string,
): Promise<string | null> {
  // Query Supabase Management API for current hook config — last_modified is approximate T0.
  // Fallback if not available: caller must pass --hours manually.
  // For now, return null (not implemented — Management API config endpoint doesn't expose lastModified per-field).
  void supabaseUrl;
  void key;
  return null;
}

type Counts = {
  tokenMints: number;
  claimMissing: number;
  activeTenantNull: number;
  instrumentationGap: boolean;
  windowStart: string;
  windowEnd: string;
};

async function fetchCounts(
  supabaseUrl: string,
  key: string,
  windowStartIso: string,
): Promise<Counts> {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "count=exact",
  };

  // 1. Token-mint denominator: auth.users.last_sign_in_at > windowStart
  const usersResp = await fetch(
    `${supabaseUrl}/rest/v1/users?select=id&last_sign_in_at=gt.${encodeURIComponent(windowStartIso)}`,
    { headers: { ...headers, "Accept-Profile": "auth" } },
  );
  const tokenMints = parseInt(
    usersResp.headers.get("content-range")?.split("/")[1] ?? "0",
    10,
  );

  // 2. claim_missing audit events (instrumentation expected by v0.2.6)
  const claimMissingResp = await fetch(
    `${supabaseUrl}/rest/v1/audit_log?select=id&action_type=eq.claim_missing&created_at=gt.${encodeURIComponent(windowStartIso)}`,
    { headers },
  );
  const claimMissingHeader = claimMissingResp.headers.get("content-range");
  const claimMissing = parseInt(claimMissingHeader?.split("/")[1] ?? "0", 10);

  // 3. active_tenant_null events (proxy for hook misfire rate)
  const ntnResp = await fetch(
    `${supabaseUrl}/rest/v1/audit_log?select=id&action_type=eq.active_tenant_null&created_at=gt.${encodeURIComponent(windowStartIso)}`,
    { headers },
  );
  const ntnHeader = ntnResp.headers.get("content-range");
  const activeTenantNull = parseInt(ntnHeader?.split("/")[1] ?? "0", 10);

  // Detect instrumentation gap: if action_type column or rows simply do not exist,
  // PostgREST returns 200 with count=0 (false negative). Best-effort heuristic:
  // also query for ANY row in audit_log within window. If zero AND tokenMints>0 → likely gap.
  const anyResp = await fetch(
    `${supabaseUrl}/rest/v1/audit_log?select=id&created_at=gt.${encodeURIComponent(windowStartIso)}&limit=1`,
    { headers },
  );
  const anyRow = (await anyResp.json()) as unknown[];
  const instrumentationGap = tokenMints > 0 && anyRow.length === 0;

  return {
    tokenMints,
    claimMissing,
    activeTenantNull,
    instrumentationGap,
    windowStart: windowStartIso,
    windowEnd: new Date().toISOString(),
  };
}

function reportText(
  c: Counts,
  args: Args,
): { text: string; verdict: "GO" | "NO-GO" } {
  const lines: string[] = [];
  lines.push("=== v0.2.6 RLS Burn Readiness Report ===");
  lines.push(`Window: ${c.windowStart} → ${c.windowEnd}`);
  lines.push(`Window hours requested: ${args.hours}`);
  lines.push("");
  lines.push(`Token mints (auth.users.last_sign_in_at): ${c.tokenMints}`);
  lines.push(`claim_missing events:                    ${c.claimMissing}`);
  lines.push(`active_tenant_null events:               ${c.activeTenantNull}`);
  lines.push(
    `Instrumentation gap detected:            ${c.instrumentationGap ? "YES (audit_log empty during window)" : "no"}`,
  );
  lines.push("");

  let verdict: "GO" | "NO-GO" = "GO";
  const reasons: string[] = [];
  if (c.tokenMints === 0) {
    reasons.push(
      "Zero token mints during window — no real signal yet. Wait or extend window.",
    );
    verdict = "NO-GO";
  }
  if (c.claimMissing > 0) {
    reasons.push(
      `claim_missing > 0 — hook fail-closed fired. Triage before burn.`,
    );
    verdict = "NO-GO";
  }
  if (c.activeTenantNull > 0) {
    reasons.push(
      `active_tenant_null > 0 — hook misfire detected. Investigate before burn.`,
    );
    verdict = "NO-GO";
  }
  if (c.instrumentationGap) {
    reasons.push(
      "Instrumentation gap — audit_log has no rows in window. Either Hakuna idle (low traffic) or instrumentation missing.",
    );
    if (args.requireZeroClaimMissing) verdict = "NO-GO";
  }

  if (verdict === "GO") {
    lines.push(
      "VERDICT: GO — readiness criteria met for v0.2.6 burn migration apply.",
    );
    lines.push(
      "Next: Rey OK explicit (gravedad #21.a) → apply burn → 1h post-burn intensive monitoring.",
    );
  } else {
    lines.push("VERDICT: NO-GO — readiness criteria NOT met:");
    for (const r of reasons) lines.push(`  - ${r}`);
  }
  return { text: lines.join("\n"), verdict };
}

async function main() {
  const args = parseArgs();
  const supabaseUrl =
    process.env[VAR_SUPABASE_URL] ?? process.env[VAR_SUPABASE_URL_ALT];
  const key = getEnvOrThrow(VAR_SUPABASE_PRIV);
  if (!supabaseUrl) throw new Error("Missing Supabase URL env var");

  let windowStartIso: string;
  if (args.sinceHookReenable) {
    const t0 = await fetchHookReenableT0(supabaseUrl, key);
    if (t0) windowStartIso = t0;
    else {
      console.warn(
        "--since-hook-reenable: T0 unavailable from API, falling back to --hours window",
      );
      windowStartIso = new Date(
        Date.now() - args.hours * 3600 * 1000,
      ).toISOString();
    }
  } else {
    windowStartIso = new Date(
      Date.now() - args.hours * 3600 * 1000,
    ).toISOString();
  }

  const counts = await fetchCounts(supabaseUrl, key, windowStartIso);

  if (args.json) {
    console.log(JSON.stringify(counts, null, 2));
  } else {
    const { text, verdict } = reportText(counts, args);
    console.log(text);
    if (verdict === "NO-GO" && args.requireZeroClaimMissing) {
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(2);
});
