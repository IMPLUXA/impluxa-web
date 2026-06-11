// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));

import { Sidebar } from "@/components/app/Sidebar";
import type { Tenant } from "@/lib/tenants/types";
import type { TenantBranding } from "@/lib/tenants/login-branding";

// F-UI-BRANDED corte 2 — regresión de la promesa del plan: SIN branding el
// Sidebar renderiza el shell genérico previo (/app no cambia); CON branding
// renderiza el nav v2.1-lite del mockup congelado (sin items dueño-only, que
// llegan en corte 3/4 con la matriz de roles).

const TENANT = {
  id: "t1",
  slug: "patagoniaviva",
  name: "Patagonia Viva",
  template_key: "turismo",
  custom_domain: null,
  status: "published",
} as unknown as Tenant;

const BRANDING: TenantBranding = {
  tenantName: "Patagonia Viva",
  hostLabel: "patagoniaviva.impluxa.com",
  colors: {
    primary: "#143038",
    secondary: "#3E7C95",
    accent: "#B48448",
    background: "#F4EDDC",
    text: "#1E2B2C",
  },
  logoDarkUrl: "https://example.supabase.co/logo-full-dark.png",
  logoLightUrl: null,
  faviconUrl: null,
  fonts: { heading: "Cinzel", body: "Hanken Grotesk" },
};

describe("Sidebar genérico (sin branding) — /app intacto", () => {
  it("conserva el shell previo: wordmark, capas, stubs y SIN items v2.1", () => {
    render(<Sidebar tenant={TENANT} user={null} />);
    expect(screen.getByText("IMPLUXA")).toBeTruthy();
    expect(screen.getByText("Tu cuenta Impluxa")).toBeTruthy(); // capa SaaS visible
    expect(screen.getByText("Plan y facturación")).toBeTruthy();
    expect(screen.getByText("Leads")).toBeTruthy(); // label viejo intacto
    expect(screen.getByText("Diseño")).toBeTruthy(); // stubs sueltos intactos
    expect(screen.queryByText("Consultas")).toBeNull(); // rename NO llega a /app
    expect(screen.getByText("Ver sitio ↗")).toBeTruthy();
  });
});

describe("Sidebar branded (mockup v2.1, alcance corte 2)", () => {
  it("nav v2.1-lite: Consultas pronto, sin dueño-only, logo + wordmark discreto", () => {
    render(
      <Sidebar
        tenant={TENANT}
        user={null}
        basePath="/admin"
        branding={BRANDING}
      />,
    );
    expect(screen.getByText("Consultas")).toBeTruthy();
    expect(screen.getAllByText("pronto").length).toBeGreaterThan(0);
    expect(screen.queryByText("Leads")).toBeNull();
    expect(screen.queryByText("Diseño")).toBeNull(); // se va a Módulos (corte 4)
    expect(screen.queryByText("Finanzas")).toBeNull(); // corte 3 (roles)
    expect(screen.queryByText("Módulos")).toBeNull(); // corte 3/4
    expect(screen.queryByText("Tu cuenta Impluxa")).toBeNull(); // dueño-only, corte 3
    const logo = screen.getByAltText("Patagonia Viva") as HTMLImageElement;
    expect(logo.src).toContain("logo-full-dark.png");
    expect(screen.getByText("IMPLUXA")).toBeTruthy(); // marca discreta
    expect(screen.getByText("patagoniaviva.impluxa.com")).toBeTruthy();
  });

  it("los links branded llevan el basePath /admin", () => {
    render(
      <Sidebar
        tenant={TENANT}
        user={null}
        basePath="/admin"
        branding={BRANDING}
      />,
    );
    const inicio = screen.getAllByText("Inicio")[0]!.closest("a");
    expect(inicio?.getAttribute("href")).toBe("/admin/dashboard");
  });
});
