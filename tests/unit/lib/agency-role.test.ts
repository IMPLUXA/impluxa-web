import { describe, expect, it, vi, beforeEach } from "vitest";

// F-UI-BRANDED corte 3 — la decisión dueño/no-dueño es la base de la matriz.
// isAgencyOwner es la función pura que el Sidebar (UI) y requireAgencyOwner
// (guard server) comparten. Las ramas FAIL-CLOSED de getAgencyRole se prueban
// acá con el RPC mockeado (Pass-2 CR: protege el narrowing del boundary — el
// rpc() es any); la autoridad real (RPC viva) se probó en el gate JWT-por-rol
// del preview branch (lesson service-role-da-falso-verde).

vi.mock("server-only", () => ({}));
const rpcMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({ rpc: rpcMock })),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { isAgencyOwner, getAgencyRole } from "@/lib/agency/role";

describe("isAgencyOwner", () => {
  it("SOLO dueno_admin es dueño", () => {
    expect(isAgencyOwner("dueno_admin")).toBe(true);
  });
  it("encargado y vendedor NO son dueño", () => {
    expect(isAgencyOwner("encargado")).toBe(false);
    expect(isAgencyOwner("vendedor")).toBe(false);
  });
  it("null (sin rol / error / fail-closed) NO es dueño", () => {
    expect(isAgencyOwner(null)).toBe(false);
  });
});

describe("getAgencyRole — ramas fail-closed (RPC mockeado)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    // React.cache memoiza por request; en vitest no hay request scope, pero
    // cada caso usa un mock distinto → el cache de React no aplica en jsdom
    // (cache() es passthrough fuera de RSC).
  });

  it("rol válido pasa el narrowing", async () => {
    rpcMock.mockResolvedValueOnce({ data: "dueno_admin", error: null });
    expect(await getAgencyRole()).toBe("dueno_admin");
  });
  it("error del RPC → null (fail-closed)", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
    expect(await getAgencyRole()).toBeNull();
  });
  it("valor fuera del enum → null (boundary tipado)", async () => {
    rpcMock.mockResolvedValueOnce({ data: "superadmin", error: null });
    expect(await getAgencyRole()).toBeNull();
  });
  it("throw → null (fail-closed)", async () => {
    rpcMock.mockRejectedValueOnce(new Error("network"));
    expect(await getAgencyRole()).toBeNull();
  });
});
