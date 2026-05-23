// @vitest-environment node
/**
 * W2 — audit_dedup bypass for non-tenant-claim actions (H6 regression coverage).
 *
 * Validates back-compat of append_audit signature change (void → bigint,
 * migration 20260518_v026_001_audit_dedup.sql) for callers that:
 *   - Pass an action NOT IN ('claim_missing', 'active_tenant_null')
 *   - May or may not include jwt_jti
 *
 * Expected behavior per migration 20260518 lines 141-152 (the dedup gate):
 *   - Gate is SKIPPED entirely for non-tenant actions
 *   - audit_log row IS inserted (write proceeds)
 *   - audit_dedup row is NOT inserted
 *   - Returns bigint NOT NULL (id of the audit_log row)
 *
 * Regression target: any future change to the dedup gate condition (line 143)
 * must not accidentally narrow the write path for non-tenant actions like
 * 'auth.login', 'audit.read', 'tenant.switch'.
 *
 * Pass 2 cold WA (sesion 2026-05-23, agentId a35722353a6c735ff) H6 finding.
 * Pass 1 BA (ab587e412a905c5d0) verified callers ignore return value via grep
 * but did NOT propose a regression test — H6 closes that gap.
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

describe("W2 audit_dedup bypass — static sanity", () => {
  it("documents non-tenant actions are NOT in the dedup tracked set", () => {
    // Mirror of the gate condition in migration 20260518 line 143.
    const TRACKED = new Set(["claim_missing", "active_tenant_null"]);
    const NON_TRACKED = [
      "auth.login",
      "audit.read",
      "tenant.switch",
      "session.refresh",
    ];
    for (const a of NON_TRACKED) {
      expect(TRACKED.has(a)).toBe(false);
    }
  });
});

describe.skipIf(!hasTestDB)(
  "W2 audit_dedup bypass — integration [requires SUPABASE_TEST_URL]",
  () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let service: any;
    const insertedAuditIds: number[] = [];

    beforeAll(() => {
      service = createClient(TEST_URL!, TEST_SERVICE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    });

    afterAll(async () => {
      if (insertedAuditIds.length > 0) {
        await service.from("audit_log").delete().in("id", insertedAuditIds);
      }
    });

    it("(g4.a) action='auth.login' with jwt_jti → writes + returns bigint + no dedup row", async () => {
      const jti = randomUUID();
      const userId = randomUUID();

      const { data: auditId, error } = await service.rpc("append_audit", {
        p_event: {
          action: "auth.login",
          jwt_jti: jti,
          actor_user_id: userId,
        },
      });
      expect(error).toBeNull();
      expect(auditId).not.toBeNull();
      expect(typeof auditId).toBe("number");
      insertedAuditIds.push(auditId);

      // audit_dedup must have NO row for this (jti, 'auth.login') — gate skipped.
      const { data: dedupRows, error: dErr } = await service
        .from("audit_dedup")
        .select("jwt_jti, action")
        .eq("jwt_jti", jti);
      expect(dErr).toBeNull();
      expect(dedupRows ?? []).toHaveLength(0);
    });

    it("(g4.b) action='auth.login' WITHOUT jwt_jti → writes + returns bigint", async () => {
      const userId = randomUUID();

      const { data: auditId, error } = await service.rpc("append_audit", {
        p_event: {
          action: "auth.login",
          // jwt_jti deliberately omitted
          actor_user_id: userId,
        },
      });
      expect(error).toBeNull();
      expect(auditId).not.toBeNull();
      expect(typeof auditId).toBe("number");
      insertedAuditIds.push(auditId);
    });

    it("(g4.c) action='audit.read' with jwt_jti → repeated calls each write (no dedup collapse)", async () => {
      const jti = randomUUID();
      const userId = randomUUID();

      const { data: id1, error: e1 } = await service.rpc("append_audit", {
        p_event: {
          action: "audit.read",
          jwt_jti: jti,
          actor_user_id: userId,
        },
      });
      expect(e1).toBeNull();
      expect(id1).not.toBeNull();
      insertedAuditIds.push(id1);

      const { data: id2, error: e2 } = await service.rpc("append_audit", {
        p_event: {
          action: "audit.read",
          jwt_jti: jti,
          actor_user_id: userId,
        },
      });
      expect(e2).toBeNull();
      expect(id2).not.toBeNull();
      expect(id2).not.toBe(id1);
      insertedAuditIds.push(id2);

      // Both rows present (no dedup collapse for non-tracked action).
      const { count } = await service
        .from("audit_log")
        .select("id", { count: "exact", head: true })
        .eq("actor_user_id", userId)
        .eq("action", "audit.read");
      expect(count).toBe(2);

      // audit_dedup empty for this jti.
      const { data: dedupRows } = await service
        .from("audit_dedup")
        .select("jwt_jti")
        .eq("jwt_jti", jti);
      expect(dedupRows ?? []).toHaveLength(0);
    });
  },
);
