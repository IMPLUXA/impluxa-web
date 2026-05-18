// @vitest-environment node
/**
 * RLS Claim-Based Isolation Tests (W4.T4, FR-AUTH-5).
 *
 * Validates that the v2 RESTRICTIVE shadow policies introduced by
 * migration `20260514_v025_004_rls_claim_based_v2.sql` correctly enforce
 * claim-based tenant scoping for users with multi-tenant membership.
 *
 * Threat mitigated: T-v025-02 (RLS confused deputy multi-membership).
 *
 * Requires (env vars):
 *   SUPABASE_TEST_URL         — preview-branch URL
 *   SUPABASE_TEST_ANON_KEY    — anon key of preview branch
 *   SUPABASE_TEST_SERVICE_KEY — service-role key (seed only)
 *   SUPABASE_TEST_JWT_SECRET  — HS256 JWT secret of the preview project
 *
 * Skipped when any of the above is missing. Always runs a static sanity
 * block so the file never fully no-ops in CI.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";

const TEST_URL = process.env.SUPABASE_TEST_URL;
const TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY;
const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;
const TEST_JWT_SECRET = process.env.SUPABASE_TEST_JWT_SECRET;

const hasTestDB = Boolean(
  TEST_URL && TEST_ANON_KEY && TEST_SERVICE_KEY && TEST_JWT_SECRET,
);

async function craftAccessToken(
  userId: string,
  activeTenantId: string | null,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    sub: userId,
    aud: "authenticated",
    role: "authenticated",
    iat: now,
    exp: now + 60 * 60,
    iss: "supabase",
  };
  if (activeTenantId !== null) payload.active_tenant_id = activeTenantId;
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(new TextEncoder().encode(secret));
}

function clientWithToken(jwt: string): SupabaseClient {
  return createClient(TEST_URL!, TEST_ANON_KEY!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

describe.skipIf(!hasTestDB)(
  "RLS claim-based isolation [requires SUPABASE_TEST_URL + JWT_SECRET]",
  () => {
    // Service-role client typed as `any` to avoid importing generated Database
    // types just for this integration suite (mirrors `rls-isolation.test.ts`).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let service: any;

    let tenantAId: string;
    let tenantBId: string;
    let editorUserId: string; // member of BOTH tenants
    let outsiderUserId: string; // member of NEITHER

    const cleanup: Array<() => Promise<void>> = [];

    beforeAll(async () => {
      service = createClient(TEST_URL!, TEST_SERVICE_KEY!, {
        auth: { persistSession: false },
      });

      const stamp = Date.now();

      const { data: tA, error: errA } = await service
        .from("tenants")
        .insert({
          slug: `rls-claim-a-${stamp}`,
          name: "RLS Claim A",
          template_key: "eventos",
          status: "draft",
        })
        .select()
        .single();
      if (errA) throw errA;
      tenantAId = tA.id;

      const { data: tB, error: errB } = await service
        .from("tenants")
        .insert({
          slug: `rls-claim-b-${stamp}`,
          name: "RLS Claim B",
          template_key: "eventos",
          status: "draft",
        })
        .select()
        .single();
      if (errB) throw errB;
      tenantBId = tB.id;

      // sites.tenant_id is PK → one row per tenant
      const { error: sitesErr } = await service.from("sites").insert([
        { tenant_id: tenantAId, content_json: { name: "site-A" } },
        { tenant_id: tenantBId, content_json: { name: "site-B" } },
      ]);
      if (sitesErr) throw sitesErr;

      const { error: leadsErr } = await service.from("leads_tenant").insert([
        { tenant_id: tenantAId, name: "lead-A", email: "a@example.test" },
        { tenant_id: tenantBId, name: "lead-B", email: "b@example.test" },
      ]);
      if (leadsErr) throw leadsErr;

      const { data: ed, error: errEd } = await service.auth.admin.createUser({
        email: `rls-editor-${stamp}@example.test`,
        password: `pw-${stamp}!Aa1`,
        email_confirm: true,
      });
      if (errEd) throw errEd;
      editorUserId = ed.user.id;

      const { data: out, error: errOut } = await service.auth.admin.createUser({
        email: `rls-outsider-${stamp}@example.test`,
        password: `pw-${stamp}!Aa1`,
        email_confirm: true,
      });
      if (errOut) throw errOut;
      outsiderUserId = out.user.id;

      // Editor is member of BOTH tenants — multi-tenant scenario =
      // confused-deputy risk that v2 RESTRICTIVE policies must mitigate.
      const { error: memErr } = await service.from("tenant_members").insert([
        { tenant_id: tenantAId, user_id: editorUserId, role: "editor" },
        { tenant_id: tenantBId, user_id: editorUserId, role: "editor" },
      ]);
      if (memErr) throw memErr;

      // ON DELETE CASCADE from tenants drops members, sites, leads.
      cleanup.push(async () => {
        await service.auth.admin.deleteUser(editorUserId);
        await service.auth.admin.deleteUser(outsiderUserId);
        await service.from("tenants").delete().in("id", [tenantAId, tenantBId]);
      });
    });

    afterAll(async () => {
      for (const fn of cleanup) {
        try {
          await fn();
        } catch (e) {
          console.warn("[rls-claim-isolation cleanup]", e);
        }
      }
    });

    it("editor JWT claim=A reads sites for A but NOT B", async () => {
      const jwt = await craftAccessToken(
        editorUserId,
        tenantAId,
        TEST_JWT_SECRET!,
      );
      const c = clientWithToken(jwt);

      const { data: aRows, error: aErr } = await c
        .from("sites")
        .select("tenant_id")
        .eq("tenant_id", tenantAId);
      expect(aErr).toBeNull();
      expect(
        (aRows ?? []).map((r: { tenant_id: string }) => r.tenant_id),
      ).toContain(tenantAId);

      const { data: bRows, error: bErr } = await c
        .from("sites")
        .select("tenant_id")
        .eq("tenant_id", tenantBId);
      expect(bErr).toBeNull();
      expect(bRows ?? []).toHaveLength(0);
    });

    it("editor JWT claim=A reads leads_tenant for A but NOT B (confused deputy mitigated)", async () => {
      const jwt = await craftAccessToken(
        editorUserId,
        tenantAId,
        TEST_JWT_SECRET!,
      );
      const c = clientWithToken(jwt);

      const { data: aRows } = await c
        .from("leads_tenant")
        .select("tenant_id")
        .eq("tenant_id", tenantAId);
      expect(
        (aRows ?? []).map((r: { tenant_id: string }) => r.tenant_id),
      ).toContain(tenantAId);

      const { data: bRows } = await c
        .from("leads_tenant")
        .select("tenant_id")
        .eq("tenant_id", tenantBId);
      expect(bRows ?? []).toHaveLength(0);
    });

    it("editor JWT claim=A cannot UPSERT into tenant B sites", async () => {
      const jwt = await craftAccessToken(
        editorUserId,
        tenantAId,
        TEST_JWT_SECRET!,
      );
      const c = clientWithToken(jwt);

      const { error } = await c
        .from("sites")
        .upsert({ tenant_id: tenantBId, content_json: { hacked: true } });
      expect(error).not.toBeNull();
    });

    it("editor JWT claim=A cannot UPDATE tenant B sites (RLS filters target)", async () => {
      const jwt = await craftAccessToken(
        editorUserId,
        tenantAId,
        TEST_JWT_SECRET!,
      );
      const c = clientWithToken(jwt);

      const { data, error } = await c
        .from("sites")
        .update({ content_json: { tampered: true } })
        .eq("tenant_id", tenantBId)
        .select();
      // Acceptable either as PG error or as empty result set (policy filters target).
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    });

    it("editor JWT WITHOUT active_tenant_id claim sees nothing (RESTRICTIVE fail-closed)", async () => {
      const jwt = await craftAccessToken(editorUserId, null, TEST_JWT_SECRET!);
      const c = clientWithToken(jwt);

      const { data, error } = await c.from("sites").select("tenant_id");
      expect(error).toBeNull();
      // Editor is member of both tenants but no active claim → v2 denies.
      // Both seed tenants are status='draft' so public-read branch is empty.
      expect(data ?? []).toHaveLength(0);
    });

    it("non-member with forged claim=A cannot read tenant A (membership check enforced)", async () => {
      const jwt = await craftAccessToken(
        outsiderUserId,
        tenantAId,
        TEST_JWT_SECRET!,
      );
      const c = clientWithToken(jwt);

      const { data, error } = await c
        .from("sites")
        .select("tenant_id")
        .eq("tenant_id", tenantAId);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("service-role sees BOTH seed tenants (sanity bypass check)", async () => {
      const { data } = await service
        .from("sites")
        .select("tenant_id")
        .in("tenant_id", [tenantAId, tenantBId]);
      expect(
        (data ?? []).map((r: { tenant_id: string }) => r.tenant_id).sort(),
      ).toEqual([tenantAId, tenantBId].sort());
    });
  },
);

describe("RLS claim-based isolation — static assertions (no DB required)", () => {
  it("env-var presence determines skip", () => {
    if (!hasTestDB) {
      console.info(
        "[rls-claim-isolation] Skipped: set SUPABASE_TEST_URL + SUPABASE_TEST_ANON_KEY + SUPABASE_TEST_SERVICE_KEY + SUPABASE_TEST_JWT_SECRET to run.",
      );
    }
    expect(typeof hasTestDB).toBe("boolean");
  });

  it("craftAccessToken produces well-formed HS256 JWT with active_tenant_id claim", async () => {
    const jwt = await craftAccessToken(
      "00000000-0000-0000-0000-000000000000",
      "11111111-1111-1111-1111-111111111111",
      "test-secret-not-real-min-32-bytes-padding-padding",
    );
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    expect(payload.sub).toBe("00000000-0000-0000-0000-000000000000");
    expect(payload.active_tenant_id).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
    expect(payload.role).toBe("authenticated");
    expect(payload.aud).toBe("authenticated");
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("craftAccessToken omits active_tenant_id when null", async () => {
    const jwt = await craftAccessToken(
      "00000000-0000-0000-0000-000000000000",
      null,
      "test-secret-not-real-min-32-bytes-padding-padding",
    );
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"),
    );
    expect(payload).not.toHaveProperty("active_tenant_id");
    expect(payload.sub).toBe("00000000-0000-0000-0000-000000000000");
  });
});
