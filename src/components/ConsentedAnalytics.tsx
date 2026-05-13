"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";

/**
 * Analytics + Plausible mounted ONLY when the user has actively accepted
 * cookies. Fix for cyber-neo F1 (LGPD/GDPR pre-consent firing) and F2
 * (revocation broadcast).
 *
 * Default state: render nothing. Privacy-by-default.
 */

const STORAGE_KEY = "cookie-consent";

type ConsentValue = "accepted" | "rejected" | null;

function readConsent(): ConsentValue {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "accepted" || v === "rejected") return v;
    return null;
  } catch {
    return null;
  }
}

export function ConsentedAnalytics({
  plausibleDomain,
}: {
  plausibleDomain?: string;
}) {
  const [consent, setConsent] = useState<ConsentValue>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setConsent(readConsent());

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ConsentValue>).detail;
      setConsent(
        detail === "accepted" || detail === "rejected" ? detail : null,
      );
    };
    window.addEventListener("consent-change", onChange);

    // Also react to storage changes from other tabs/windows.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setConsent(readConsent());
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("consent-change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (!mounted || consent !== "accepted") return null;

  return (
    <>
      <Analytics />
      {plausibleDomain && (
        <Script
          src="https://plausible.io/js/script.js"
          data-domain={plausibleDomain}
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
