"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hero background slideshow (turismo). OPT-IN: rendered by Hero.tsx ONLY when
 * media.hero_slideshow has >= 1 slide. Hakuna has no hero_slideshow -> this
 * component never mounts -> zero new DOM/classes -> byte-identical.
 *
 * Built FRESH from the Claude Design handoff manifest (design_handoff_hero,
 * read-only scratch) — NOT a copy of the prototype Hero.jsx. Exact manifest
 * values: interval 6000ms, crossfade 1600ms cubic-bezier(.22,1,.36,1),
 * Ken Burns 7400ms scale 1.0<->1.06 alternating odd/even, swipe threshold 45px.
 * CSS lives in globals.css (.pv-hero-slide* / .pv-hero-dot* / .pv-hero-arrow*).
 * Background + controls only; the hero text stays fixed in Hero.tsx above this.
 */

export interface HeroSlide {
  url: string;
  posD: string;
  posM: string;
  alt?: string;
}

const HERO_INTERVAL = 6000; // ms per photo (manifest)
const SWIPE_THRESHOLD = 45; // px (manifest)

export function HeroSlideshow({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const n = slides.length;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // reduced-motion: no auto-rotation
    timerRef.current = setInterval(
      () => setActive((i) => (i + 1) % n),
      HERO_INTERVAL,
    );
  }, [n]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const goTo = (i: number) => {
    setActive(((i % n) + n) % n);
    startTimer();
  };
  const next = () => {
    setActive((i) => (i + 1) % n);
    startTimer();
  };
  const prev = () => {
    setActive((i) => (i - 1 + n) % n);
    startTimer();
  };

  // Swipe is captured on the WHOLE hero shell, not on .pv-hero-bg. The old React
  // handlers sat on .pv-hero-bg (z-0), buried under the scrim (z-1) and content
  // (z-2) which have no pointer-events:none, so on mobile the touch never reached
  // them and swipe was dead (arrows are display:none below 760px). Touch events
  // bubble, so a passive listener on the .pv-hero-shell ancestor catches the swipe
  // wherever the finger lands. Passive + no preventDefault -> vertical scroll intact.
  useEffect(() => {
    const shell = bgRef.current?.closest(".pv-hero-shell");
    if (!shell) return;
    let startX: number | null = null;
    let startY = 0;
    const onStart = (e: Event) => {
      const t = (e as TouchEvent).changedTouches[0];
      startX = t.clientX;
      startY = t.clientY;
    };
    const onEnd = (e: Event) => {
      if (startX == null) return;
      const t = (e as TouchEvent).changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      startX = null;
      // The arrows/dots handle their own navigation via onClick; ignore a
      // tap-drag that ends on a control so it does not ALSO fire a swipe.
      const target = e.target as Element | null;
      if (target?.closest?.(".pv-hero-arrow, .pv-hero-dot")) return;
      // Only a dominantly-horizontal gesture navigates; a vertical scroll with
      // slight horizontal drift must not hijack the slide.
      if (Math.abs(dx) <= Math.abs(dy)) return;
      if (dx > SWIPE_THRESHOLD) {
        setActive((i) => (i - 1 + n) % n);
        startTimer();
      } else if (dx < -SWIPE_THRESHOLD) {
        setActive((i) => (i + 1) % n);
        startTimer();
      }
    };
    shell.addEventListener("touchstart", onStart, { passive: true });
    shell.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      shell.removeEventListener("touchstart", onStart);
      shell.removeEventListener("touchend", onEnd);
    };
  }, [n, startTimer]);

  return (
    <>
      <div ref={bgRef} className="pv-hero-bg">
        {slides.map((s, i) => (
          <div
            key={s.url}
            className={"pv-hero-slide" + (i === active ? " is-active" : "")}
            aria-hidden={i !== active}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.url}
              alt={i === 0 ? (s.alt ?? "") : ""}
              className="pv-hero-slide-img"
              style={
                { "--posD": s.posD, "--posM": s.posM } as React.CSSProperties
              }
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
              draggable={false}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        className="pv-hero-arrow pv-hero-arrow--prev"
        onClick={prev}
        aria-label="Foto anterior"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        type="button"
        className="pv-hero-arrow pv-hero-arrow--next"
        onClick={next}
        aria-label="Foto siguiente"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      <div
        className="pv-hero-dots"
        role="tablist"
        aria-label="Fotos de excursiones"
      >
        {slides.map((s, i) => (
          <button
            key={s.url}
            type="button"
            role="tab"
            className={"pv-hero-dot" + (i === active ? " is-active" : "")}
            aria-label={"Ver foto " + (i + 1)}
            aria-selected={i === active}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </>
  );
}
