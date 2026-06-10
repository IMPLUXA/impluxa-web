// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { refreshSessionMock } = vi.hoisted(() => ({
  refreshSessionMock: vi.fn(),
}));

// B-Fase2: el componente ya no usa useRouter — navega con
// window.location.assign (cross-host). jsdom no implementa navegación real:
// se stubbea assign y se asserta el destino.
const locationAssignMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { refreshSession: refreshSessionMock },
  }),
}));

import {
  TenantSwitcherClient,
  type TenantOption,
} from "@/components/TenantSwitcherClient";

const TENANT_A: TenantOption = {
  id: "b1d3e5f7-9a2c-4e6b-8d0f-1a3c5e7f9b1d",
  slug: "rls-claim-a",
  name: "RLS Claim A",
  role: "owner",
  status: "published",
};
const TENANT_B: TenantOption = {
  id: "c2e4f6a8-b0d2-4f4e-9c1a-2b4d6f8a0c2e",
  slug: "rls-claim-b",
  name: "RLS Claim B",
  role: "editor",
  status: "draft",
};

beforeEach(() => {
  refreshSessionMock.mockReset().mockResolvedValue({});
  locationAssignMock.mockReset();
  Object.defineProperty(window, "location", {
    value: { ...window.location, assign: locationAssignMock },
    writable: true,
    configurable: true,
  });
  global.fetch = vi.fn();
});

describe("TenantSwitcherClient (W3.G5.T1 part 2)", () => {
  it("renders the active tenant in the trigger button", () => {
    render(
      <TenantSwitcherClient
        tenants={[TENANT_A, TENANT_B]}
        activeTenantId={TENANT_A.id}
      />,
    );
    expect(screen.getByTestId("tenant-switcher")).toBeTruthy();
    expect(screen.getByText("RLS Claim A")).toBeTruthy();
  });

  it("toggles the listbox open on click", () => {
    render(
      <TenantSwitcherClient
        tenants={[TENANT_A, TENANT_B]}
        activeTenantId={TENANT_A.id}
      />,
    );
    const trigger = screen.getByRole("button", { expanded: false });
    expect(screen.queryByTestId("tenant-switcher-list")).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByTestId("tenant-switcher-list")).toBeTruthy();
    expect(screen.getByTestId(`tenant-option-${TENANT_A.slug}`)).toBeTruthy();
    expect(screen.getByTestId(`tenant-option-${TENANT_B.slug}`)).toBeTruthy();
  });

  it("clicking the already-active tenant does NOT trigger fetch", async () => {
    render(
      <TenantSwitcherClient
        tenants={[TENANT_A, TENANT_B]}
        activeTenantId={TENANT_A.id}
      />,
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByTestId(`tenant-option-${TENANT_A.slug}`));
    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  it("clicking a different tenant POSTs /api/tenant/switch + refreshSession + location.assign cross-host", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        redirectTo: "https://rls-claim-b.impluxa.com/admin/dashboard",
      }),
    });

    render(
      <TenantSwitcherClient
        tenants={[TENANT_A, TENANT_B]}
        activeTenantId={TENANT_A.id}
      />,
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByTestId(`tenant-option-${TENANT_B.slug}`));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledOnce();
    });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe("/api/tenant/switch");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ tenant_id: TENANT_B.id });

    await waitFor(() => {
      expect(refreshSessionMock).toHaveBeenCalledOnce();
    });
    // B-Fase2: navegación full cross-host al admin branded del tenant.
    expect(locationAssignMock).toHaveBeenCalledWith(
      "https://rls-claim-b.impluxa.com/admin/dashboard",
    );
  });

  it("displays inline error when /api/tenant/switch returns non-OK", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "forbidden" }),
    });

    render(
      <TenantSwitcherClient
        tenants={[TENANT_A, TENANT_B]}
        activeTenantId={TENANT_A.id}
      />,
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByTestId(`tenant-option-${TENANT_B.slug}`));

    await waitFor(() => {
      expect(screen.getByTestId("tenant-switcher-error")).toBeTruthy();
    });
    expect(screen.getByTestId("tenant-switcher-error").textContent).toContain(
      "forbidden",
    );
    expect(refreshSessionMock).not.toHaveBeenCalled();
    expect(locationAssignMock).not.toHaveBeenCalled();
  });

  it("displays inline error when fetch throws (network failure)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("ECONNRESET"),
    );

    render(
      <TenantSwitcherClient
        tenants={[TENANT_A, TENANT_B]}
        activeTenantId={TENANT_A.id}
      />,
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByTestId(`tenant-option-${TENANT_B.slug}`));

    await waitFor(() => {
      expect(screen.getByTestId("tenant-switcher-error").textContent).toContain(
        "ECONNRESET",
      );
    });
  });

  it("marks the active tenant with aria-selected=true", () => {
    render(
      <TenantSwitcherClient
        tenants={[TENANT_A, TENANT_B]}
        activeTenantId={TENANT_B.id}
      />,
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    const activeOption = screen.getByTestId(`tenant-option-${TENANT_B.slug}`);
    expect(activeOption.getAttribute("aria-selected")).toBe("true");
    const otherOption = screen.getByTestId(`tenant-option-${TENANT_A.slug}`);
    expect(otherOption.getAttribute("aria-selected")).toBe("false");
  });
});
