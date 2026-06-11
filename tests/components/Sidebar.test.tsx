// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));
// Sidebar importa isAgencyOwner de @/lib/agency/role, que a nivel módulo
// importa el cliente server de Supabase y next/navigation. En jsdom no se
// invocan (isAgencyOwner es pura), pero los imports deben no romper.
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn() }));

import { Sidebar } from "@/components/app/Sidebar";
import type { Tenant } from "@/lib/tenants/types";
import type { TenantBranding } from "@/lib/tenants/login-branding";

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

const OWNER_ITEMS = [
  "Finanzas",
  "Módulos",
  "Tu cuenta Impluxa",
  "Plan y facturación",
];

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

describe("Sidebar branded — operativo (todos los roles)", () => {
  it("siempre muestra operativo + Consultas pronto + logo/wordmark", () => {
    render(
      <Sidebar
        tenant={TENANT}
        user={null}
        basePath="/admin"
        branding={BRANDING}
        role="vendedor"
      />,
    );
    // operativo vivo aparece en desktop nav Y en bottom-nav móvil → getAllByText
    for (const item of [
      "Inicio",
      "Excursiones",
      "Tarifas",
      "Proveedores",
      "Contenido",
    ]) {
      expect(screen.getAllByText(item).length).toBeGreaterThanOrEqual(1);
    }
    expect(screen.getByText("Consultas")).toBeTruthy(); // soon → solo desktop
    expect(screen.getByText("Ver sitio")).toBeTruthy();
    const logo = screen.getByAltText("Patagonia Viva") as HTMLImageElement;
    expect(logo.src).toContain("logo-full-dark.png");
    expect(screen.getByText("IMPLUXA")).toBeTruthy();
  });

  it("los links branded llevan el basePath /admin", () => {
    render(
      <Sidebar
        tenant={TENANT}
        user={null}
        basePath="/admin"
        branding={BRANDING}
        role="dueno_admin"
      />,
    );
    const inicio = screen.getAllByText("Inicio")[0]!.closest("a");
    expect(inicio?.getAttribute("href")).toBe("/admin/dashboard");
  });
});

describe("Sidebar branded — MATRIZ DE ROLES (corte 3)", () => {
  it("DUEÑO ve Finanzas + Módulos + Tu cuenta Impluxa + Plan y facturación", () => {
    render(
      <Sidebar
        tenant={TENANT}
        user={null}
        basePath="/admin"
        branding={BRANDING}
        role="dueno_admin"
      />,
    );
    for (const item of OWNER_ITEMS) {
      expect(screen.getByText(item)).toBeTruthy();
    }
    // Finanzas Y Módulos son rutas reales con basePath y llevan la marca
    const finanzas = screen.getByText("Finanzas").closest("a");
    expect(finanzas?.getAttribute("href")).toBe("/admin/finanzas");
    const modulos = screen.getByText("Módulos").closest("a");
    expect(modulos?.getAttribute("href")).toBe("/admin/modulos"); // C4: link real
    expect(screen.getAllByText("solo dueño").length).toBe(2);
    // C4: el dueño tiene el 6º slot "Más" del bottom-nav móvil
    expect(screen.getByText("Más")).toBeTruthy();
  });

  it("VENDEDOR no ve NINGÚN item dueño-only", () => {
    render(
      <Sidebar
        tenant={TENANT}
        user={null}
        basePath="/admin"
        branding={BRANDING}
        role="vendedor"
      />,
    );
    for (const item of OWNER_ITEMS) {
      expect(screen.queryByText(item)).toBeNull();
    }
    expect(screen.queryByText("solo dueño")).toBeNull();
    // C4: el no-dueño NO recibe el slot "Más" (ni el botón ni el sheet)
    expect(screen.queryByText("Más")).toBeNull();
  });

  it("ENCARGADO no ve NINGÚN item dueño-only", () => {
    render(
      <Sidebar
        tenant={TENANT}
        user={null}
        basePath="/admin"
        branding={BRANDING}
        role="encargado"
      />,
    );
    for (const item of OWNER_ITEMS) {
      expect(screen.queryByText(item)).toBeNull();
    }
  });

  it("SIN rol (null / fail-closed) ve el panel MÍNIMO, no el de dueño", () => {
    // default: sin prop role → null → mismo resultado que un no-dueño
    render(
      <Sidebar
        tenant={TENANT}
        user={null}
        basePath="/admin"
        branding={BRANDING}
      />,
    );
    for (const item of OWNER_ITEMS) {
      expect(screen.queryByText(item)).toBeNull();
    }
  });
});
