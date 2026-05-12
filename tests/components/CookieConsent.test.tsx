import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/i18n/messages/es-LA.json";

// next-intl's createNavigation imports next/navigation which vitest can't
// resolve in jsdom env. Stub the routing module with a plain anchor Link.
vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CookieConsent } from "@/components/CookieConsent";

const STORAGE_KEY = "cookie-consent";

function renderBanner() {
  return render(
    <NextIntlClientProvider locale="es-LA" messages={esMessages}>
      <CookieConsent />
    </NextIntlClientProvider>,
  );
}

describe("CookieConsent banner", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders banner on first visit with dialog role + ARIA labelling", async () => {
    renderBanner();
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(labelledBy).toBeTruthy();
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).toBeInTheDocument();
    expect(document.getElementById(describedBy!)).toBeInTheDocument();
  });

  it("shows Spanish default copy and privacy link", async () => {
    renderBanner();
    expect(
      await screen.findByText(/Usamos cookies para mejorar tu experiencia/i),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: /pol[ií]tica de privacidad/i,
    });
    expect(link).toHaveAttribute("href", expect.stringContaining("privac"));
  });

  it("does NOT render when localStorage key already set to 'accepted'", async () => {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    renderBanner();
    await Promise.resolve();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does NOT render when localStorage key already set to 'rejected'", async () => {
    window.localStorage.setItem(STORAGE_KEY, "rejected");
    renderBanner();
    await Promise.resolve();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Aceptar button stores 'accepted' and unmounts banner", async () => {
    const user = userEvent.setup();
    renderBanner();
    const accept = await screen.findByRole("button", { name: /aceptar/i });
    await user.click(accept);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("accepted");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Rechazar button stores 'rejected' and unmounts banner", async () => {
    const user = userEvent.setup();
    renderBanner();
    const reject = await screen.findByRole("button", { name: /rechazar/i });
    await user.click(reject);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("rejected");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Enter on focused Aceptar activates accept", async () => {
    const user = userEvent.setup();
    renderBanner();
    const accept = await screen.findByRole("button", { name: /aceptar/i });
    accept.focus();
    await user.keyboard("{Enter}");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("accepted");
  });

  it("Esc key rejects consent", async () => {
    const user = userEvent.setup();
    renderBanner();
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("rejected");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("focus is trapped: Tab from last focusable cycles back to first", async () => {
    const user = userEvent.setup();
    renderBanner();
    const dialog = await screen.findByRole("dialog");

    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
    );
    expect(focusables.length).toBeGreaterThanOrEqual(2);

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    expect(document.activeElement).toBe(last);
    await user.tab();
    expect(document.activeElement).toBe(first);

    first.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });
});
