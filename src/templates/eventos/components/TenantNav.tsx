"use client";

import { useEffect, useState } from "react";

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
 * Behavior (handoff README "NAV"): fixed over the hero, transparent when at top,
 * translucent on scroll (`is-scrolled`): bg + blur + shadow + dark logo + dark
 * links. Links hidden < 760px (NO hamburger). Logo height 38px.
 */
export function TenantNav({
  items,
  logoLight,
  logoDark,
  tenantName,
}: {
  items: NavItem[];
  logoLight?: string;
  logoDark?: string;
  tenantName: string;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const logoSrc = scrolled ? logoDark : logoLight;

  return (
    <header
      className="fixed inset-x-0 top-0 z-40"
      style={{
        background: scrolled ? "rgba(251,248,242,0.86)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : undefined,
        WebkitBackdropFilter: scrolled ? "blur(12px)" : undefined,
        boxShadow: scrolled ? "0 2px 8px rgba(20,48,56,0.07)" : undefined,
        transition:
          "background 240ms cubic-bezier(0.22,1,0.36,1), box-shadow 240ms cubic-bezier(0.22,1,0.36,1), backdrop-filter 240ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <nav
        aria-label={`Navegación ${tenantName}`}
        className="mx-auto flex items-center gap-5"
        style={{ maxWidth: "1120px", padding: "14px 24px" }}
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
                className={`font-semibold transition-colors hover:text-[#B48448] ${
                  scrolled ? "text-[#36474A]" : "text-white"
                }`}
                style={{
                  fontSize: "15px",
                  textShadow: scrolled
                    ? undefined
                    : "0 1px 8px rgba(10,26,31,0.5)",
                }}
              >
                {it.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
