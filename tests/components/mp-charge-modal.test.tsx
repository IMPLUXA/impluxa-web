import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { MpChargeModal } from "@/app/app/agency/reservas/MpChargeModal";
import type { ReservaRow } from "@/lib/agency/schemas";

// C2 — modal de cobro MP. Sin matchers jest-dom (no están en el setup): getByText/getByLabelText
// lanzan si no existe; se usan .value / not.toMatch / mock-matchers nativos de vitest.
const reserva = {
  id: "res-1",
  reservation_code: "V64UPY",
  holder_name: "Flia. Perez",
  snapshot_gross: 72000,
  status: "pre_reserva",
} as unknown as ReservaRow;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MpChargeModal", () => {
  it("monto default = total + CTA presente; NO afirma 'pagado'/'confirmado'", () => {
    const { container } = render(
      <MpChargeModal reserva={reserva} onClose={() => {}} />,
    );
    const input = screen.getByLabelText("Monto a cobrar") as HTMLInputElement;
    expect(input.value).toBe("72000");
    expect(screen.getByText("Generar link de pago")).toBeTruthy();
    expect(container.textContent).not.toMatch(/pagad[oa]|confirmad[oa]/i);
  });

  it("submit pega a pago-mp con {amount:Number} y mapea MP_NO_CONECTADO (409)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ ok: false, error_code: "MP_NO_CONECTADO" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MpChargeModal reserva={reserva} onClose={() => {}} />);
    fireEvent.click(screen.getByText("Generar link de pago"));
    expect(
      await screen.findByText(/no tiene MercadoPago conectado/i),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agency/reservas/res-1/pago-mp",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ amount: 72000 }),
      }),
    );
  });

  it("on ok redirige a init_point (Checkout Pro de MercadoPago)", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          init_point: "https://mp.example/checkout/abc",
        }),
      }),
    );
    render(<MpChargeModal reserva={reserva} onClose={() => {}} />);
    fireEvent.click(screen.getByText("Generar link de pago"));
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("https://mp.example/checkout/abc"),
    );
  });
});
