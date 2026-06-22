"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { EventosDesign } from "../schema";

// F4 — voucher ON-SITE al volver de Mercado Pago. El Checkout Pro es un redirect full-page; el
// turista vuelve a la home del tenant con ?mp=return&st=<outcome>. Este componente lo detecta y
// muestra el voucher (paso 5 del wizard). La fuente de verdad del voucher es el EMAIL (asíncrono,
// lo dispara el webhook al confirmar); esto es la confirmación inmediata en pantalla.
//
// BYTE-IDENTIDAD HAKUNA: se monta SOLO para tenants con reservas (gate en Site.tsx, igual que el
// modal). Render inicial = null (visible arranca en false; se enciende en useEffect client-side) →
// cero delta en el HTML servido.

const arsFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const GREEN = "#3F7D5A";

type ReturnData = {
  code?: string;
  excursionTitle?: string;
  dateLabel?: string;
  pax?: number;
  totalArs?: number;
};

export function ReservaReturn({
  design,
  tenantName,
  logoUrl,
  address,
  phone,
  waHref,
}: {
  design: EventosDesign;
  tenantName: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  waHref?: string | null;
}) {
  const pine = design.colors.primary;
  const heading = design.fonts.heading;

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"approved" | "pending" | "failure">(
    "approved",
  );
  const [data, setData] = useState<ReturnData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mp") !== "return") return;
    const st = params.get("st");
    setStatus(
      st === "pending" ? "pending" : st === "failure" ? "failure" : "approved",
    );
    try {
      const raw = sessionStorage.getItem("pv_reserva_return");
      if (raw) setData(JSON.parse(raw) as ReturnData);
    } catch {
      /* sessionStorage no disponible: mostramos el voucher genérico igual */
    }
    setOpen(true);
  }, []);

  function close() {
    setOpen(false);
    try {
      sessionStorage.removeItem("pv_reserva_return");
    } catch {
      /* noop */
    }
    // Limpia la query para que un refresh no re-dispare el overlay.
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("mp");
      u.searchParams.delete("st");
      window.history.replaceState({}, "", u.pathname + u.search + u.hash);
    } catch {
      /* noop */
    }
  }

  if (!open) return null;

  const addr = [address, phone].filter(Boolean).join(" · ");
  const heroTitle =
    status === "approved"
      ? "¡Reserva confirmada!"
      : status === "pending"
        ? "Tu pago está en proceso"
        : "El pago no se completó";
  const heroSub =
    status === "approved"
      ? "Te enviamos el voucher con tu código a tu email."
      : status === "pending"
        ? "Cuando Mercado Pago confirme el pago, te llega el voucher por email."
        : "Tu reserva sigue guardada un ratito. Podés reintentar el pago o coordinar por WhatsApp.";

  return createPortal(
    <div
      className="rr-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Comprobante de reserva"
      onClick={close}
    >
      <div className="rr-card" onClick={(e) => e.stopPropagation()}>
        {/* letterhead oscuro con logo (blanco sobre oscuro) o el nombre del tenant */}
        <div
          style={{
            background: `linear-gradient(135deg, ${pine}, #0d2026)`,
            borderBottom: `3px solid ${design.colors.accent}`,
            padding: "22px 22px 18px",
            textAlign: "center",
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={tenantName}
              style={{
                height: 56,
                maxWidth: 240,
                display: "block",
                margin: "0 auto",
                filter: "drop-shadow(0 3px 8px rgba(0,0,0,.45))",
              }}
            />
          ) : (
            <div
              style={{
                fontFamily: heading,
                color: "#fff",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {tenantName}
            </div>
          )}
          {addr && (
            <div style={{ color: "#cfd8d6", fontSize: 11.5, marginTop: 9 }}>
              {addr}
            </div>
          )}
        </div>

        <div style={{ padding: "22px 22px 6px", textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: status === "failure" ? "#b3261e" : GREEN,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              margin: "0 auto 10px",
            }}
          >
            {status === "failure" ? "×" : status === "pending" ? "⏳" : "✓"}
          </div>
          <div
            style={{
              fontFamily: heading,
              color: pine,
              fontSize: 21,
              fontWeight: 700,
            }}
          >
            {heroTitle}
          </div>
          {data?.excursionTitle && (
            <div style={{ color: "#5a635f", fontSize: 14, marginTop: 3 }}>
              {data.excursionTitle}
            </div>
          )}
          <p
            style={{
              fontSize: 13,
              color: "#5a635f",
              margin: "8px auto 0",
              maxWidth: 360,
            }}
          >
            {heroSub}
          </p>
        </div>

        {/* detalle (si hay datos del mismo tab) */}
        {data && (data.dateLabel || data.pax || data.totalArs) && (
          <div style={{ padding: "8px 22px 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {data.dateLabel && (
                  <tr>
                    <td
                      style={{
                        padding: "5px 0",
                        color: "#6b736f",
                        fontSize: 13,
                      }}
                    >
                      Fecha de salida
                    </td>
                    <td
                      style={{
                        padding: "5px 0",
                        color: pine,
                        fontSize: 14,
                        fontWeight: 700,
                        textAlign: "right",
                        textTransform: "capitalize",
                      }}
                    >
                      {data.dateLabel}
                    </td>
                  </tr>
                )}
                {data.pax != null && (
                  <tr>
                    <td
                      style={{
                        padding: "5px 0",
                        color: "#6b736f",
                        fontSize: 13,
                      }}
                    >
                      Pasajeros
                    </td>
                    <td
                      style={{
                        padding: "5px 0",
                        color: pine,
                        fontSize: 14,
                        fontWeight: 700,
                        textAlign: "right",
                      }}
                    >
                      {data.pax}
                    </td>
                  </tr>
                )}
                {data.totalArs != null && (
                  <tr>
                    <td
                      style={{
                        padding: "5px 0",
                        color: "#6b736f",
                        fontSize: 13,
                      }}
                    >
                      Total
                    </td>
                    <td
                      style={{
                        padding: "5px 0",
                        color: status === "approved" ? GREEN : pine,
                        fontSize: 14,
                        fontWeight: 700,
                        textAlign: "right",
                      }}
                    >
                      {arsFmt.format(data.totalArs)}
                      {status === "approved" ? " · Pagado" : ""}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* código */}
        {data?.code && (
          <div style={{ padding: "14px 22px 4px" }}>
            <div
              style={{
                background: pine,
                borderRadius: 12,
                padding: "14px 16px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  color: "#9fb4b0",
                  fontSize: 10.5,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                }}
              >
                Código de reserva
              </div>
              <div
                style={{
                  color: "#fff",
                  fontFamily: heading,
                  fontSize: 30,
                  fontWeight: 700,
                  letterSpacing: ".10em",
                  marginTop: 4,
                }}
              >
                {data.code}
              </div>
              <div style={{ color: "#9fb4b0", fontSize: 11.5, marginTop: 6 }}>
                Presentalo el día de la salida
              </div>
            </div>
          </div>
        )}

        <div className="rr-foot">
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rr-btn"
              style={{
                background: "#25D366",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              Coordinar por WhatsApp ›
            </a>
          )}
          <button
            type="button"
            className="rr-btn ghost"
            onClick={close}
            style={{ marginLeft: "auto" }}
          >
            Cerrar
          </button>
        </div>

        <div
          style={{
            padding: "14px 22px 18px",
            textAlign: "center",
            color: "#8a918c",
            fontSize: 11.5,
          }}
        >
          {tenantName} · ¡Gracias por tu reserva!
        </div>
      </div>

      <style>{`
        .rr-overlay{position:fixed;inset:0;z-index:1000;background:rgba(20,48,56,.62);
          display:flex;align-items:flex-start;justify-content:center;padding:36px 20px;
          overflow-y:auto;overscroll-behavior:contain}
        .rr-card{width:100%;max-width:520px;background:#FBF7EE;border:1px solid #E6DCC4;
          border-radius:22px;box-shadow:0 40px 90px -28px rgba(20,48,56,.72);
          overflow:hidden auto;max-height:calc(100dvh - 72px);
          font-family:var(--font-hanken,inherit);color:#1E2B2C}
        .rr-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 22px 4px}
        .rr-btn{display:inline-flex;align-items:center;gap:8px;border:none;border-radius:999px;
          padding:12px 22px;font-size:14.5px;font-weight:700;cursor:pointer;font-family:inherit}
        .rr-btn.ghost{background:#fff;border:1px solid #E6DCC4;color:#143038}
        @media (max-width:560px){
          .rr-overlay{padding:0;align-items:stretch}
          .rr-card{max-width:none;max-height:none;min-height:100dvh;border-radius:0;border:none}
        }
      `}</style>
    </div>,
    document.body,
  );
}
