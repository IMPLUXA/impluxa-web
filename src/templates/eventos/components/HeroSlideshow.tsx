"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TouchEvent as ReactTouchEvent } from "react";

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
  const touchX = useRef<number | null>(null);

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

  const onTouchStart = (e: ReactTouchEvent) => {
    touchX.current = e.changedTouches[0].clientX;
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (dx > SWIPE_THRESHOLD) prev();
    else if (dx < -SWIPE_THRESHOLD) next();
    touchX.current = null;
  };

  return (
    <>
      <div
        className="pv-hero-bg"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
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
