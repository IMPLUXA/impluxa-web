import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CheckoutReturnView } from "@/app/app/pagos/return/CheckoutReturnView";

// C-COBRO-MP C1 — la vista de retorno NO debe afirmar "confirmado" (la confirmación real es
// asíncrona vía webhook; la página dice "en confirmación"). Prueba los 3 estados + back link.
// Sin matchers jest-dom (no están en el setup de este vitest, igual que mp-connect-manager):
// getByText/getByRole ya lanzan si no existe; se usan getAttribute + toMatch nativos.
describe("CheckoutReturnView", () => {
  afterEach(() => cleanup());

  it("approved → 'Pago iniciado', dice 'confirmando', NUNCA 'confirmado'", () => {
    const { container } = render(
      <CheckoutReturnView state="approved" backHref="/agency/reservas" />,
    );
    expect(screen.getByText("Pago iniciado")).toBeTruthy();
    expect(container.textContent).toMatch(/confirmando/i);
    expect(container.textContent).not.toMatch(/confirmado/i);
  });

  it("pending → 'Pago pendiente'", () => {
    render(
      <CheckoutReturnView state="pending" backHref="/admin/agency/reservas" />,
    );
    expect(screen.getByText("Pago pendiente")).toBeTruthy();
  });

  it("failure → 'Pago no completado'", () => {
    render(<CheckoutReturnView state="failure" backHref="/agency/reservas" />);
    expect(screen.getByText("Pago no completado")).toBeTruthy();
  });

  it("el back link usa el href host-aware provisto", () => {
    render(
      <CheckoutReturnView state="approved" backHref="/admin/agency/reservas" />,
    );
    const link = screen.getByRole("link", { name: "Volver a reservas" });
    expect(link.getAttribute("href")).toBe("/admin/agency/reservas");
  });
});
