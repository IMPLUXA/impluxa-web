// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    rpc: vi.fn(),
    from: vi.fn(),
  }),
}));

import { RatesManager } from "@/app/app/agency/rates/RatesManager";
import type {
  ExcursionRow,
  RateRow,
  PassengerCategoryRow,
} from "@/lib/agency/schemas";

// REGRESIÓN bug P0 s49 (walk CEO): PostgREST entrega numeric como NÚMERO JSON.
// El crash real fue: click "Nueva tarifa" → prefill numérico al form state →
// render del modal evalúa disabled={!form.base_price.trim()} → TypeError →
// árbol React muerto ("This page couldn't load"). Este test renderiza el
// componente REAL con números (como prod) y ejecuta exactamente ese camino.

const T = "2878495a-0000-0000-0000-000000000000";

const EXC: ExcursionRow[] = [
  {
    id: "e1",
    tenant_id: T,
    provider_id: null,
    name: "Cerro Catedral",
    description: null,
    category: "terrestre",
    active: true,
    default_currency: "ARS",
    created_at: "2026-06-10T00:00:00Z",
  },
];

// NÚMEROS a propósito — el payload real de PostgREST, no el string del mock viejo.
const RATES: RateRow[] = [
  {
    id: "r1",
    tenant_id: T,
    excursion_id: "e1",
    base_price: 38000,
    provider_cost: 0,
    currency: "ARS",
    valid_from: "2026-06-10T16:00:00Z",
    valid_to: null,
    created_by: null,
    created_at: "2026-06-10T16:00:00Z",
  },
];

const CATS: PassengerCategoryRow[] = [
  {
    id: "c1",
    tenant_id: T,
    code: "tercera_edad",
    label: "3ra edad",
    price_factor: 0.9,
    created_at: "2026-06-10T00:00:00Z",
  },
];

describe("RatesManager con payload numérico real (regresión P0 s49)", () => {
  it("renderiza la tabla con números (display)", () => {
    render(
      <RatesManager
        excursions={EXC}
        initialRates={RATES}
        initialCategories={CATS}
        role="dueno_admin"
        canEdit={true}
      />,
    );
    expect(screen.getByText("Cerro Catedral")).toBeTruthy();
    // factor numérico 0.9 → "90%"
    expect(screen.getByText("90%")).toBeTruthy();
  });

  it("click 'Nueva tarifa' con prefill NUMÉRICO renderiza el modal SIN crashear (el crash del walk)", () => {
    render(
      <RatesManager
        excursions={EXC}
        initialRates={RATES}
        initialCategories={CATS}
        role="dueno_admin"
        canEdit={true}
      />,
    );
    // Exactamente el gesto que mató la página en prod:
    fireEvent.click(screen.getByText("Nueva tarifa"));
    // El modal renderiza (el disabled del submit evaluó sin TypeError):
    expect(screen.getByText("Guardar tarifa")).toBeTruthy();
    // Prefill normalizado a string:
    const input = screen.getByLabelText(
      "Precio al turista",
    ) as HTMLInputElement;
    expect(input.value).toBe("38000");
  });
});
