import Link from "next/link";
import type { EventosDesign } from "../schema";
import { resolveStructure } from "../structure";

export function Footer({
  design,
  tenantName,
  whatsapp,
  whatsappCta,
  instagram,
}: {
  design: EventosDesign;
  tenantName: string;
  // OPT-IN WhatsApp CTA. Absent (Hakuna) -> no button -> byte-identical.
  whatsapp?: string;
  whatsappCta?: boolean;
  // s48 F2b — brand variant extra (solo se lee en variant="brand").
  instagram?: string;
}) {
  const waDigits =
    whatsappCta === true && whatsapp ? whatsapp.replace(/[^0-9]/g, "") : null;
  const ctaColor = design.colors.cta ?? design.colors.primary;

  // s48 F2b — variant "brand" (mockup v13): bg primary, marca en fonts.heading,
  // tagline + Instagram. OPT-IN via design_json structure.footer.variant;
  // default = render EXACTO de siempre (Hakuna byte-identical por construcción).
  if (resolveStructure(design.structure).footerVariant === "brand") {
    return (
      <footer
        role="contentinfo"
        className="px-6 py-10 text-center text-sm"
        style={{ background: design.colors.primary, color: "#DFEAEC" }}
      >
        <p
          className="mb-2 text-lg font-bold"
          style={{ fontFamily: design.fonts.heading, color: "#FFFFFF" }}
        >
          {tenantName}
        </p>
        <p>
          {/* Copy turismo-only por convención del branch opt-in (igual que el
              kicker/EMPTIES del overlay); pendiente schema-home si el overlay
              deja de ser single-tenant. */}
          {"Bariloche, Patagonia argentina"}
          {instagram && (
            <>
              {" · "}
              <a
                href={
                  instagram.startsWith("http")
                    ? instagram
                    : `https://instagram.com/${instagram.replace(/^@/, "")}`
                }
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram (se abre en una nueva pestaña)"
                className="underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ color: "#BCD6DD", outlineColor: "#BCD6DD" }}
              >
                Instagram
              </a>
            </>
          )}
        </p>
        <p className="mt-3 opacity-80">
          <span aria-hidden="true">© </span>
          <span className="sr-only">Copyright </span>
          {new Date().getFullYear()} {tenantName}
          {" · "}
          Sitio creado con{" "}
          <a
            href="https://impluxa.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Impluxa (se abre en una nueva pestaña)"
            className="underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: "#BCD6DD" }}
          >
            Impluxa
          </a>
          {" · "}
          <Link
            href="/privacy"
            aria-label="Política de Privacidad"
            className="underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: "#BCD6DD" }}
          >
            Privacidad
          </Link>
        </p>
      </footer>
    );
  }

  return (
    <footer
      role="contentinfo"
      className="px-6 py-8 text-center text-sm"
      style={{
        background: design.colors.text,
        color: design.colors.background,
      }}
    >
      {waDigits && (
        <a
          href={`https://wa.me/${waDigits}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Consultanos por WhatsApp (se abre en una nueva pestaña)"
          className="mb-6 inline-flex min-h-[44px] items-center justify-center rounded-full px-8 py-3 font-semibold transition hover:scale-105 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100"
          style={{
            background: ctaColor,
            color: "#FFFFFF",
            outlineColor: design.colors.accent,
          }}
        >
          Consultanos por WhatsApp
        </a>
      )}
      <p>
        <span aria-hidden="true">© </span>
        <span className="sr-only">Copyright </span>
        {new Date().getFullYear()} {tenantName}
      </p>
      <p className="mt-2">
        Sitio creado con{" "}
        <a
          href="https://impluxa.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Impluxa (se abre en una nueva pestaña)"
          className="underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: design.colors.background }}
        >
          Impluxa
        </a>
        {" · "}
        <Link
          href="/privacy"
          aria-label="Política de Privacidad"
          className="underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: design.colors.background }}
        >
          Privacidad
        </Link>
      </p>
    </footer>
  );
}
