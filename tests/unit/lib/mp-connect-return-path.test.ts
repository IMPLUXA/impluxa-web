import { describe, it, expect } from "vitest";
import { mpConnectReturnPath } from "@/lib/urls";

// Helper PURO host-aware del callback OAuth MP (UI-connect s57). Prueba la deriva del
// target de retorno por basePath sin tocar headers (lo testeable del fix del 404).

describe("mpConnectReturnPath (host-aware)", () => {
  it("app host (basePath '') → /pagos?mp=...", () => {
    expect(mpConnectReturnPath("", "connected")).toBe("/pagos?mp=connected");
    expect(mpConnectReturnPath("", "error")).toBe("/pagos?mp=error");
  });

  it("dominio custom (basePath '/admin') → /admin/pagos?mp=...", () => {
    expect(mpConnectReturnPath("/admin", "connected")).toBe(
      "/admin/pagos?mp=connected",
    );
    expect(mpConnectReturnPath("/admin", "error")).toBe(
      "/admin/pagos?mp=error",
    );
  });
});
