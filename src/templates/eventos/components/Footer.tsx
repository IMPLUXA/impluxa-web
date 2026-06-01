import Link from "next/link";
import type { EventosDesign } from "../schema";

export function Footer({
  design,
  tenantName,
  whatsapp,
  whatsappCta,
}: {
  design: EventosDesign;
  tenantName: string;
  // OPT-IN WhatsApp CTA. Absent (Hakuna) -> no button -> byte-identical.
  whatsapp?: string;
  whatsappCta?: boolean;
}) {
  const waDigits =
    whatsappCta === true && whatsapp ? whatsapp.replace(/[^0-9]/g, "") : null;
  const ctaColor = design.colors.cta ?? design.colors.primary;
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
