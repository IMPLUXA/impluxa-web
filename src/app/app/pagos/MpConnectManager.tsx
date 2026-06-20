"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// UI-connect MP (s57): manager del estado de conexión MercadoPago en el panel del dueño.
// Recibe el estado YA resuelto server-side (mp_connection_status, NUNCA el token) y ofrece
// Conectar / Desconectar / Cambiar cuenta. La autoridad real es el guard server-side de la
// page (dueño-only) + los endpoints; esto es la capa de interacción.

export type MpConnState = {
  connected: boolean;
  status?: string | null;
  mpUserId?: string | null;
  connectedAt?: string | null;
};

const AUTHORIZE_URL = "/api/mp/oauth/authorize";
const DISCONNECT_URL = "/api/mp/oauth/disconnect";

type PendingPrompt = { pending: number; next: "disconnect" | "switch" };

function formatFecha(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function MpConnectManager({
  state,
  loadError = false,
}: {
  state: MpConnState;
  loadError?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const mpResult = params.get("mp"); // "connected" | "error" | otros

  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<PendingPrompt | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function callDisconnect(
    confirm: boolean,
  ): Promise<{ disconnected: boolean; pending: number } | null> {
    const res = await fetch(DISCONNECT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      disconnected?: boolean;
      pending?: number;
    } | null;
    if (!res.ok || !data?.ok) {
      setErrorMsg("No se pudo desconectar. Probá de nuevo en un momento.");
      return null;
    }
    return { disconnected: !!data.disconnected, pending: data.pending ?? 0 };
  }

  async function run(next: "disconnect" | "switch", confirm: boolean) {
    setBusy(true);
    setErrorMsg(null);
    const r = await callDisconnect(confirm);
    setBusy(false);
    if (!r) {
      // Two-Pass cold T1: si la llamada falló, cerrar el modal para que el banner de
      // error quede visible y no se acumule un doble-UI ambiguo (modal + error detrás).
      setPrompt(null);
      return;
    }
    // Hay pendientes y no se confirmó todavía → pedir confirmación explícita.
    if (!r.disconnected) {
      setPrompt({ pending: r.pending, next });
      return;
    }
    setPrompt(null);
    if (next === "switch") {
      // Cambiar cuenta = desconectar + conectar: ya revocó, ahora al authorize.
      window.location.href = AUTHORIZE_URL;
      return;
    }
    router.refresh();
  }

  const fecha = formatFecha(state.connectedAt);

  return (
    <div className="space-y-4">
      {mpResult === "connected" && (
        <div className="rounded-[12px] border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-800">
          Cuenta de MercadoPago conectada.
        </div>
      )}
      {mpResult === "error" && (
        <div className="rounded-[12px] border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">
          No se pudo completar la conexión con MercadoPago. Intentá de nuevo.
        </div>
      )}
      {errorMsg && (
        <div className="rounded-[12px] border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <div className="bg-marble border-stone/60 rounded-[14px] border p-6 shadow-[0_10px_26px_rgba(20,48,56,0.07)]">
        {loadError ? (
          // Two-Pass cold P4: si el RPC de estado falló, NO mostrar "No conectado"
          // (engañoso para un dueño que SÍ está conectado). Estado explícito.
          <>
            <div className="flex items-center gap-2">
              <span className="bg-ash/40 inline-block h-2.5 w-2.5 rounded-full" />
              <span className="font-semibold">Estado no disponible</span>
            </div>
            <p className="text-ash mt-2 text-sm">
              No pudimos cargar el estado de conexión con MercadoPago. Recargá
              la página o reintentá en un momento.
            </p>
          </>
        ) : state.connected ? (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
              <span className="font-semibold">Conectado</span>
            </div>
            <div className="text-ash mt-3 space-y-1 text-sm">
              {state.mpUserId && (
                <div>
                  Cuenta MercadoPago:{" "}
                  <span className="font-medium">{state.mpUserId}</span>
                </div>
              )}
              {fecha && <div>Conectada desde el {fecha}.</div>}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => run("disconnect", false)}
                className="border-stone hover:bg-stone/30 rounded-[10px] border px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Desconectar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run("switch", false)}
                className="border-stone hover:bg-stone/30 rounded-[10px] border px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Cambiar cuenta
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="bg-ash/40 inline-block h-2.5 w-2.5 rounded-full" />
              <span className="font-semibold">No conectado</span>
            </div>
            <p className="text-ash mt-2 text-sm">
              Conectá tu cuenta de MercadoPago para cobrar las reservas con
              tarjeta. La plata va 100% a tu cuenta.
            </p>
            <a
              href={AUTHORIZE_URL}
              className="bg-pine mt-5 inline-block rounded-[10px] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Conectar MercadoPago
            </a>
          </>
        )}
      </div>

      {prompt && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cancelar"
            onClick={() => setPrompt(null)}
            className="absolute inset-0 w-full cursor-default bg-black/40"
          />
          {/* Two-Pass cold T3: role=dialog en el panel (no en el contenedor que también
              envuelve el backdrop). T2: Escape cierra (foco inicial en Cancelar). */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mp-disconnect-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setPrompt(null);
            }}
            className="bg-marble relative w-full max-w-md rounded-[16px] p-6 shadow-xl"
          >
            <h2 id="mp-disconnect-title" className="text-lg font-bold">
              ¿Desconectar MercadoPago?
            </h2>
            <p className="text-ash mt-3 text-sm leading-relaxed">
              Hay <span className="font-semibold">{prompt.pending}</span>{" "}
              {prompt.pending === 1
                ? "cobro de MercadoPago pendiente"
                : "cobros de MercadoPago pendientes"}
              . Si desconectás, no se van a confirmar solos hasta que vuelvas a
              conectar la cuenta.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                autoFocus
                type="button"
                disabled={busy}
                onClick={() => setPrompt(null)}
                className="border-stone hover:bg-stone/30 rounded-[10px] border px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(prompt.next, true)}
                className="rounded-[10px] bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {prompt.next === "switch"
                  ? "Desconectar y cambiar"
                  : "Desconectar igual"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
