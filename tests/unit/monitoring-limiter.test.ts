import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("getMonitoringLimiter", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when Upstash env vars are not set", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { getMonitoringLimiter } = await import("@/lib/ratelimit");
    expect(getMonitoringLimiter()).toBeNull();
  });

  it("returns a Ratelimit instance when Upstash env vars are set", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
    const { getMonitoringLimiter } = await import("@/lib/ratelimit");
    const limiter = getMonitoringLimiter();
    expect(limiter).not.toBeNull();
    // shape check
    expect(typeof limiter?.limit).toBe("function");
  });
});
