// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// next/image -> plain <img>. Strip non-DOM props (fill, sizes) so React does
// not warn; keep src/alt which the assertions rely on.
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { Servicios } from "@/templates/eventos/components/Servicios";
import type { EventosDesign } from "@/templates/eventos/schema";

const design: EventosDesign = {
  colors: {
    primary: "#111111",
    secondary: "#222222",
    background: "#ffffff",
    accent: "#ff0000",
    text: "#000000",
  },
  fonts: { heading: "Poppins", body: "Inter" },
};

// Hakuna-shape: existing tenant data — no image_url, no price_ars.
const hakunaItems = [
  { key: "cumple", title: "Cumpleaños", description: "Festejos de cumpleaños" },
  { key: "egre", title: "Egresados", description: "Fiestas de egresados" },
];

// Turismo-shape: new optional fields present.
const turismoItems = [
  {
    key: "circuito-chico",
    title: "Circuito Chico",
    description: "Excursión clásica de medio día",
    image_url: "/placeholder-servicio.svg",
    price_ars: 12500,
  },
];

describe("Servicios — backward-compat (Hakuna-shape, no new fields)", () => {
  it("renders no image, no price, and no undefined/NaN text", () => {
    const { container } = render(
      <Servicios items={hakunaItems} design={design} />,
    );

    // No image element at all when image_url absent.
    expect(container.querySelectorAll("img")).toHaveLength(0);
    // No price line when price_ars absent.
    expect(screen.queryByText(/desde/i)).toBeNull();
    // Title + description still render.
    expect(screen.getByText("Cumpleaños")).toBeTruthy();
    expect(screen.getByText("Festejos de cumpleaños")).toBeTruthy();
    // No leaked placeholders from optional fields.
    expect(container.textContent).not.toMatch(/undefined/i);
    expect(container.textContent).not.toMatch(/NaN/);
  });
});

describe("Servicios — turismo-shape (new optional fields present)", () => {
  it("renders the 3:2 image and the 'desde' formatted price", () => {
    const { container } = render(
      <Servicios items={turismoItems} design={design} />,
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/placeholder-servicio.svg");
    expect(img?.getAttribute("alt")).toBe("Circuito Chico");

    const price = screen.getByText(/desde/i);
    expect(price).toBeTruthy();
    // es-AR ARS formatting uses '.' as thousands separator.
    expect(price.textContent).toMatch(/12\.500/);
  });
});

describe("Servicios — price_ars = 0 semantics (guard != null)", () => {
  it("shows the price line for an explicit zero price", () => {
    const zeroItems = [
      { key: "free", title: "Gratis", description: "Sin costo", price_ars: 0 },
    ];
    render(<Servicios items={zeroItems} design={design} />);
    // != null guard => 0 still renders the line (no stray "0", no hidden price).
    expect(screen.getByText(/desde/i)).toBeTruthy();
  });
});
