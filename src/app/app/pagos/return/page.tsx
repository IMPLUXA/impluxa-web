import { Cinzel, Hanken_Grotesk } from "next/font/google";
import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getAdminBasePath } from "@/lib/urls";
import {
  CheckoutReturnView,
  type CheckoutReturnState,
} from "./CheckoutReturnView";

// C-COBRO-MP C1 — retorno post-checkout MercadoPago, HOST-AWARE. Página NUEVA: hoy NADIE la
// enlaza (el botón de cobro es C2); el back_urls de pago-mp ya apunta acá pero sólo se
// ejerce cuando hay un pago. DORMANT-SHIP: no cambia ningún render existente.
//
// Gate: requiere tenant activo (miembro logueado). NO dueño-only: el encargado que cobra
// también aterriza acá (canCharge = encargado|dueño). La página NO lee datos sensibles de DB
// (el estado sale del ?r de la URL), así que el gate de sesión alcanza.
//
// Aislamiento Hakuna: Cinzel/Hanken se cablean A NIVEL DE PÁGINA (next/font scoped, no en un
// layout compartido) y la piel es un CSS MODULE scopeado → CERO templates/eventos, CERO .pv-*.
export const dynamic = "force-dynamic";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// approved o ausente/desconocido → "en confirmación" (NUNCA afirma "confirmado"; la verdad
// es el webhook). Default a approved = el caso común + copy neutral. `r` es display-only.
function toState(r: string | undefined): CheckoutReturnState {
  if (r === "pending") return "pending";
  if (r === "failure") return "failure";
  return "approved";
}

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  await requireActiveTenantOrRedirect();
  const { r } = await searchParams;
  const adminBase = await getAdminBasePath();
  const backHref = `${adminBase}/agency/reservas`;
  return (
    <div className={`${cinzel.variable} ${hanken.variable}`}>
      <CheckoutReturnView state={toState(r)} backHref={backHref} />
    </div>
  );
}
