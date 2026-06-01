// @vitest-environment jsdom
//
// PIECE 1 byte-identity gate. Renders the REAL Hakuna data (defaults.ts) through
// the template and asserts the 5 hero elements are byte-identical to the
// pre-edit baseline (captured from origin/main #16, jsdom-serialized). The gate
// compares the ATTRIBUTE that PIECE 1 mutates (inline `style`), not class-SET —
// the photo variant deliberately keeps classNames intact, so a class-SET gate
// would be blind to a style regression. Also confirms the turismo photo variant
// and the turismo-only WhatsApp FAB gate.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src as string} alt={(props.alt as string) ?? ""} />
  ),
}));
vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

import { Hero } from "@/templates/eventos/components/Hero";
import { EventosSite } from "@/templates/eventos/Site";
import {
  defaultContent,
  defaultDesign,
  defaultMedia,
} from "@/templates/eventos/defaults";
import type {
  EventosContent,
  EventosDesign,
  EventosMedia,
} from "@/templates/eventos/schema";

// ---- PRE-EDIT BASELINE (captured from origin/main, jsdom-serialized) ----
const BASE_SECTION_CLASS =
  "relative isolate overflow-hidden px-6 py-24 text-center md:py-32";
const BASE_SECTION_STYLE =
  "background: rgb(255, 255, 255); color: rgb(15, 23, 42);";
const BASE_H1_STYLE = "font-family: Fredoka; color: rgb(21, 101, 192);";
const BASE_P_STYLE = "font-family: Inter;";
const BASE_CTA_PRIMARY_STYLE =
  "background: rgb(21, 101, 192); color: rgb(255, 255, 255); outline-color: rgb(255, 193, 7);";
const BASE_CTA_SECONDARY_STYLE =
  "border-color: rgb(21, 101, 192); color: rgb(21, 101, 192); outline-color: rgb(255, 193, 7);";

describe("PIECE 1 gate — Hakuna Hero BYTE-IDENTICAL (real defaults, post-edit)", () => {
  const { container } = render(
    <Hero
      content={defaultContent.hero}
      design={defaultDesign}
      media={defaultMedia}
      tenantName="hakunamatata"
    />,
  );
  // Capture at collection time (testing-library cleans the live container before
  // the it() bodies run; captured nodes/primitives retain their attributes).
  const section = container.querySelector("section")!;
  const h1 = container.querySelector("h1")!;
  const p = section.querySelector("p")!;
  const anchors = Array.from(section.querySelectorAll("a"));
  const imgCount = container.querySelectorAll("img").length;
  const sectionChildTags = Array.from(section.children).map((c) => c.tagName);

  it("section: class + style char-identical (no text-align added)", () => {
    expect(section.getAttribute("class")).toBe(BASE_SECTION_CLASS);
    expect(section.getAttribute("style")).toBe(BASE_SECTION_STYLE);
  });

  it("additive-node-count = 0: section has exactly [h1, p, div] (no photo img, no eyebrow, no logo)", () => {
    expect(imgCount).toBe(0);
    expect(sectionChildTags).toEqual(["H1", "P", "DIV"]);
  });

  it("h1 + p style char-identical", () => {
    expect(h1.getAttribute("style")).toBe(BASE_H1_STYLE);
    expect(p.getAttribute("style")).toBe(BASE_P_STYLE);
  });

  it("CTA <a> style key-by-key identical (the fragile point)", () => {
    expect(anchors).toHaveLength(2);
    expect(anchors[0].getAttribute("style")).toBe(BASE_CTA_PRIMARY_STYLE);
    expect(anchors[1].getAttribute("style")).toBe(BASE_CTA_SECONDARY_STYLE);
  });

  it("text content unchanged (no leaked undefined)", () => {
    expect(h1.textContent).toBe(defaultContent.hero.slogan);
    expect(p.textContent).toBe(defaultContent.hero.subtitle);
    expect(anchors[0].textContent).toBe(defaultContent.hero.cta_primary_label);
    expect(container.textContent).not.toMatch(/undefined/i);
  });
});

// ---- Turismo photo variant ----
const turismoHero: EventosContent["hero"] = {
  slogan: "Viví la Patagonia con quienes la conocen.",
  subtitle: "Excursiones en Bariloche y la cordillera.",
  eyebrow: "Bariloche · Patagonia argentina",
  cta_primary_label: "Ver excursiones",
  cta_primary_href: "#servicios",
  // no cta_secondary -> single CTA
};
const turismoDesign: EventosDesign = {
  colors: {
    primary: "#143038",
    secondary: "#3E7C95",
    background: "#F7F2E8",
    accent: "#B48448",
    text: "#1E2B2C",
    cta: "#25D366",
  },
  fonts: { heading: "Cinzel", body: "Hanken Grotesk" },
};
const turismoMedia: EventosMedia = {
  gallery: [],
  hero_image_url: "https://example.supabase.co/turismo/hero/hero.webp",
};

describe("PIECE 1 — turismo photo variant emits the mockup hero", () => {
  const { container } = render(
    <Hero
      content={turismoHero}
      design={turismoDesign}
      media={turismoMedia}
      tenantName="turismo"
    />,
  );
  const section = container.querySelector("section")!;
  // Capture at collection time (see note above).
  const imgSrc = container.querySelector("img")?.getAttribute("src") ?? "";
  const bodyText = container.textContent ?? "";
  const sectionStyle = section.getAttribute("style") ?? "";
  const ctaAnchors = Array.from(section.querySelectorAll("a"));
  const ctaCount = ctaAnchors.length;
  const ctaStyle = ctaAnchors[0]?.getAttribute("style") ?? "";

  it("renders full-bleed photo <img>", () => {
    expect(imgSrc).toContain("turismo/hero/hero.webp");
  });
  it("renders the copper eyebrow", () => {
    expect(bodyText).toContain("Bariloche · Patagonia argentina");
  });
  it("section is left-aligned + light text", () => {
    expect(sectionStyle).toContain("text-align: left");
    expect(sectionStyle).toContain("rgb(247, 242, 232)"); // #F7F2E8 light
  });
  it("single outline-light CTA (border added, no secondary)", () => {
    expect(ctaCount).toBe(1);
    expect(ctaStyle).toContain("border: 2px solid");
    expect(ctaStyle).toContain("transparent");
  });
});

// ---- FAB gate (turismo-only) ----
describe("PIECE 1 — WhatsApp FAB is turismo-only (gated whatsapp_cta===true)", () => {
  it("Hakuna (no whatsapp_cta): NO FAB", () => {
    const { container } = render(
      <EventosSite
        content={defaultContent}
        design={defaultDesign}
        media={defaultMedia}
        tenantId="hakuna"
        tenantName="hakunamatata"
      />,
    );
    expect(
      container.querySelector('a[aria-label="Contactar por WhatsApp"]'),
    ).toBeNull();
  });

  it("tenant with whatsapp_cta=true: FAB present", () => {
    const withCta: EventosContent = {
      ...defaultContent,
      contacto: { ...defaultContent.contacto, whatsapp_cta: true },
    };
    const { container } = render(
      <EventosSite
        content={withCta}
        design={defaultDesign}
        media={defaultMedia}
        tenantId="turismo"
        tenantName="turismo"
      />,
    );
    const fab = container.querySelector(
      'a[aria-label="Contactar por WhatsApp"]',
    );
    expect(fab).not.toBeNull();
    expect(fab?.getAttribute("href")).toContain("wa.me/");
  });
});
