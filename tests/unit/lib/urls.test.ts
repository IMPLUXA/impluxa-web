import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";

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

describe("siteHostLabel — tenant-aware (FIX 1a s53: custom_domain ?? slug+sufijo)", () => {
  // El gate byte-id EN VIVO (login curl + canary 9364a04c) cubre la superficie
  // LOGIN + el render PÚBLICO de Hakuna. Pero el sidebar-admin y la leads-view
  // del dashboard (Hakuna SÍ los renderiza, tras auth = NO medibles en vivo)
  // llaman siteHostLabel: este caso-null es la prueba byte-a-byte de que esos
  // call sites de Hakuna quedan delta-0 (sin custom_domain → slug+sufijo EXACTO,
  // igual que antes del fix). "delta-0 por construcción" pasa de razonamiento a
  // test que pasa.
  it("SIN custom_domain (path Hakuna / tenant sin dominio) → slug+sufijo EXACTO = delta-0", () => {
    expect(siteHostLabel("hakunamatata")).toBe("hakunamatata.impluxa.com");
    expect(siteHostLabel("hakunamatata", null)).toBe(
      "hakunamatata.impluxa.com",
    );
    expect(siteHostLabel("hakunamatata", undefined)).toBe(
      "hakunamatata.impluxa.com",
    );
  });

  it("CON custom_domain → el dominio custom canónico (path PV)", () => {
    expect(siteHostLabel("patagoniaviva", "patagoniaviva.ar")).toBe(
      "patagoniaviva.ar",
    );
    // con custom_domain el slug es irrelevante: gana el dominio canónico
    expect(siteHostLabel("otroslug", "midominio.com")).toBe("midominio.com");
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

describe("ADMIN-AR C2 — dominios custom mapeados (gateados por PV_AR_ADMIN)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it(".ar con flag OFF → null: dormido = comportamiento de hoy (stub '' = determinístico ante shells con la env exportada, nit cold C2)", () => {
    vi.stubEnv("PV_AR_ADMIN", "");
    expect(tenantSlugFromHostValue("patagoniaviva.ar")).toBeNull();
  });

  it(".ar con flag ON → slug del mapa literal", () => {
    vi.stubEnv("PV_AR_ADMIN", "on");
    expect(tenantSlugFromHostValue("patagoniaviva.ar")).toBe("patagoniaviva");
  });

  it(".ar con flag ON: mayúsculas se normalizan", () => {
    vi.stubEnv("PV_AR_ADMIN", "on");
    expect(tenantSlugFromHostValue("PATAGONIAVIVA.AR")).toBe("patagoniaviva");
  });

  it("flag con valor distinto de 'on' → null (paridad estricta con middleware)", () => {
    vi.stubEnv("PV_AR_ADMIN", "true");
    expect(tenantSlugFromHostValue("patagoniaviva.ar")).toBeNull();
  });

  it("host con puerto NO matchea la key del mapa → null (sin strip, parity)", () => {
    vi.stubEnv("PV_AR_ADMIN", "on");
    expect(tenantSlugFromHostValue("patagoniaviva.ar:443")).toBeNull();
  });

  it("Host tipo __proto__/constructor no resuelve heredados (hasOwn, fold C1)", () => {
    vi.stubEnv("PV_AR_ADMIN", "on");
    expect(tenantSlugFromHostValue("__proto__")).toBeNull();
    expect(tenantSlugFromHostValue("constructor")).toBeNull();
  });

  it("subdominios .impluxa.com intactos con flag ON (Hakuna byte-idéntica)", () => {
    vi.stubEnv("PV_AR_ADMIN", "on");
    expect(tenantSlugFromHostValue("hakunamatata.impluxa.com")).toBe(
      "hakunamatata",
    );
    expect(tenantSlugFromHostValue("app.impluxa.com")).toBeNull();
  });

  it("getAdminBasePath: .ar con flag OFF → '' ; con flag ON → /admin", async () => {
    mockHost("patagoniaviva.ar");
    expect(await getAdminBasePath()).toBe("");
    vi.stubEnv("PV_AR_ADMIN", "on");
    expect(await getAdminBasePath()).toBe("/admin");
  });

  it("getAdminBasePath: hosts actuales intactos con flag ON", async () => {
    vi.stubEnv("PV_AR_ADMIN", "on");
    mockHost("app.impluxa.com");
    expect(await getAdminBasePath()).toBe("");
    mockHost("patagoniaviva.impluxa.com");
    expect(await getAdminBasePath()).toBe("/admin");
    mockHost("evil.com");
    expect(await getAdminBasePath()).toBe("");
  });

  it("wrapper async con .ar y flag ON → slug (el path exacto que consume login/page.tsx, nit cold C2)", async () => {
    vi.stubEnv("PV_AR_ADMIN", "on");
    mockHost("patagoniaviva.ar");
    expect(await tenantSlugFromHost()).toBe("patagoniaviva");
  });

  it("host vacío/null con flag ON → null (boundary, informational SE C2)", () => {
    vi.stubEnv("PV_AR_ADMIN", "on");
    expect(tenantSlugFromHostValue("")).toBeNull();
    expect(tenantSlugFromHostValue(null)).toBeNull();
  });
});
