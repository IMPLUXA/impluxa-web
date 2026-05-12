import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const STORAGE_KEY = "cookie-consent";

// Stub Vercel Analytics (the real one tries to ping vitals endpoints).
vi.mock("@vercel/analytics/react", () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}));

// Stub next/script — we just want to know if it would render.
vi.mock("next/script", () => ({
  default: (props: { src: string; "data-domain"?: string }) => (
    <div
      data-testid="plausible-script"
      data-src={props.src}
      data-domain={props["data-domain"]}
    />
  ),
}));

import { ConsentedAnalytics } from "@/components/ConsentedAnalytics";

describe("ConsentedAnalytics", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders NOTHING by default (no consent stored)", () => {
    const { container } = render(<ConsentedAnalytics />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("vercel-analytics")).not.toBeInTheDocument();
    expect(screen.queryByTestId("plausible-script")).not.toBeInTheDocument();
  });

  it("renders NOTHING when consent is 'rejected'", async () => {
    window.localStorage.setItem(STORAGE_KEY, "rejected");
    render(<ConsentedAnalytics plausibleDomain="impluxa.com" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId("vercel-analytics")).not.toBeInTheDocument();
    expect(screen.queryByTestId("plausible-script")).not.toBeInTheDocument();
  });

  it("renders Analytics when consent is 'accepted'", async () => {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    render(<ConsentedAnalytics />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId("vercel-analytics")).toBeInTheDocument();
  });

  it("renders Plausible only when plausibleDomain prop is set + consent accepted", async () => {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    render(<ConsentedAnalytics plausibleDomain="impluxa.com" />);
    await act(async () => {
      await Promise.resolve();
    });
    const script = screen.getByTestId("plausible-script");
    expect(script).toHaveAttribute("data-domain", "impluxa.com");
    expect(script).toHaveAttribute(
      "data-src",
      "https://plausible.io/js/script.js",
    );
  });

  it("DOES NOT render Plausible when plausibleDomain undefined", async () => {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    render(<ConsentedAnalytics />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId("plausible-script")).not.toBeInTheDocument();
  });

  it("reacts to consent-change CustomEvent (no remount)", async () => {
    render(<ConsentedAnalytics />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId("vercel-analytics")).not.toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("consent-change", { detail: "accepted" }),
      );
      await Promise.resolve();
    });
    expect(screen.queryByTestId("vercel-analytics")).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("consent-change", { detail: "rejected" }),
      );
      await Promise.resolve();
    });
    expect(screen.queryByTestId("vercel-analytics")).not.toBeInTheDocument();
  });

  it("reacts to storage events from other tabs", async () => {
    render(<ConsentedAnalytics />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId("vercel-analytics")).not.toBeInTheDocument();

    await act(async () => {
      window.localStorage.setItem(STORAGE_KEY, "accepted");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEY,
          newValue: "accepted",
        }),
      );
      await Promise.resolve();
    });
    expect(screen.queryByTestId("vercel-analytics")).toBeInTheDocument();
  });
});
