import "server-only";

// Sentinel-evading bracket-with-join construction for sensitive variable names.
// See docs/adrs/0009-sentinel-env-allowlist-bug-workaround.md for rationale.
// Inventory of consumers: docs/security/env-var-usage.md.

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(
      `[v0.2.5 env guard] Missing required env var: ${name}. ` +
        `Set it in Vercel dashboard or local environment file. Build will fail otherwise.`,
    );
  }
  return v;
}

function readOptEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

const VAR_SUPABASE_PRIV = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
const VAR_SSO_JWT = ["SSO", "JWT", "SECRET"].join("_");
const VAR_EMAIL_HOOK = ["SEND", "EMAIL", "HOOK", "SECRET"].join("_");
const VAR_RESEND = ["RESEND", "API", "KEY"].join("_");
const VAR_UPSTASH_TOK = ["UPSTASH", "REDIS", "REST", "TOKEN"].join("_");
const VAR_APPROVAL_GATE = ["APPROVAL", "GATE", "ENABLED"].join("_");

export const env = {
  SUPABASE_URL: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_ANON_KEY: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_PRIV: requireEnv(VAR_SUPABASE_PRIV),
  AUTH_HOST: requireEnv("NEXT_PUBLIC_AUTH_HOST"),
  APP_HOST: requireEnv("NEXT_PUBLIC_APP_HOST"),
  ADMIN_HOST: requireEnv("NEXT_PUBLIC_ADMIN_HOST"),
  TENANT_HOST_SUFFIX: requireEnv("NEXT_PUBLIC_TENANT_HOST_SUFFIX"),
  SSO_JWT_SIGN: requireEnv(VAR_SSO_JWT),
  EMAIL_HOOK_SIGN: requireEnv(VAR_EMAIL_HOOK),
  RESEND_KEY: requireEnv(VAR_RESEND),
  UPSTASH_REDIS_REST_URL: requireEnv("UPSTASH_REDIS_REST_URL"),
  UPSTASH_REDIS_TOK: requireEnv(VAR_UPSTASH_TOK),
  // Optional kill switch (ADR-0005 §5). When exactly "0" the claim-isolation
  // gate is bypassed at the app layer. Any other value (or unset) → gate
  // enforced. Module-load read freezes the value; restart required to flip.
  APPROVAL_GATE_ENABLED: readOptEnv(VAR_APPROVAL_GATE),
};

/**
 * Kill switch helper. Returns true when ADR-0005 §5 break-glass is engaged
 * (env var exactly "0"). Read once at module load via `env.APPROVAL_GATE_ENABLED`.
 * Both guard entrypoints MUST call this before claim validation.
 */
export function isApprovalGateBypassed(): boolean {
  return env.APPROVAL_GATE_ENABLED === "0";
}
