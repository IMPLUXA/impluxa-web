"use client";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { EventosDesign } from "../schema";
import { resolveStructure } from "../structure";

/**
 * Per-excursion photo album with a lightweight native <dialog> lightbox.
 * Vanilla (no carousel lib). Lazy: this is a "use client" component dynamically
 * imported by Servicios ONLY when a servicio has `gallery`, so a tenant without
 * galleries (hakunamatata) never loads this JS chunk.
 *
 * The trigger is the card's cover image + a "N fotos" badge; clicking opens the
 * modal dialog (Esc / backdrop / ✕ to close, ← → to navigate).
 */
export function ServicioGallery({
  images,
  cover,
  title,
  design,
}: {
  images: string[];
  cover: string;
  title: string;
  design: EventosDesign;
}) {
  const sc = resolveStructure(design.structure);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const labelId = useId();

  const open = useCallback((i: number) => {
    setIndex(i);
    dialogRef.current?.showModal();
  }, []);
  const close = useCallback(() => dialogRef.current?.close(), []);
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + images.length) % images.length),
    [images.length],
  );
  const next = useCallback(
    () => setIndex((i) => (i + 1) % images.length),
    [images.length],
  );

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    dlg.addEventListener("keydown", onKey);
    return () => dlg.removeEventListener("keydown", onKey);
  }, [prev, next]);

  return (
    <>
      <button
        type="button"
        onClick={() => open(0)}
        aria-haspopup="dialog"
        aria-label={`Ver galería de ${title} — ${images.length} fotos`}
        className={`group block w-full cursor-pointer ${sc.galleryItem} focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2`}
        style={{ outlineColor: design.colors.accent }}
      >
        <Image
          src={cover}
          alt={title}
          fill
          className={`${sc.galleryItemFit} transition group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100`}
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
        />
        <span
          className="absolute right-2 bottom-2 rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            background: design.colors.primary,
            color: design.colors.background,
          }}
        >
          {images.length} fotos
        </span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={labelId}
        className="m-auto w-[92vw] max-w-4xl rounded-2xl p-0 backdrop:bg-black/70"
        style={{
          background: design.colors.background,
          color: design.colors.text,
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3
              id={labelId}
              className="text-lg font-semibold"
              style={{ fontFamily: design.fonts.heading }}
            >
              {title}
            </h3>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar galería"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-xl focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                background: design.colors.primary,
                color: design.colors.background,
                outlineColor: design.colors.accent,
              }}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl">
            <Image
              key={index}
              src={images[index]}
              alt={`${title} — foto ${index + 1} de ${images.length}`}
              fill
              className="object-contain"
              sizes="92vw"
            />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={prev}
                aria-label="Foto anterior"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full px-5 font-semibold focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  background: design.colors.secondary,
                  color: design.colors.background,
                  outlineColor: design.colors.accent,
                }}
              >
                <span aria-hidden="true">←</span>
              </button>
              <span className="text-sm font-medium" aria-live="polite">
                {index + 1} / {images.length}
              </span>
              <button
                type="button"
                onClick={next}
                aria-label="Foto siguiente"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full px-5 font-semibold focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  background: design.colors.secondary,
                  color: design.colors.background,
                  outlineColor: design.colors.accent,
                }}
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
