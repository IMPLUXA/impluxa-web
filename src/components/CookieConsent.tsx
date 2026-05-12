"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

const STORAGE_KEY = "cookie-consent";

type ConsentValue = "accepted" | "rejected";

function readStored(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "accepted" || v === "rejected") return v;
    return null;
  } catch {
    return null;
  }
}

function writeStored(v: ConsentValue) {
  try {
    window.localStorage.setItem(STORAGE_KEY, v);
  } catch {
    // ignore: storage disabled / quota
  }
}

export function CookieConsent() {
  // Mounted gate avoids SSR/CSR hydration mismatch — banner is purely client.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const acceptRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
    if (readStored() === null) setVisible(true);
  }, []);

  useEffect(() => {
    if (visible) acceptRef.current?.focus();
  }, [visible]);

  const dismiss = useCallback((value: ConsentValue) => {
    writeStored(value);
    setVisible(false);
  }, []);

  // Esc rejects; Tab is trapped within the dialog.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss("rejected");
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, dismiss]);

  if (!mounted || !visible) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed right-0 bottom-4 left-0 z-50 mx-auto w-[calc(100%-1.5rem)] max-w-2xl rounded-lg border border-stone-700 bg-stone-900/95 p-4 text-sm text-stone-100 shadow-xl backdrop-blur dark:border-stone-700 dark:bg-stone-900/95"
    >
      <h2 id={titleId} className="mb-1 font-semibold">
        Cookies
      </h2>
      <p id={descId} className="text-stone-200">
        Usamos cookies para mejorar tu experiencia. Más info en nuestra{" "}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/privacy" className="underline hover:text-white">
          Política de Privacidad
        </a>
        .
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => dismiss("rejected")}
          className="rounded border border-stone-500 px-3 py-1.5 text-stone-100 hover:bg-stone-800"
        >
          Rechazar
        </button>
        <button
          ref={acceptRef}
          type="button"
          onClick={() => dismiss("accepted")}
          className="rounded bg-white px-3 py-1.5 font-medium text-stone-900 hover:bg-stone-200"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
