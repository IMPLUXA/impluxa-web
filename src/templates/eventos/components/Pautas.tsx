"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import type { EventosContent, EventosDesign } from "../schema";

export function Pautas({
  items,
  design,
}: {
  items: EventosContent["pautas"];
  design: EventosDesign;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const focusButton = (index: number) => {
    const total = items.length;
    const next = ((index % total) + total) % total;
    buttonsRef.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusButton(i + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusButton(i - 1);
        break;
      case "Home":
        e.preventDefault();
        focusButton(0);
        break;
      case "End":
        e.preventDefault();
        focusButton(items.length - 1);
        break;
      case "Escape":
        if (open !== null) {
          e.preventDefault();
          setOpen(null);
          buttonsRef.current[i]?.focus();
        }
        break;
    }
  };

  return (
    <section
      id="pautas"
      aria-labelledby="pautas-heading"
      className="px-6 py-20"
      style={{ background: design.colors.background }}
    >
      <h2
        id="pautas-heading"
        className="mb-12 text-center text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Pautas de contratación
      </h2>
      <div className="mx-auto max-w-3xl space-y-2" role="presentation">
        {items.map((p, i) => {
          const expanded = open === i;
          const buttonId = `pauta-trigger-${i}`;
          const panelId = `pauta-panel-${i}`;
          return (
            <div
              key={i}
              className="rounded-lg border"
              style={{ borderColor: design.colors.secondary }}
            >
              <h3 className="m-0">
                <button
                  ref={(el) => {
                    buttonsRef.current[i] = el;
                  }}
                  id={buttonId}
                  type="button"
                  onClick={() => setOpen(expanded ? null : i)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-left font-semibold focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ outlineColor: design.colors.primary }}
                >
                  <span>{p.title}</span>
                  <span aria-hidden="true">{expanded ? "−" : "+"}</span>
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!expanded}
                className="px-4 pb-4 text-sm"
              >
                {p.body ?? <em>Detalles próximamente.</em>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
