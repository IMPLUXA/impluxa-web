import Link from "next/link";
import type { EventosDesign } from "../schema";

export function Footer({
  design,
  tenantName,
}: {
  design: EventosDesign;
  tenantName: string;
}) {
  return (
    <footer
      role="contentinfo"
      className="px-6 py-8 text-center text-sm"
      style={{
        background: design.colors.text,
        color: design.colors.background,
      }}
    >
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
