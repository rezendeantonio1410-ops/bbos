import type { CashFlowLine } from "./finance-cashflow";
import { daysUntil, spDay } from "./receivable-agenda";

/**
 * Previsão do caixa dia a dia (rascunho aprovado em 26/11): saldo do banco
 * hoje + títulos lançados no BBOS + despesas fixas previstas pelo extrato.
 * Vencidos ficam fora da linha e aparecem como alerta.
 */

export type RecurringExpense = { id: string; label: string; category: string; amount: number; dayOfMonth: number; active: boolean };
export type ForecastEvent = { id: string; date: string; label: string; detail: string; amount: number; kind: "lancado" | "previsto"; href: string; title?: string };

/** Rótulo de um dia com vários previstos: "IRPJ e CSLL", "Aluguel, Internet e Energia". */
export function plannedLabel(events: Array<Pick<ForecastEvent, "title" | "detail">>) {
  const names = [...new Set(events.map((e) => e.title ?? e.detail).filter(Boolean))];
  return names.length <= 1 ? names[0] ?? "Previsto" : `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

/** Nome curto de uma linha prevista ("IRPJ", "CSLL"), sem a fórmula do cálculo. */
export function plannedTitle(line: { kind: string; document?: string | null; counterparty?: string | null }) {
  if (line.kind === "TAX") return String(line.document ?? "Imposto").replace(/\s*\(estimativa[^)]*\)/i, "").replace(/\s+\d{2}\/\d{4}$/, "").trim() || "Imposto";
  if (line.kind === "PURCHASE") return `Café verde · ${line.counterparty ?? "fornecedor"}`;
  return undefined;
}
export type ForecastDay = { date: string; balance: number; events: ForecastEvent[]; inflow: number; outflow: number };
export type ForecastWeek = { from: string; to: string; start: number; inflow: number; outflow: number; end: number; events: ForecastEvent[]; low: boolean };
export type ForecastAlert = { key: string; tone: "red" | "amber" | "info"; title: string; detail: string; action: string; href: string };

const DAY = 86_400_000;
const isoOf = (date: Date) => spDay(date);
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const brl = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
const shortDate = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const round = (value: number) => Math.round(value * 100) / 100;

/** Ocorrências mensais da despesa fixa entre amanhã e o fim do horizonte. */
export function recurringOccurrences(expense: RecurringExpense, today: string, horizonEnd: string): string[] {
  if (!expense.active) return [];
  const out: string[] = [];
  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7)) - 1;
  for (let i = 0; i < 14; i++) {
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const iso = new Date(Date.UTC(year, month, Math.min(expense.dayOfMonth, last), 12)).toISOString().slice(0, 10);
    if (iso > horizonEnd) break;
    if (iso > today) out.push(iso);
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  return out;
}

export function buildForecast(input: {
  startBalance: number;
  lines: CashFlowLine[];
  recurring: RecurringExpense[];
  horizonDays: number;
  minimum: number;
  today?: Date;
}) {
  const todayIso = isoOf(input.today ?? new Date());
  const end = addDays(todayIso, input.horizonDays);
  const events: ForecastEvent[] = [];
  const overdueIn: CashFlowLine[] = [];
  const overdueOut: CashFlowLine[] = [];
  for (const line of input.lines) {
    const d = daysUntil(line.dueDate, input.today ?? new Date());
    if (d < 0) { (line.signedAmount >= 0 ? overdueIn : overdueOut).push(line); continue; }
    if (d > input.horizonDays) continue;
    events.push({
      id: line.id,
      date: addDays(todayIso, d),
      label: line.counterparty,
      detail: line.kind === "RECEIVABLE" ? line.document : line.description,
      amount: line.signedAmount,
      // Impostos e compras ainda sem conta a pagar são estimativas.
      kind: line.kind === "TAX" || line.kind === "PURCHASE" ? "previsto" : "lancado",
      href: line.kind === "RECEIVABLE" ? "/financeiro/receber" : line.kind === "TAX" ? "/financeiro/parametros" : "/financeiro/pagar",
      title: plannedTitle(line),
    });
  }
  for (const expense of input.recurring)
    for (const date of recurringOccurrences(expense, todayIso, end))
      events.push({ id: `${expense.id}:${date}`, date, label: expense.label, detail: expense.category, amount: -expense.amount, kind: "previsto", href: "#previstas" });
  events.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);

  const days: ForecastDay[] = [];
  let balance = input.startBalance;
  for (let i = 0; i <= input.horizonDays; i++) {
    const date = addDays(todayIso, i);
    const dayEvents = events.filter((e) => e.date === date);
    const inflow = dayEvents.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const outflow = dayEvents.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0);
    balance = round(balance + inflow - outflow);
    days.push({ date, balance, events: dayEvents, inflow: round(inflow), outflow: round(outflow) });
  }

  const weeks: ForecastWeek[] = [];
  for (let i = 0; i < days.length; ) {
    // Semanas de segunda a domingo; a primeira começa hoje.
    const first = days[i]!;
    const weekday = new Date(`${first.date}T12:00:00Z`).getUTCDay();
    const length = i === 0 ? ((7 - weekday) % 7) + 1 : 7;
    const slice = days.slice(i, i + length);
    const start = i === 0 ? input.startBalance : days[i - 1]!.balance;
    const last = slice.at(-1)!;
    weeks.push({
      from: first.date,
      to: last.date,
      start,
      inflow: round(slice.reduce((s, d) => s + d.inflow, 0)),
      outflow: round(slice.reduce((s, d) => s + d.outflow, 0)),
      end: last.balance,
      events: slice.flatMap((d) => d.events),
      low: slice.some((d) => d.balance < input.minimum),
    });
    i += length;
  }

  const worst = days.reduce((min, day) => (day.balance < min.balance ? day : min), days[0]!);
  const firstBelow = days.find((day) => day.balance < input.minimum) ?? null;
  const inflow = round(events.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0));
  const outflowLaunched = round(events.filter((e) => e.amount < 0 && e.kind === "lancado").reduce((s, e) => s - e.amount, 0));
  const outflowRecurring = round(events.filter((e) => e.amount < 0 && e.kind === "previsto").reduce((s, e) => s - e.amount, 0));
  const overdueReceivable = round(overdueIn.reduce((s, l) => s + l.amount, 0));
  const overduePayable = round(overdueOut.reduce((s, l) => s + l.amount, 0));

  const alerts: ForecastAlert[] = [];
  if (firstBelow) {
    // O alerta aponta o pior dia e o que o causa (ex.: aluguel no dia 10).
    const cause = [...worst.events].sort((x, y) => x.amount - y.amount)[0];
    const index = days.indexOf(worst);
    const before = index > 0 ? days[index - 1]!.balance : input.startBalance;
    const already = firstBelow.date === todayIso ? `Hoje o saldo (${brl(input.startBalance)}) já está abaixo do mínimo de ${brl(input.minimum)}. ` : "";
    alerts.push({
      key: "low",
      tone: worst.balance < 0 ? "red" : "amber",
      title: worst.date === todayIso ? `O caixa está abaixo do mínimo de ${brl(input.minimum)}` : `Dia ${shortDate(worst.date)} o caixa cai para ${brl(worst.balance)}`,
      detail: cause && cause.amount < 0 && worst.date !== todayIso
        ? `${already}${cause.label} (${brl(-cause.amount)}) leva o saldo de ${brl(before)} para ${brl(worst.balance)}, o menor saldo do período.`
        : `${already}Lance as entradas previstas ou reduza saídas para voltar ao mínimo.`,
      action: `Ver o dia ${shortDate(worst.date)}`,
      href: `#dia-${worst.date}`,
    });
  }
  if (overdueReceivable > 0) {
    const names = overdueIn.slice(0, 3).map((l) => `${l.counterparty} ${brl(l.amount)}`).join(" · ");
    const improved = round(worst.balance + overdueReceivable);
    alerts.push({
      key: "overdue",
      tone: "red",
      title: `${brl(overdueReceivable)} vencidos para cobrar`,
      detail: `${names}.${firstBelow && worst.date !== todayIso ? ` Recebendo antes do dia ${shortDate(worst.date)}, o pior dia sobe de ${brl(worst.balance)} para ${brl(improved)}.` : ""}`,
      action: "Cobrar agora",
      href: "/financeiro/receber",
    });
  }
  const activeRecurring = input.recurring.filter((r) => r.active);
  if (activeRecurring.length)
    alerts.push({
      key: "recurring",
      tone: "info",
      title: `${activeRecurring.length} ${activeRecurring.length === 1 ? "despesa fixa prevista" : "despesas fixas previstas"} pelo extrato`,
      detail: `${activeRecurring.slice(0, 4).map((r) => r.label.split(" ")[0]).join(", ")}${activeRecurring.length > 4 ? "…" : ""} se repetem todo mês. Confira valores e dias.`,
      action: "Revisar previstas",
      href: "#previstas",
    });

  return {
    today: todayIso,
    end,
    days,
    weeks,
    events,
    worst,
    firstBelow,
    final: days.at(-1)!.balance,
    inflow,
    outflow: round(outflowLaunched + outflowRecurring),
    outflowLaunched,
    outflowRecurring,
    overdueReceivable,
    overduePayable,
    overdueIn,
    alerts: alerts.slice(0, 3),
  };
}

/** Dias que o caixa aguenta sem entradas, pela média de saídas dos últimos 30 dias (JPMorgan Chase Institute). */
/**
 * Saídas dos últimos 30 dias. Usa o total calculado pela API (que olha antes da
 * data do extrato); a lista de movimentos só começa no extrato e subestimava.
 */
export function paidLast30Days(summary: { paidLast30Days?: number | null; transactions?: Array<{ type: string; occurredAt: string; amount: number | string }> } | null | undefined, now = Date.now()) {
  if (typeof summary?.paidLast30Days === "number") return summary.paidLast30Days;
  const from = now - 30 * 86_400_000;
  return (summary?.transactions ?? [])
    .filter((t) => (t.type === "PAYMENT" || t.type === "TRANSFER_OUT") && Date.parse(t.occurredAt) >= from)
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

export function cashBufferDays(balance: number, paidLast30Days: number) {
  const perDay = paidLast30Days / 30;
  return perDay > 0 ? Math.max(0, Math.round(balance / perDay)) : null;
}
