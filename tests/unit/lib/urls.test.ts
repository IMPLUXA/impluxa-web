import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

import { headers } from "next/headers";
import {
  siteUrl,
  siteHostLabel,
  TENANT_SLUG_RE,
  getAdminBasePath,
  tenantSlugFromHostValue,
  tenantSlugFromHost,
} from "@/lib/urls";

// B-Fase2 — helpers de URL por-tenant. El regex de slug es la defensa C3
// (un slug fuera de charset no puede denotar otro origin en URLs absolutas).

function mockHost(host: string | null) {
  vi.mocked(headers).mockResolvedValue({
    get: (k: string) => (k.toLowerCase() === "host" ? host : null),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

beforeEach(() => {
  vi.mocked(headers).mockReset();
});

describe("siteUrl / siteHostLabel", () => {
  it("construye la URL pública del tenant", () => {
    expect(siteUrl("patagoniaviva")).toBe("https://patagoniaviva.impluxa.com");
    expect(siteHostLabel("hakunamatata")).toBe("hakunamatata.impluxa.com");
  });
});

describe("TENANT_SLUG_RE (defensa C3 para URLs absolutas)", () => {
  it("acepta slugs reales", () => {
    expect(TENANT_SLUG_RE.test("patagoniaviva")).toBe(true);
    expect(TENANT_SLUG_RE.test("hakunamatata")).toBe(true);
    expect(TENANT_SLUG_RE.test("a-b-c-1")).toBe(true);
  });

  it("rechaza todo lo que podría denotar otro origin o romper la URL", () => {
    expect(TENANT_SLUG_RE.test("evil.com")).toBe(false); // punto
    expect(TENANT_SLUG_RE.test("a/b")).toBe(false); // slash
    expect(TENANT_SLUG_RE.test("a:b")).toBe(false); // colon
    expect(TENANT_SLUG_RE.test("a@b")).toBe(false); // at
    expect(TENANT_SLUG_RE.test("UPPER")).toBe(false); // mayúsculas
    expect(TENANT_SLUG_RE.test("-lead")).toBe(false); // guion inicial
    expect(TENANT_SLUG_RE.test("trail-")).toBe(false); // guion final
    expect(TENANT_SLUG_RE.test("ab")).toBe(false); // mínimo 3 chars
    expect(TENANT_SLUG_RE.test("")).toBe(false);
  });
});

describe("getAdminBasePath (display/nav-only, derivado del Host)", () => {
  it("app host → árbol /app, sin prefijo", async () => {
    mockHost("app.impluxa.com");
    expect(await getAdminBasePath()).toBe("");
  });

  it("host de tenant → /admin (href externo, el middleware rewritea)", async () => {
    mockHost("patagoniaviva.impluxa.com");
    expect(await getAdminBasePath()).toBe("/admin");
  });

  it("hosts no-tenant (marketing/localhost/ajenos) → sin prefijo", async () => {
    mockHost("localhost:3000");
    expect(await getAdminBasePath()).toBe("");
    mockHost("evil.com");
    expect(await getAdminBasePath()).toBe("");
    mockHost(null);
    expect(await getAdminBasePath()).toBe("");
  });

  it("host con mayúsculas se normaliza", async () => {
    mockHost("PATAGONIAVIVA.IMPLUXA.COM");
    expect(await getAdminBasePath()).toBe("/admin");
  });
});

describe("tenantSlugFromHostValue (F-UI-BRANDED corte 1 — parity middleware)", () => {
  it("host de tenant → slug", () => {
    expect(tenantSlugFromHostValue("patagoniaviva.impluxa.com")).toBe(
      "patagoniaviva",
    );
    expect(tenantSlugFromHostValue("hakunamatata.impluxa.com")).toBe(
      "hakunamatata",
    );
  });

  it("mayúsculas se normalizan (parity middleware.ts:53)", () => {
    expect(tenantSlugFromHostValue("PATAGONIAVIVA.IMPLUXA.COM")).toBe(
      "patagoniaviva",
    );
  });

  it("hosts de plataforma y www → null (sin query a DB)", () => {
    expect(tenantSlugFromHostValue("app.impluxa.com")).toBeNull();
    expect(tenantSlugFromHostValue("admin.impluxa.com")).toBeNull();
    expect(tenantSlugFromHostValue("auth.impluxa.com")).toBeNull();
    expect(tenantSlugFromHostValue("www.impluxa.com")).toBeNull();
  });

  it("hosts ajenos, vacíos o marketing → null", () => {
    expect(tenantSlugFromHostValue("impluxa.com")).toBeNull();
    expect(tenantSlugFromHostValue("evil.com")).toBeNull();
    expect(tenantSlugFromHostValue("")).toBeNull();
    expect(tenantSlugFromHostValue(null)).toBeNull();
  });

  it("host con puerto NO matchea el sufijo → null (mismo resultado que el middleware, que tampoco strippea puerto)", () => {
    expect(tenantSlugFromHostValue("patagoniaviva.impluxa.com:443")).toBeNull();
    expect(tenantSlugFromHostValue("localhost:3000")).toBeNull();
  });

  it("slug fuera de charset (C3) → null", () => {
    expect(tenantSlugFromHostValue("a.b.impluxa.com")).toBeNull(); // punto en slug
    expect(tenantSlugFromHostValue("-lead.impluxa.com")).toBeNull();
    expect(tenantSlugFromHostValue("ab.impluxa.com")).toBeNull(); // <3 chars
  });

  it("wrapper async lee el Host header", async () => {
    mockHost("patagoniaviva.impluxa.com");
    expect(await tenantSlugFromHost()).toBe("patagoniaviva");
    mockHost("app.impluxa.com");
    expect(await tenantSlugFromHost()).toBeNull();
  });
});
