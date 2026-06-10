interface NavItem {
  label: string;
  href: string;
}

/**
 * Tenant nav (turismo). OPT-IN: rendered by Site.tsx ONLY when content.nav is
 * present. Hakuna has no content.nav -> this component never mounts -> zero new
 * DOM/classes -> byte-identical. Self-contained (no design_json fields needed;
 * uses the handoff "extended" palette inline, which has no schema home).
 *
 * s48c — mockup v13 parity: barra crema STICKY siempre visible (antes:
 * fixed transparente sobre la foto con swap al scroll). El hero arranca DEBAJO
 * de la barra (en flujo), como el mockup. Wordmark oscuro constante + links
 * oscuros (hover teal) + botón WhatsApp pill (conversión, mockup .btn-act
 * strong). Sin estado de scroll -> ya no es client component.
 * Links ocultos < 760px (sin hamburguesa, igual que el mockup).
 */
export function TenantNav({
  items,
  logoLight,
  logoDark,
  tenantName,
  whatsapp,
  whatsappCta,
}: {
  items: NavItem[];
  logoLight?: string;
  logoDark?: string;
  tenantName: string;
  // OPT-IN WhatsApp pill (mockup nav). Solo con whatsapp_cta === true.
  whatsapp?: string;
  whatsappCta?: boolean;
}) {
  // Barra clara constante -> wordmark oscuro; fallback al claro si no hay dark.
  const logoSrc = logoDark ?? logoLight;
  const waDigits =
    whatsappCta === true && whatsapp ? whatsapp.replace(/[^0-9]/g, "") : null;

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: "rgba(244, 237, 220, 0.86)",
        backdropFilter: "saturate(1.1) blur(8px)",
        WebkitBackdropFilter: "saturate(1.1) blur(8px)",
        borderBottom: "1px solid rgba(180, 132, 72, 0.3)",
      }}
    >
      <nav
        aria-label={`Navegación ${tenantName}`}
        className="mx-auto flex items-center gap-5"
        style={{ maxWidth: "1160px", padding: "12px 24px" }}
      >
        {logoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt={tenantName}
            className="pv-nav-logo"
            style={{ height: "38px", width: "auto" }}
          />
        )}
        <ul className="ml-auto hidden list-none items-center gap-7 p-0 min-[760px]:flex">
          {items.map((it) => (
            <li key={it.href}>
              <a
                href={it.href}
                className="font-medium text-[#1E2B2C] transition-colors hover:text-[#3E7C95]"
                style={{ fontSize: "15px" }}
              >
                {it.label}
              </a>
            </li>
          ))}
          {waDigits && (
            <li>
              <a
                href={`https://wa.me/${waDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp (se abre en una nueva pestaña)"
                className="pv-nav-wa inline-flex items-center justify-center font-bold"
              >
                WhatsApp
              </a>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
