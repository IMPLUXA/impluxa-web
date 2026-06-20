import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MpConnectManager } from "@/app/app/pagos/MpConnectManager";

// Render del manager de conexión MP (UI-connect s57). Mockea next/navigation (router +
// searchParams). Cubre los dos estados (conectado/no) y el banner de resultado ?mp=.

const nav = vi.hoisted(() => ({
  refresh: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: nav.refresh }),
  useSearchParams: () => nav.params,
}));

describe("MpConnectManager", () => {
  beforeEach(() => {
    nav.params = new URLSearchParams();
    nav.refresh.mockClear();
  });
  afterEach(() => cleanup());

  it("no conectado → muestra el CTA Conectar", () => {
    render(<MpConnectManager state={{ connected: false }} />);
    expect(screen.getByText("Conectar MercadoPago")).toBeTruthy();
    expect(screen.getByText("No conectado")).toBeTruthy();
  });

  it("conectado → muestra cuenta + Desconectar + Cambiar cuenta", () => {
    render(
      <MpConnectManager
        state={{
          connected: true,
          mpUserId: "182102575",
          connectedAt: "2026-06-15T00:00:00Z",
        }}
      />,
    );
    expect(screen.getByText(/182102575/)).toBeTruthy();
    expect(screen.getByText("Desconectar")).toBeTruthy();
    expect(screen.getByText("Cambiar cuenta")).toBeTruthy();
  });

  it("?mp=connected → banner de éxito", () => {
    nav.params = new URLSearchParams("mp=connected");
    render(<MpConnectManager state={{ connected: true, mpUserId: "1" }} />);
    expect(screen.getByText(/conectada/i)).toBeTruthy();
  });

  it("?mp=error → banner de error", () => {
    nav.params = new URLSearchParams("mp=error");
    render(<MpConnectManager state={{ connected: false }} />);
    expect(screen.getByText(/no se pudo completar/i)).toBeTruthy();
  });
});
