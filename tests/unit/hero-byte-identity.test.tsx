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
import fs from "node:fs";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={props.src as string}
      alt={(props.alt as string) ?? ""}
      className={props.className as string}
    />
  ),
}));
vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

import { Hero } from "@/templates/eventos/components/Hero";
import { AboutStrip } from "@/templates/eventos/components/AboutStrip";
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
  // CTA wrapper flex div (shared w/ Hakuna): Fix 2 adds inline justifyContent
  // ONLY when hasPhoto. Hakuna (hasPhoto false) must get NO style prop.
  const ctaWrap = section.querySelector("div");
  const ctaWrapStyle = ctaWrap ? ctaWrap.getAttribute("style") : "MISSING";
  const ctaWrapClass = ctaWrap ? ctaWrap.getAttribute("class") : "MISSING";
  // Motion layer: turismo gets pv-anim-in classes; Hakuna must NOT (class + style
  // unchanged, no animationDelay leaked).
  const h1Class = h1.getAttribute("class");
  const pClass = p.getAttribute("class");

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

  it("CTA wrapper div: NO style attribute added, class unchanged (Fix 2 byte-safe)", () => {
    expect(ctaWrapStyle).toBeNull();
    expect(ctaWrapClass).toBe(
      "flex flex-col items-center justify-center gap-4 sm:flex-row",
    );
  });

  it("motion: h1 + p class unchanged for Hakuna (no pv-anim-in)", () => {
    expect(h1Class).toBe("mb-4 text-4xl font-bold md:text-6xl");
    expect(pClass).toBe("mx-auto mb-10 max-w-2xl text-lg md:text-2xl");
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
  trust_badges: [
    { label: "Guías locales certificados", icon: "shield" },
    { label: "Grupos reducidos", icon: "users" },
    { label: "Salidas todo el año", icon: "sun" },
  ],
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
  const turCtaWrap = Array.from(section.querySelectorAll("div")).find((d) =>
    d.className.includes("sm:flex-row"),
  );
  const turCtaWrapStyle = turCtaWrap?.getAttribute("style") ?? "";
  const badgeCount = container.querySelectorAll("ul li").length;
  const turH1Class = container.querySelector("h1")?.getAttribute("class") ?? "";
  const turPhotoClass =
    container.querySelector("img")?.getAttribute("class") ?? "";

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
    expect(ctaStyle).toContain("border");
    expect(ctaStyle).toContain("rgba(255, 255, 255");
  });
  it("renders the 3 trust badges", () => {
    expect(badgeCount).toBe(3);
    expect(bodyText).toContain("Guías locales certificados");
    expect(bodyText).toContain("Grupos reducidos");
    expect(bodyText).toContain("Salidas todo el año");
  });
  it("motion: turismo elements carry the entrance classes", () => {
    expect(turH1Class).toContain("pv-anim-in");
    expect(turPhotoClass).toContain("pv-hero-photo-in");
  });
  it("CTA wrapper left-aligned on photo variant (justify-content flex-start)", () => {
    expect(turCtaWrapStyle).toContain("justify-content: flex-start");
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

// ---- Nav gate (turismo-only, opt-in content.nav) ----
describe("TenantNav is turismo-only (gated content.nav)", () => {
  it("Hakuna (no content.nav): NO nav/header rendered", () => {
    const { container } = render(
      <EventosSite
        content={defaultContent}
        design={defaultDesign}
        media={defaultMedia}
        tenantId="hakuna"
        tenantName="hakunamatata"
      />,
    );
    // TenantNav renders a <header>; Site has no other <header> (footer is <footer>).
    expect(container.querySelector("header")).toBeNull();
    expect(container.querySelector("nav")).toBeNull();
  });

  it("tenant with content.nav: nav present with the items", () => {
    const withNav: EventosContent = {
      ...defaultContent,
      nav: {
        items: [
          { label: "Excursiones", href: "#excursiones" },
          { label: "Paseos", href: "#paseos" },
        ],
      },
    };
    const { container } = render(
      <EventosSite
        content={withNav}
        design={defaultDesign}
        media={{ ...defaultMedia, logo_url_light: "https://x/l.png" }}
        tenantId="turismo"
        tenantName="Patagonia Viva"
      />,
    );
    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav?.textContent).toContain("Excursiones");
    expect(nav?.textContent).toContain("Paseos");
  });
});

// ---- TONE-TURISMO-1: AboutStrip value-guard ----
describe("AboutStrip — families value-guard (Hakuna byte-identical, turismo hidden)", () => {
  it("Hakuna (260 + ratings): outerHTML BYTE-IDENTICAL to pre-edit baseline", () => {
    const { container } = render(
      <AboutStrip content={defaultContent.about} design={defaultDesign} />,
    );
    const baseline = fs
      .readFileSync("tests/unit/hakuna-about-baseline.html", "utf8")
      .trim();
    expect(container.querySelector("section")?.outerHTML).toBe(baseline);
  });

  it("turismo (families 0, no ratings): renders null (no empty dark band)", () => {
    const { container } = render(
      <AboutStrip
        content={{ families_count: 0, ratings: [] }}
        design={turismoDesign}
      />,
    );
    expect(container.querySelector("section")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("0 families but WITH ratings: renders only the ratings (no +0 stat)", () => {
    const { container } = render(
      <AboutStrip
        content={{
          families_count: 0,
          ratings: [{ source: "google", rating: 4.8, count: 12 }],
        }}
        design={turismoDesign}
      />,
    );
    expect(container.querySelector("section")).not.toBeNull();
    expect(container.textContent).not.toContain("familias atendidas");
    expect(container.textContent).toContain("4.8");
  });
});
