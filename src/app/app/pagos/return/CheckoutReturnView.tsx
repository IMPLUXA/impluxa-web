import Link from "next/link";
import styles from "./return.module.css";

export type CheckoutReturnState = "approved" | "pending" | "failure";

// C-COBRO-MP C1 — vista presentacional ("Momento PV") del retorno post-checkout MP.
// Server component puro (sin next/font ni guards → testeable en jsdom). NO afirma
// "confirmado": la confirmación real es asíncrona vía webhook, así que la página dice
// "en confirmación". El estado y el href host-aware los resuelve la page.
const COPY: Record<
  CheckoutReturnState,
  { title: string; body: string; cta: string }
> = {
  approved: {
    title: "Pago iniciado",
    body: "Estamos confirmando el pago con MercadoPago. La reserva se confirma sola apenas nos avisa, en unos segundos.",
    cta: "Volver a reservas",
  },
  pending: {
    title: "Pago pendiente",
    body: "MercadoPago dejó el pago en revisión. Cuando se apruebe, la reserva se confirma automáticamente.",
    cta: "Volver a reservas",
  },
  failure: {
    title: "Pago no completado",
    body: "El pago se canceló o fue rechazado. La pre-reserva sigue activa hasta que venza el hold; podés reintentar.",
    cta: "Volver a reservas",
  },
};

function Seal({ state }: { state: CheckoutReturnState }) {
  if (state === "approved") {
    return (
      <span className={`${styles.seal} ${styles.sealOk}`} aria-hidden>
        <svg viewBox="0 0 24 24">
          <path
            d="M5 13l4 4 10-10"
            stroke="#F0E6D2"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (state === "pending") {
    return (
      <span className={`${styles.seal} ${styles.sealWarn}`} aria-hidden>
        <svg viewBox="0 0 24 24">
          <path
            d="M12 7v6"
            stroke="#10242a"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="12" cy="17" r="1.3" fill="#10242a" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`${styles.seal} ${styles.sealBad}`} aria-hidden>
      <svg viewBox="0 0 24 24">
        <path
          d="M7 7l10 10M17 7L7 17"
          stroke="#F0E6D2"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function CheckoutReturnView({
  state,
  backHref,
}: {
  state: CheckoutReturnState;
  backHref: string;
}) {
  const c = COPY[state];
  return (
    // div (no <main>): evita anidar landmark dentro del <main> del layout del admin
    // (Two-Pass cold C1, a11y). La sección agrupa el contenido del estado.
    <div className={styles.page}>
      <section className={styles.card}>
        <Seal state={state} />
        <h1 className={styles.title}>{c.title}</h1>
        <p className={styles.body}>{c.body}</p>
        <Link
          href={backHref}
          className={`${styles.pill} ${state === "pending" ? styles.pillGhost : ""}`}
        >
          {c.cta}
        </Link>
      </section>
    </div>
  );
}
