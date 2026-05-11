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
      className="px-6 py-8 text-center text-sm"
      style={{
        background: design.colors.text,
        color: design.colors.background,
      }}
    >
      <p>
        © {new Date().getFullYear()} {tenantName}
      </p>
      <p className="mt-2 opacity-70">
        Sitio creado con{" "}
        <a href="https://impluxa.com" className="underline">
          Impluxa
        </a>
      </p>
    </footer>
  );
}
