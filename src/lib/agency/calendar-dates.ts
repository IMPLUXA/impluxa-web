// Helpers de grilla de calendario (compartidos por las vistas del panel). Fechas como DATE puro
// (sin TZ): el calendario muestra dias del calendario AR, no instantes.

export const DOW = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"] as const;

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export function monthLabel(year: number, month0: number): string {
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month0, 1)));
}

/** Offset Lunes-base del 1ro del mes (0=Lun .. 6=Dom) para las celdas vacias de relleno. */
export function firstWeekdayMon(year: number, month0: number): number {
  const dow = new Date(Date.UTC(year, month0, 1)).getUTCDay(); // 0=Dom..6=Sab
  return (dow + 6) % 7;
}

/** Rango ISO {from,to} del mes (primer..ultimo dia). */
export function monthRange(
  year: number,
  month0: number,
): { from: string; to: string } {
  const last = daysInMonth(year, month0);
  return {
    from: `${year}-${pad2(month0 + 1)}-01`,
    to: `${year}-${pad2(month0 + 1)}-${pad2(last)}`,
  };
}

export type MonthCell = { iso: string; day: number; past: boolean } | null;

/** Celdas del mes (Lun-Dom), con `null` de relleno antes del 1ro. */
export function buildMonthCells(
  year: number,
  month0: number,
  today: string,
): MonthCell[] {
  const lead = firstWeekdayMon(year, month0);
  const n = daysInMonth(year, month0);
  const cells: MonthCell[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= n; d++) {
    const iso = `${year}-${pad2(month0 + 1)}-${pad2(d)}`;
    cells.push({ iso, day: d, past: iso < today });
  }
  return cells;
}
