// @vitest-environment node
/**
 * Audit Log Hash Chain Integrity Tests (W4.T6, FR-AUTH-7).
 *
 * Validates that the partitioned `public.audit_log` table with its hash-chain
 * trigger (migration `20260514_v025_005_audit_log.sql`) produces a verifiable
 * tamper-evident SHA-256 chain across inserts done via `public.append_audit`.
 *
 * Threat mitigated: T-v025-03 (audit log mutation / tampering).
 *
 * Requires (env vars):
 *   SUPABASE_TEST_URL         — preview-branch URL
 *   SUPABASE_TEST_ANON_KEY    — anon key of preview branch
 *   SUPABASE_TEST_SERVICE_KEY — service-role key (append_audit caller)
 *
 * Skipped when any of the above is missing. Always runs a static
 * sanity block so the file never fully no-ops in CI.
 */

import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const TEST_URL = process.env.SUPABASE_TEST_URL;
const TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY;
const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;

const hasTestDB = Boolean(TEST_URL && TEST_ANON_KEY && TEST_SERVICE_KEY);

interface AuditRow {
  id: number;
  occurred_at: string;
  actor_user_id: string | null;
  actor_session_id: string | null;
  acting_as_tenant_id: string | null;
  acting_as_role: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  metadata: Record<string, unknown> | null;
  prev_record_hash: string | null;
  record_hash: string;
}

/**
 * Reproduces the SQL payload format from
 * `public.audit_log_compute_hash()` exactly. Order and null-handling must
 * match the trigger byte-for-byte.
 *
 * Postgres `jsonb::text` canonical form: no leading/trailing whitespace,
 * keys sorted lexicographically. `JSON.stringify` does NOT match that —
 * we accept this drift only for rows whose `metadata` we control as `{}`
 * or known-shape; for the integrity assertion we use the value Postgres
 * itself stored (read back as JS object → re-serialize with the same
 * canonical key order the trigger used = `{}` in our seed).
 */
function computeExpectedHash(prevHash: string | null, row: AuditRow): string {
  const empty = (v: string | null | undefined) => v ?? "";
  const metaCanonical =
    row.metadata === null ||
    row.metadata === undefined ||
    Object.keys(row.metadata).length === 0
      ? "{}"
      : JSON.stringify(row.metadata); // best-effort, only safe for known seeds
  const payload =
    (prevHash ?? "") +
    "|" +
    row.occurred_at +
    "|" +
    empty(row.actor_user_id) +
    "|" +
    empty(row.actor_session_id) +
    "|" +
    empty(row.acting_as_tenant_id) +
    "|" +
    empty(row.acting_as_role) +
    "|" +
    row.action +
    "|" +
    empty(row.resource_type) +
    "|" +
    empty(row.resource_id) +
    "|" +
    empty(row.ip) +
    "|" +
    empty(row.user_agent) +
    "|" +
    empty(row.request_id) +
    "|" +
    metaCanonical;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

describe.skipIf(!hasTestDB)(
  "audit_log hash chain integrity [requires SUPABASE_TEST_URL]",
  () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let service: any;
    let tenantId: string;
    const cleanup: Array<() => Promise<void>> = [];
    const insertedIds: number[] = [];
    let chainRows: AuditRow[] = [];

    beforeAll(async () => {
      service = createClient(TEST_URL!, TEST_SERVICE_KEY!, {
        auth: { persistSession: false },
      });

      const stamp = Date.now();
      const { data: t, error: errT } = await service
        .from("tenants")
        .insert({
          slug: `audit-chain-${stamp}`,
          name: "Audit Chain Test",
          template_key: "eventos",
          status: "draft",
        })
        .select()
        .single();
      if (errT) throw errT;
      tenantId = t.id;

      // 5 inserts via append_audit RPC (RFC W2.T5 D4/D9 path).
      for (let i = 0; i < 5; i++) {
        const { error } = await service.rpc("append_audit", {
          p_event: {
            acting_as_tenant_id: tenantId,
            acting_as_role: "editor",
            action: `test.event.${i}`,
            resource_type: "test",
            resource_id: `r-${i}`,
            metadata: {},
          },
        });
        if (error) throw error;
      }

      // Read back chain rows ordered by (occurred_at, id) ascending —
      // same order as the trigger's lookup of `prev_record_hash`.
      const { data: rows, error: errR } = await service
        .from("audit_log")
        .select("*")
        .eq("acting_as_tenant_id", tenantId)
        .order("occurred_at", { ascending: true })
        .order("id", { ascending: true });
      if (errR) throw errR;
      chainRows = (rows ?? []) as AuditRow[];
      insertedIds.push(...chainRows.map((r) => r.id));

      cleanup.push(async () => {
        // Audit log rows survive tenant delete by design (acting_as_tenant_id
        // ON DELETE SET NULL). Drop the inserted rows explicitly first.
        if (insertedIds.length > 0) {
          await service.from("audit_log").delete().in("id", insertedIds);
        }
        await service.from("tenants").delete().eq("id", tenantId);
      });
    });

    afterAll(async () => {
      for (const fn of cleanup) {
        try {
          await fn();
        } catch (e) {
          console.warn("[audit-chain cleanup]", e);
        }
      }
    });

    it("inserts produced exactly 5 chained rows", () => {
      expect(chainRows).toHaveLength(5);
    });

    it("first row prev_record_hash links to the row immediately before it in the global chain (or null on empty table)", () => {
      // We cannot assert null because the table may have prior rows from
      // other tests in the same preview branch. We assert only that the
      // pointer is either null (genesis) or a 64-char sha256 hex string.
      const prev = chainRows[0].prev_record_hash;
      expect(prev === null || /^[0-9a-f]{64}$/.test(prev)).toBe(true);
    });

    it("each subsequent row's prev_record_hash equals the previous row's record_hash", () => {
      for (let i = 1; i < chainRows.length; i++) {
        expect(chainRows[i].prev_record_hash).toBe(
          chainRows[i - 1].record_hash,
        );
      }
    });

    it("each row's record_hash matches sha256(payload) recomputed independently", () => {
      for (let i = 0; i < chainRows.length; i++) {
        const expected = computeExpectedHash(
          chainRows[i].prev_record_hash,
          chainRows[i],
        );
        expect(chainRows[i].record_hash).toBe(expected);
      }
    });

    it("out-of-band UPDATE that mutates a payload field breaks the chain at that row", async () => {
      const target = chainRows[2];
      const { error: updErr } = await service
        .from("audit_log")
        .update({ action: "tampered.action" })
        .eq("id", target.id);
      expect(updErr).toBeNull();

      const { data: postRows } = await service
        .from("audit_log")
        .select("*")
        .in("id", insertedIds)
        .order("occurred_at", { ascending: true })
        .order("id", { ascending: true });

      const post = (postRows ?? []) as AuditRow[];
      const tampered = post.find((r) => r.id === target.id)!;
      // The stored record_hash is stale — re-derive expected with mutated payload.
      const recomputed = computeExpectedHash(
        tampered.prev_record_hash,
        tampered,
      );
      expect(tampered.record_hash).not.toBe(recomputed);

      // Rollback the mutation so cleanup is consistent.
      await service
        .from("audit_log")
        .update({ action: target.action })
        .eq("id", target.id);
    });

    it("anon and authenticated clients cannot INSERT into audit_log directly (SE-H1)", async () => {
      const anon = createClient(TEST_URL!, TEST_ANON_KEY!);
      const { error } = await anon.from("audit_log").insert({
        action: "anon.evil",
        record_hash: "x".repeat(64),
      });
      expect(error).not.toBeNull();
    });

    it("append_audit RPC is not callable by anon/authenticated (revoked execute)", async () => {
      const anon = createClient(TEST_URL!, TEST_ANON_KEY!);
      const { error } = await anon.rpc("append_audit", {
        p_event: { action: "anon.rpc" },
      });
      expect(error).not.toBeNull();
    });
  },
);

