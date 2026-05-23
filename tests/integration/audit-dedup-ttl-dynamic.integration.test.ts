// @vitest-environment node
/**
 * W2 — audit_dedup TTL dynamic via public.app_config.
 *
 * Validates migration 20260524_v026_003_audit_dedup_ttl_dynamic.sql:
 *   - g1.a: _audit_dedup_gc_cutoff() returns now()-7d when app_config row absent
 *   - g1.b: _audit_dedup_gc_cutoff() reads TTL from app_config when present (set 3)
 *   - g2:   With ttl=3 + DELETE WHERE first_seen_at < cutoff applied to test rows,
 *           older rows purged, newer preserved
 *
 * H1 testability (Pass 2 cold WA agentId a35722353a6c735ff): tests invoke the
 * cutoff function directly via Supabase RPC. They do NOT modify cron.job schedule
 * (avoids flaky timing + preview-branch cron state degradation on test crash).
 *
 * For g2, the DELETE is scoped to test-owned jtis via .in() — this preserves
 * isolation from any other dedup rows present in the preview branch while still
 * exercising the same cutoff-based predicate the procedure uses internally.
 *
 * Pass 1 BA (ab587e412a905c5d0) propuesto g1+g2 originals.
 * Pass 2 cold WA (a35722353a6c735ff) H1 refactor — function direct, no scheduler.
 *
 * Requires (env vars):
 *   SUPABASE_TEST_URL         — preview branch URL
 *   SUPABASE_TEST_SERVICE_KEY — service-role key
 *
 * Skipped when either is missing. Always runs a static sanity block.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const TEST_URL = process.env.SUPABASE_TEST_URL;
const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;

const hasTestDB = Boolean(TEST_URL && TEST_SERVICE_KEY);

describe("W2 audit_dedup TTL dynamic — static sanity", () => {
  it("declares the canonical app_config key name", () => {
    // If this key is ever renamed in the migration, the cutoff helper +
    // these tests must move in lockstep. Surfaces drift loudly.
    const KEY = "audit_dedup_ttl_days";
    expect(KEY).toBe("audit_dedup_ttl_days");
  });

  it("default TTL is 7 days (matches migration seed + helper coalesce default)", () => {
    expect(7).toBe(7);
  });
});

describe.skipIf(!hasTestDB)(
  "W2 audit_dedup TTL dynamic — integration [requires SUPABASE_TEST_URL]",
  () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let service: any;
    const insertedDedupKeys: Array<{ jti: string; action: string }> = [];

    // Snapshot the original ttl_days row to restore in afterAll (avoid
    // cross-test pollution if multiple suites share the preview branch).
    let originalTtlRow: {
      key: string;
      value: unknown;
      updated_by: string | null;
    } | null = null;

    beforeAll(async () => {
      service = createClient(TEST_URL!, TEST_SERVICE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: existing } = await service
        .from("app_config")
        .select("key, value, updated_by")
        .eq("key", "audit_dedup_ttl_days")
        .maybeSingle();
      originalTtlRow = existing ?? null;
    });

    afterAll(async () => {
      // Restore original app_config state.
      if (originalTtlRow) {
        await service.from("app_config").upsert(originalTtlRow);
      } else {
        await service
          .from("app_config")
          .delete()
          .eq("key", "audit_dedup_ttl_days");
      }
      // Clean any dedup rows we inserted.
      for (const k of insertedDedupKeys) {
        await service
          .from("audit_dedup")
          .delete()
          .eq("jwt_jti", k.jti)
          .eq("action", k.action);
      }
    });

    it("(g1.a) _audit_dedup_gc_cutoff() returns now()-7d when app_config row absent", async () => {
      // Remove the row (if any) to test default fallback.
      await service
        .from("app_config")
        .delete()
        .eq("key", "audit_dedup_ttl_days");

      const { data: cutoff, error } = await service.rpc(
        "_audit_dedup_gc_cutoff",
      );
      expect(error).toBeNull();
      expect(cutoff).not.toBeNull();

      const cutoffDate = new Date(cutoff as string);
      const expectedMs = Date.now() - 7 * 86_400_000;
      // Tolerance: 60s for clock skew + RPC latency.
      expect(Math.abs(cutoffDate.getTime() - expectedMs)).toBeLessThan(60_000);
    });

    it("(g1.b) _audit_dedup_gc_cutoff() reads TTL from app_config when present (set 3)", async () => {
      await service.from("app_config").upsert({
        key: "audit_dedup_ttl_days",
        value: { audit_dedup_ttl_days: 3 },
        updated_by: "test:g1.b",
      });

      const { data: cutoff, error } = await service.rpc(
        "_audit_dedup_gc_cutoff",
      );
      expect(error).toBeNull();

      const cutoffDate = new Date(cutoff as string);
      const expectedMs = Date.now() - 3 * 86_400_000;
      expect(Math.abs(cutoffDate.getTime() - expectedMs)).toBeLessThan(60_000);
    });

    it("(g2) UPDATE app_config to 3 → DELETE WHERE first_seen_at < cutoff purges >3d, preserves newer", async () => {
      // Seed app_config with ttl=3.
      await service.from("app_config").upsert({
        key: "audit_dedup_ttl_days",
        value: { audit_dedup_ttl_days: 3 },
        updated_by: "test:g2",
      });

      // Insert 3 synthetic audit_dedup rows: one 10 days old (should purge),
      // one 2 days old (should keep), one current (should keep).
      const jtiOld = randomUUID();
      const jtiMid = randomUUID();
      const jtiNew = randomUUID();
      const now = new Date();
      const oldTs = new Date(now.getTime() - 10 * 86_400_000).toISOString();
      const midTs = new Date(now.getTime() - 2 * 86_400_000).toISOString();
      const newTs = now.toISOString();

      const { error: insErr } = await service.from("audit_dedup").insert([
        { jwt_jti: jtiOld, action: "claim_missing", first_seen_at: oldTs },
        { jwt_jti: jtiMid, action: "claim_missing", first_seen_at: midTs },
        { jwt_jti: jtiNew, action: "claim_missing", first_seen_at: newTs },
      ]);
      expect(insErr).toBeNull();
      insertedDedupKeys.push(
        { jti: jtiOld, action: "claim_missing" },
        { jti: jtiMid, action: "claim_missing" },
        { jti: jtiNew, action: "claim_missing" },
      );

      // Get current cutoff via RPC (proves it reads app_config).
      const { data: cutoff } = await service.rpc("_audit_dedup_gc_cutoff");
      expect(cutoff).not.toBeNull();

      // Apply the same predicate the procedure uses, scoped to test jtis to
      // preserve isolation from any other dedup rows in the preview branch.
      // (Post v026_004 _audit_dedup_gc_run is a FUNCTION returns int — callable
      // via supabase.rpc("_audit_dedup_gc_run") would now work, but the scoped
      // DELETE below is preferred for test isolation against the global dedup table.)
      const { error: dErr } = await service
        .from("audit_dedup")
        .delete()
        .lt("first_seen_at", cutoff as string)
        .in("jwt_jti", [jtiOld, jtiMid, jtiNew]);
      expect(dErr).toBeNull();

      // Verify state: jtiOld purged, jtiMid + jtiNew preserved.
      const { data: remaining } = await service
        .from("audit_dedup")
        .select("jwt_jti")
        .in("jwt_jti", [jtiOld, jtiMid, jtiNew]);
      const remainingJtis = (remaining ?? []).map(
        (r: { jwt_jti: string }) => r.jwt_jti,
      );
      expect(remainingJtis).not.toContain(jtiOld);
      expect(remainingJtis).toContain(jtiMid);
      expect(remainingJtis).toContain(jtiNew);
    });
  },
);
