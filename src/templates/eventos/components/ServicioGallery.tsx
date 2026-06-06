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
 * s39 visor mejoras (mockup-aprobado SPEC):
 *  - SWIPE movil sobre la card (overlay): deslizar horizontal cicla
 *    [cover + gallery] inline con DOTS. Umbral 40px + dominancia |dx|>|dy|
 *    (leccion hero-swipe: no secuestrar scroll vertical -> touch-action: pan-y).
 *    Tap (sin swipe) abre el modal en la imagen actual. Desktop: click abre modal.
 *  - ZOOM rueda PC en el visor: scale 1-3 (wheel, passive:false -> no scrollea).
 *  - PAN follow-cursor (desktop, scale>1): el mouse desplaza la imagen,
 *    proporcional al zoom + clamp a bordes. Reset pan+zoom al cerrar/navegar.
 *  Todo overlay/visor-only -> Hakuna (stack, sin gallery) nunca monta este chunk.
 */
export function ServicioGallery({
  images,
  cover,
  title,
  design,
  overlay = false,
}: {
  images: string[];
  cover: string;
  title: string;
  design: EventosDesign;
  // s38 v3: render a BARE full-bleed cover button (fills .exc-photo, no badge —
  // Servicios paints the title/N-fotos overlay). Absent (default/Hakuna) -> the
  // exact current cover + badge markup -> byte-identical.
  overlay?: boolean;
}) {
  const sc = resolveStructure(design.structure);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  // s39: el set del visor cicla [cover + gallery] (portada incluida). Dedup
  // (Pass-2 cold): si cover deriva de gallery[0] (servicio sin image_url ->
  // `cover = image_url ?? gallery[0]`), NO prepender -> evita la primera foto
  // duplicada. PV (cover 2k/cover.webp != gallery[0] 2k/g1.webp) -> N+1 completo.
  const slides = cover && cover !== images[0] ? [cover, ...images] : images;
  const total = slides.length;

  const [index, setIndex] = useState(0); // imagen activa en el dialog
  const [coverIdx, setCoverIdx] = useState(0); // slide activo en la card (overlay)
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const resetZoom = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const open = useCallback(
    (i: number) => {
      setIndex(i);
      resetZoom();
      dialogRef.current?.showModal();
    },
    [resetZoom],
  );
  const close = useCallback(() => dialogRef.current?.close(), []);
  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + total) % total);
    resetZoom();
  }, [total, resetZoom]);
  const next = useCallback(() => {
    setIndex((i) => (i + 1) % total);
    resetZoom();
  }, [total, resetZoom]);

  // Keyboard arrows in the open dialog (existing behavior, preserved).
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

  // s39: wheel zoom on the dialog stage (desktop). Non-passive so preventDefault
  // stops the page from scrolling while zooming.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      setScale((s) =>
        Math.min(3, Math.max(1, s + (e.deltaY < 0 ? 0.2 : -0.2))),
      );
    }
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  // s39: when zoom returns to 1 -> reset pan; when scale changes -> clamp pan to
  // bounds so it never reveals empty space.
  useEffect(() => {
    if (scale <= 1) {
      setPan({ x: 0, y: 0 });
      return;
    }
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    const mx = ((scale - 1) * r.width) / 2;
    const my = ((scale - 1) * r.height) / 2;
    setPan((p) => ({
      x: Math.min(mx, Math.max(-mx, p.x)),
      y: Math.min(my, Math.max(-my, p.y)),
    }));
  }, [scale]);

  // s39: pan follow-cursor (desktop, scale>1). Maps cursor position in the stage
  // -> image translate, proportional to zoom, clamped (px/py in [0,1]).
  const onStageMove = useCallback(
    (e: React.MouseEvent) => {
      if (scale <= 1) return;
      const r = stageRef.current?.getBoundingClientRect();
      if (!r) return;
      const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      setPan({
        x: (0.5 - px) * (scale - 1) * r.width,
        y: (0.5 - py) * (scale - 1) * r.height,
      });
    },
    [scale],
  );

  // s39: card swipe (overlay, movil). Distingue tap (abre modal) de swipe
  // (cicla coverIdx) por umbral + dominancia horizontal.
  const touch = useRef({ x: 0, y: 0, swiped: false, multi: false });
  const onCoverTouchStart = useCallback((e: React.TouchEvent) => {
    // multi-touch (pinch u otro): NO es swipe de card -> ignorar (Pass-2 cold).
    if (e.touches.length > 1) {
      touch.current.multi = true;
      return;
    }
    const t = e.changedTouches[0];
    touch.current = { x: t.clientX, y: t.clientY, swiped: false, multi: false };
  }, []);
  const onCoverTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touch.current.multi) {
        if (e.touches.length === 0) touch.current.multi = false; // ultimo dedo -> reset
        return;
      }
      const t = e.changedTouches[0];
      const dx = t.clientX - touch.current.x;
      const dy = t.clientY - touch.current.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        touch.current.swiped = true;
        setCoverIdx((i) => (i + (dx < 0 ? 1 : -1) + total) % total);
      }
    },
    [total],
  );
  const onCoverClick = useCallback(() => {
    if (touch.current.swiped) {
      touch.current.swiped = false;
      return; // fue swipe, no abrir modal
    }
    open(coverIdx);
  }, [open, coverIdx]);
  // touchcancel (gesto interrumpido por OS): resetear para no dejar multi/swiped
  // pegados y deshabilitar silenciosamente el swipe inline (Pass cold nit).
  const onCoverTouchCancel = useCallback(() => {
    touch.current.multi = false;
    touch.current.swiped = false;
  }, []);

  // s41 visor redesign: swipe en el STAGE del dialog (movil, sin flechas) ->
  // navega prev/next. Umbral 40 + dominancia horizontal; multitouch ignorado;
  // no navega con zoom (scale>1). Pan sigue siendo desktop (onMouseMove).
  const stageTouch = useRef({ x: 0, y: 0, multi: false });
  const onStageTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 1) {
      stageTouch.current.multi = true;
      return;
    }
    const t = e.changedTouches[0];
    stageTouch.current = { x: t.clientX, y: t.clientY, multi: false };
  }, []);
  const onStageTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (stageTouch.current.multi) {
        if (e.touches.length === 0) stageTouch.current.multi = false;
        return;
      }
      if (scale > 1) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - stageTouch.current.x;
      const dy = t.clientY - stageTouch.current.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) next();
        else prev();
      }
    },
    [scale, next, prev],
  );

  return (
    <>
      {overlay ? (
        <button
          type="button"
          onClick={onCoverClick}
          onTouchStart={onCoverTouchStart}
          onTouchEnd={onCoverTouchEnd}
          onTouchCancel={onCoverTouchCancel}
          aria-haspopup="dialog"
          aria-label={`Ver galería de ${title}, ${total} fotos`}
          className="exc-cover-btn focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            outlineColor: design.colors.accent,
            touchAction: "pan-y",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              display: "flex",
              height: "100%",
              width: "100%",
              transform: `translateX(-${coverIdx * 100}%)`,
              transition: "transform .28s cubic-bezier(.22,1,.36,1)",
            }}
          >
            {slides.map((src, i) => (
              <span
                key={i}
                style={{
                  position: "relative",
                  display: "block",
                  minWidth: "100%",
                  height: "100%",
                }}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 50vw, 100vw"
                />
              </span>
            ))}
          </span>
          {total > 1 && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 10,
                display: "flex",
                gap: 6,
                justifyContent: "center",
                pointerEvents: "none",
                zIndex: 2,
              }}
            >
              {slides.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: i === coverIdx ? 16 : 6,
                    height: 6,
                    borderRadius: 999,
                    background:
                      i === coverIdx
                        ? design.colors.accent
                        : "rgba(247,242,232,.55)",
                    transition: "width .2s, background .2s",
                  }}
                />
              ))}
            </span>
          )}
        </button>
      ) : (
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
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={labelId}
        className="m-0 h-screen w-screen max-w-none bg-transparent p-0 backdrop:bg-[#0a1417]"
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        onClose={resetZoom}
      >
        {/* s41 redesign: panel CREAM -> contenedor full-screen OPACO #0a1417.
            La foto FLOTA; el fondo opaco no transparenta la pagina (sin fantasma). */}
        <div
          className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
          style={{ background: "#0a1417", padding: 16 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          {/* titulo CLARO (legible sobre oscuro) */}
          <h3
            id={labelId}
            className="absolute top-5 left-5 z-10 text-base font-semibold"
            style={{
              fontFamily: design.fonts.heading,
              color: "#f6f1e8",
              textShadow: "0 1px 10px rgba(0,0,0,.55)",
            }}
          >
            {title}
          </h3>
          {/* cerrar COBRE, flotante arriba-derecha (visible sobre oscuro) */}
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar galería"
            className="absolute top-4 right-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full text-xl focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              background: design.colors.accent,
              color: "#10242a",
              outlineColor: design.colors.accent,
              boxShadow: "0 4px 14px -4px rgba(0,0,0,.6)",
            }}
          >
            <span aria-hidden="true">✕</span>
          </button>

          {/* stage 3:2 capado al viewport (sin scrollbar) + foto rounded + sombra */}
          <div
            ref={stageRef}
            onMouseMove={onStageMove}
            onTouchStart={onStageTouchStart}
            onTouchEnd={onStageTouchEnd}
            className="relative aspect-[3/2] overflow-hidden rounded-xl"
            style={{
              width: "min(100%, calc((92vh - 150px) * 1.5))",
              maxHeight: "calc(92vh - 96px)",
              background: "#0a1417",
              boxShadow: "0 24px 70px -24px rgba(0,0,0,.85)",
              touchAction: "none",
              cursor: scale > 1 ? "zoom-out" : "zoom-in",
            }}
          >
            <Image
              key={index}
              src={slides[index]}
              alt={`${title} — foto ${index + 1} de ${total}`}
              fill
              className="object-contain"
              sizes="92vw"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: "center center",
                transition: "transform .14s ease-out",
              }}
            />
            {/* flechas LATERALES centradas — SOLO desktop pointer:fine (CSS .pv-vis-arrow).
                Movil: ocultas -> navega por swipe del stage. */}
            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prev();
                  }}
                  aria-label="Foto anterior"
                  className="pv-vis-arrow pv-vis-arrow--prev"
                  style={{ outlineColor: design.colors.accent }}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    next();
                  }}
                  aria-label="Foto siguiente"
                  className="pv-vis-arrow pv-vis-arrow--next"
                  style={{ outlineColor: design.colors.accent }}
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
              </>
            )}
          </div>

          {/* contador + dots CLAROS (debajo) */}
          {total > 1 && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <span
                className="text-sm font-medium"
                aria-live="polite"
                style={{ color: "rgba(247,242,232,.9)" }}
              >
                <b style={{ color: design.colors.accent }}>{index + 1}</b> /{" "}
                {total}
              </span>
              <div className="flex items-center" style={{ gap: 7 }}>
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setIndex(i);
                      resetZoom();
                    }}
                    aria-label={`Ver foto ${i + 1}`}
                    style={{
                      width: i === index ? 20 : 7,
                      height: 7,
                      borderRadius: 999,
                      border: 0,
                      padding: 0,
                      cursor: "pointer",
                      background:
                        i === index
                          ? design.colors.accent
                          : "rgba(247,242,232,.4)",
                      transition: "width .2s, background .2s",
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