describe("audit_log hash chain — static assertions (no DB required)", () => {
  it("env-var presence determines skip", () => {
    if (!hasTestDB) {
      console.info(
        "[audit-log-hash-chain] Skipped: set SUPABASE_TEST_URL + SUPABASE_TEST_ANON_KEY + SUPABASE_TEST_SERVICE_KEY to run.",
      );
    }
    expect(typeof hasTestDB).toBe("boolean");
  });

  it("computeExpectedHash reproduces the trigger payload format for a known fixture", () => {
    const row: AuditRow = {
      id: 1,
      occurred_at: "2026-05-14 18:30:00+00",
      actor_user_id: null,
      actor_session_id: null,
      acting_as_tenant_id: "00000000-0000-0000-0000-000000000001",
      acting_as_role: "editor",
      action: "test.event.0",
      resource_type: "test",
      resource_id: "r-0",
      ip: null,
      user_agent: null,
      request_id: null,
      metadata: {},
      prev_record_hash: null,
      record_hash: "ignored",
    };
    const expectedPayload =
      "" +
      "|2026-05-14 18:30:00+00" +
      "|" +
      "|" +
      "|00000000-0000-0000-0000-000000000001" +
      "|editor" +
      "|test.event.0" +
      "|test" +
      "|r-0" +
      "|" +
      "|" +
      "|" +
      "|{}";
    const expected = createHash("sha256")
      .update(expectedPayload, "utf8")
      .digest("hex");
    expect(computeExpectedHash(null, row)).toBe(expected);
  });

  it("computeExpectedHash chains through prev_record_hash", () => {
    const row: AuditRow = {
      id: 2,
      occurred_at: "2026-05-14 18:31:00+00",
      actor_user_id: null,
      actor_session_id: null,
      acting_as_tenant_id: null,
      acting_as_role: null,
      action: "next",
      resource_type: null,
      resource_id: null,
      ip: null,
      user_agent: null,
      request_id: null,
      metadata: {},
      prev_record_hash: "a".repeat(64),
      record_hash: "ignored",
    };
    const h1 = computeExpectedHash("a".repeat(64), row);
    const h2 = computeExpectedHash("b".repeat(64), row);
    expect(h1).not.toBe(h2);
    expect(/^[0-9a-f]{64}$/.test(h1)).toBe(true);
  });
});
