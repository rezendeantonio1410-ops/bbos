/**
 * "Próximos vencimentos": open receivables grouped by due day and by horizon
 * (overdue, 7 days, 8–15, 16–30, later), always on the São Paulo calendar so a
 * title due at 23:34 UTC still lands on its Brazilian day.
 */

export type AgendaReceivable = {
  id: string;
  dueDate: string;
  openAmount: number | string;
  status: string;
  customer?: { name?: string | null } | null;
  invoiceId?: string | null;
  salesOrder?: { code?: string | null; orderNumber?: string | null } | null;
};

export type HorizonKey = "overdue" | "week" | "fortnight" | "month" | "later";

export const HORIZONS: Array<{ key: HorizonKey; label: string; from: number; to: number }> = [
  { key: "overdue", label: "Vencidos", from: -Infinity, to: -1 },
  { key: "week", label: "Próximos 7 dias", from: 0, to: 7 },
  { key: "fortnight", label: "8 a 15 dias", from: 8, to: 15 },
  { key: "month", label: "16 a 30 dias", from: 16, to: 30 },
  { key: "later", label: "Depois de 30 dias", from: 31, to: Infinity },
];

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** "2026-11-25" on the São Paulo calendar. */
export function spDay(value: string | Date) {
  return dayFormat.format(typeof value === "string" ? new Date(value) : value);
}

function dayNumber(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86_400_000;
}

/** Whole days from today to the due day (negative when overdue). */
export function daysUntil(dueDate: string, today: Date = new Date()) {
  return dayNumber(spDay(dueDate)) - dayNumber(spDay(today));
}

export function isOpen(row: AgendaReceivable) {
  return !["PAID", "CANCELLED"].includes(row.status) && Number(row.openAmount) > 0.004;
}

export function horizonOf(days: number): HorizonKey {
  return HORIZONS.find((h) => days >= h.from && days <= h.to)!.key;
}

export function horizonTotals(rows: AgendaReceivable[], today: Date = new Date()) {
  const totals = Object.fromEntries(HORIZONS.map((h) => [h.key, { amount: 0, count: 0 }])) as Record<HorizonKey, { amount: number; count: number }>;
  for (const row of rows) {
    if (!isOpen(row)) continue;
    const bucket = totals[horizonOf(daysUntil(row.dueDate, today))];
    bucket.amount += Number(row.openAmount);
    bucket.count += 1;
  }
  return totals;
}

const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });

/** "Hoje", "Amanhã", "Ontem", or "sex., 28/11". */
export function dayLabel(key: string, today: Date = new Date()) {
  const diff = dayNumber(key) - dayNumber(spDay(today));
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  const [, m, d] = key.split("-");
  return `${weekday.format(new Date(dayNumber(key) * 86_400_000))}, ${d}/${m}`;
}

export type AgendaDay<T extends AgendaReceivable> = { key: string; label: string; days: number; total: number; rows: T[] };

/** Open receivables in the chosen horizon, grouped by due day, earliest first. */
export function agendaDays<T extends AgendaReceivable>(rows: T[], horizon: HorizonKey | "next30", today: Date = new Date()): Array<AgendaDay<T>> {
  const groups = new Map<string, AgendaDay<T>>();
  const open = rows
    .filter(isOpen)
    .filter((row) => {
      const days = daysUntil(row.dueDate, today);
      return horizon === "next30" ? days <= 30 : horizonOf(days) === horizon;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  for (const row of open) {
    const key = spDay(row.dueDate);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: dayLabel(key, today), days: daysUntil(row.dueDate, today), total: 0, rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row);
    group.total += Number(row.openAmount);
  }
  return [...groups.values()];
}
