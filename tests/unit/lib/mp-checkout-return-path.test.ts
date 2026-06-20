import { describe, it, expect } from "vitest";
import { mpCheckoutReturnPath } from "@/lib/urls";

// Helper PURO host-aware del retorno post-checkout MP (C-COBRO-MP C1). Prueba la deriva del
// target por basePath sin tocar headers (lo testeable del fix del 404 de /app?mp=return en .ar).
describe("mpCheckoutReturnPath (host-aware)", () => {
  it("app host (basePath '') → /pagos/return?r=...", () => {
    expect(mpCheckoutReturnPath("", "approved")).toBe(
      "/pagos/return?r=approved",
    );
    expect(mpCheckoutReturnPath("", "pending")).toBe("/pagos/return?r=pending");
    expect(mpCheckoutReturnPath("", "failure")).toBe("/pagos/return?r=failure");
  });

  it("dominio custom (basePath '/admin') → /admin/pagos/return?r=...", () => {
    expect(mpCheckoutReturnPath("/admin", "approved")).toBe(
      "/admin/pagos/return?r=approved",
    );
    expect(mpCheckoutReturnPath("/admin", "failure")).toBe(
      "/admin/pagos/return?r=failure",
    );
  });
});
