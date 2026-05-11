"use client";
import { useState } from "react";
import type { EventosContent, EventosDesign } from "../schema";

export function Pautas({
  items,
  design,
}: {
  items: EventosContent["pautas"];
  design: EventosDesign;
}) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section
      className="px-6 py-20"
      style={{ background: design.colors.background }}
    >
      <h2
        className="mb-12 text-center text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Pautas de contratación
      </h2>
      <div className="mx-auto max-w-3xl space-y-2">
        {items.map((p, i) => (
          <div
            key={i}
            className="rounded-lg border"
            style={{ borderColor: design.colors.secondary }}
          >
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full justify-between px-4 py-3 text-left font-semibold"
            >
              <span>{p.title}</span>
              <span>{open === i ? "−" : "+"}</span>
            </button>
            {open === i && p.body && (
              <div className="px-4 pb-4 text-sm opacity-80">{p.body}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
