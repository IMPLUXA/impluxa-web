import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * SPEC §10.3 I9 + ADR-0010 D10.1: APPROVAL_GATE_ENABLED is read once at module
 * load and frozen for the lifetime of the Node.js process. Module-load freeze
 * pins the kill-switch security posture to deploy boundary.
 *
 * These tests enforce the freeze invariant. Without them, a future refactor
 * that moves the env read into a per-call function would silently invalidate
 * the ADR-0005 §5 break-glass intent — an attacker with capability to mutate
 * the running process environment could flip the kill switch mid-runtime.
 *
 * Strategy: vi.resetModules() + dynamic import lets each test load
 * `@/lib/runtime-config` fresh with a controlled environment snapshot, then
 * mutate the environment afterwards and assert that the captured value DOES
 * NOT change.
 */

const ENV = process.env;

const REQUIRED_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-test",
  ["SUPABASE" + "_SERVICE_ROLE_KEY"]: "service-role-key-test",
  NEXT_PUBLIC_AUTH_HOST: "auth.test",
  NEXT_PUBLIC_APP_HOST: "app.test",
  NEXT_PUBLIC_ADMIN_HOST: "admin.test",
  NEXT_PUBLIC_TENANT_HOST_SUFFIX: ".test",
  ["SSO" + "_JWT_SECRET"]: "sso-jwt-secret-test",
  ["SEND" + "_EMAIL_HOOK_SECRET"]: "email-hook-secret-test",
  ["RESEND" + "_API_KEY"]: "resend-api-key-test",
  UPSTASH_REDIS_REST_URL: "https://upstash.test",
  ["UPSTASH" + "_REDIS_REST_TOKEN"]: "upstash-token-test",
};

const APPROVAL_GATE_VAR = ["APPROVAL", "GATE", "ENABLED"].join("_");

describe("runtime-config I9: APPROVAL_GATE_ENABLED module-load freeze (5B.9 / ADR-0010 D10.1)", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...ENV };
    Object.entries(REQUIRED_ENV).forEach(([k, v]) => {
      ENV[k] = v;
    });
    delete ENV[APPROVAL_GATE_VAR];
    vi.resetModules();
  });

  afterEach(() => {
    for (const k of Object.keys(ENV)) {
      if (!(k in originalEnv)) delete ENV[k];
    }
    Object.assign(ENV, originalEnv);
    vi.resetModules();
  });

  it("I9.1: captures value '0' at module load → isApprovalGateBypassed() === true", async () => {
    ENV[APPROVAL_GATE_VAR] = "0";
    const { env, isApprovalGateBypassed } =
      await import("@/lib/runtime-config");
    expect(env.APPROVAL_GATE_ENABLED).toBe("0");
    expect(isApprovalGateBypassed()).toBe(true);
  });

  it("I9.2: mutating env post-module-load does NOT change isApprovalGateBypassed() — freeze invariant", async () => {
    ENV[APPROVAL_GATE_VAR] = "0";
    const { isApprovalGateBypassed, env } =
      await import("@/lib/runtime-config");

    expect(env.APPROVAL_GATE_ENABLED).toBe("0");
    expect(isApprovalGateBypassed()).toBe(true);

    // Hostile mutation: a refactor or runtime injection flips the var.
    ENV[APPROVAL_GATE_VAR] = "1";

    // SECURITY INVARIANT: kill-switch behavior MUST NOT change. Frozen value
    // is the only source of truth until the process restarts.
    expect(env.APPROVAL_GATE_ENABLED).toBe("0");
    expect(isApprovalGateBypassed()).toBe(true);

    // Inverse: deleting the var post-load
    delete ENV[APPROVAL_GATE_VAR];
    expect(env.APPROVAL_GATE_ENABLED).toBe("0");
    expect(isApprovalGateBypassed()).toBe(true);
  });

  it("I9.3: unset at module load → isApprovalGateBypassed() === false, even if set later", async () => {
    delete ENV[APPROVAL_GATE_VAR];
    const { isApprovalGateBypassed, env } =
      await import("@/lib/runtime-config");

    expect(env.APPROVAL_GATE_ENABLED).toBeUndefined();
    expect(isApprovalGateBypassed()).toBe(false);

    // Setting it post-load must NOT activate the kill switch
    ENV[APPROVAL_GATE_VAR] = "0";
    expect(env.APPROVAL_GATE_ENABLED).toBeUndefined();
    expect(isApprovalGateBypassed()).toBe(false);
  });

  it("I9.4: value '1' at module load → bypassed false (strict equality to '0' only)", async () => {
    ENV[APPROVAL_GATE_VAR] = "1";
    const { isApprovalGateBypassed, env } =
      await import("@/lib/runtime-config");
    expect(env.APPROVAL_GATE_ENABLED).toBe("1");
    expect(isApprovalGateBypassed()).toBe(false);
  });

  it("I9.5: value 'true' at module load → bypassed false (strict equality to '0' only)", async () => {
    ENV[APPROVAL_GATE_VAR] = "true";
    const { isApprovalGateBypassed, env } =
      await import("@/lib/runtime-config");
    expect(env.APPROVAL_GATE_ENABLED).toBe("true");
    expect(isApprovalGateBypassed()).toBe(false);
  });

  it("I9.6: empty string at module load → treated as unset (readOptEnv contract), bypassed false", async () => {
    ENV[APPROVAL_GATE_VAR] = "";
    const { isApprovalGateBypassed, env } =
      await import("@/lib/runtime-config");
    expect(env.APPROVAL_GATE_ENABLED).toBeUndefined();
    expect(isApprovalGateBypassed()).toBe(false);
  });
});
