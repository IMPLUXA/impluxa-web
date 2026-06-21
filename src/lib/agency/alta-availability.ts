// F1c — disponibilidad del (excursion, fecha) elegido en el alta de reservas.
//
// FUENTE UNICA del cupo: el read-model compartido `agency_calendario_salidas`
// (via GET /api/agency/departures/calendario, single-day). Esto NO duplica la
// logica de cupo — la deriva del envelope del read-model. La autoridad final es
// el motor `agency_crear_reserva` (#24), que re-chequea bajo su advisory-lock al
// crear. Esta capa es PRE-AVISO de UX + gating del boton.

export type Avail =
  | { state: "idle" | "loading" | "error" | "cap_null" }
  | { state: "open" | "limited" | "closed"; cap: number; restante: number };

// Forma minima del envelope del read-model que el alta consume (single-day).
export type CalendarDayLite = {
  fecha: string;
  estado: "open" | "limited" | "closed";
  eff_cap: number;
  restante: number;
};
export type CalendarRespLite = {
  ok?: boolean;
  capacity_default?: number | null;
  dias?: CalendarDayLite[];
};

// Deriva el estado de disponibilidad del envelope del read-model para una fecha.
// httpOk = la respuesta HTTP fue 2xx. Dia VIRGEN (sin fila ancla) => abierto al
// capacity_default. cap_default NULL => excursion no configurada para reservar
// (Two-Pass FIX F2: el guard vive aca, en el handler de la respuesta, NO como
// filtro del <select> — capacity_default no esta en ExcursionRow).
export function availFromResponse(
  body: CalendarRespLite,
  fecha: string,
  httpOk: boolean,
): Avail {
  if (!httpOk || !body.ok) return { state: "error" };
  if (body.capacity_default == null) return { state: "cap_null" };
  const day = (body.dias ?? []).find((d) => d.fecha === fecha);
  if (!day)
    return {
      state: "open",
      cap: body.capacity_default,
      restante: body.capacity_default,
    };
  return { state: day.estado, cap: day.eff_cap, restante: day.restante };
}

// Texto + tono para la linea de disponibilidad.
export function availLabel(a: Avail): {
  text: string;
  tone: "open" | "limited" | "closed" | "muted";
} {
  switch (a.state) {
    case "idle":
      return { text: "Elegí una excursión y una fecha", tone: "muted" };
    case "loading":
      return { text: "Consultando disponibilidad…", tone: "muted" };
    case "error":
      return {
        text: "No pudimos verificar el cupo. El sistema lo valida al crear.",
        tone: "muted",
      };
    case "cap_null":
      return {
        text: "Esta excursión no está disponible para reservar",
        tone: "closed",
      };
    case "closed":
      return { text: "Día cerrado — elegí otra fecha", tone: "closed" };
    case "open":
    case "limited":
      if (a.restante <= 0)
        return { text: "Sin cupo para esa fecha — elegí otra", tone: "closed" };
      return {
        text:
          a.state === "limited"
            ? `Cupo limitado a ${a.cap} · quedan ${a.restante}`
            : `Abierto · cupo ${a.cap} · quedan ${a.restante}`,
        tone: a.state === "limited" ? "limited" : "open",
      };
  }
}

// Gating del boton "Crear reserva". Bloquea cuando el dia NO admite reservas con
// el dia seleccionado: cerrado / sin cupo / no configurada / aun consultando.
// El estado `error` NO bloquea: el motor #24 es el gate final (no dejar al
// usuario trabado por un fallo transitorio del pre-aviso).
export function availBlocks(a: Avail): boolean {
  switch (a.state) {
    case "idle":
    case "loading":
    case "cap_null":
    case "closed":
      return true;
    case "open":
    case "limited":
      return a.restante <= 0;
    case "error":
      return false;
  }
}
