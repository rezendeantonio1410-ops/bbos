/**
 * Tax estimates for the cash flow forecast. These are management estimates
 * (the accountant's calculation prevails): rates are configurable per company
 * and every line is shown as "estimado".
 */

export const TAX_REGIMES = ["LUCRO_REAL", "LUCRO_PRESUMIDO", "SIMPLES_NACIONAL"] as const;
export type TaxRegime = (typeof TAX_REGIMES)[number];

export type TaxRates = {
  /** PIS and COFINS, % of revenue. */
  pis: number;
  cofins: number;
  /** Non-cumulative regime: credits on inputs (Lucro Real). */
  pisCofinsCredit: boolean;
  /** Effective ICMS to pay, % of revenue (after credits); null = not estimated. */
  icms: number | null;
  icmsDueDay: number;
  /** IRPJ/CSLL monthly estimate: presumed base % of revenue and tax %. */
  irpjBase: number;
  irpj: number;
  irpjSurcharge: number;
  irpjSurchargeMonthlyThreshold: number;
  csllBase: number;
  csll: number;
  /** Simples Nacional effective rate, % of revenue. */
  simples: number | null;
};

export const DEFAULT_TAX_RATES: Record<TaxRegime, TaxRates> = {
  LUCRO_REAL: {
    pis: 1.65, cofins: 7.6, pisCofinsCredit: true, icms: null, icmsDueDay: 12,
    irpjBase: 8, irpj: 15, irpjSurcharge: 10, irpjSurchargeMonthlyThreshold: 20000, csllBase: 12, csll: 9, simples: null,
  },
  LUCRO_PRESUMIDO: {
    pis: 0.65, cofins: 3, pisCofinsCredit: false, icms: null, icmsDueDay: 12,
    irpjBase: 8, irpj: 15, irpjSurcharge: 10, irpjSurchargeMonthlyThreshold: 20000, csllBase: 12, csll: 9, simples: null,
  },
  SIMPLES_NACIONAL: {
    pis: 0, cofins: 0, pisCofinsCredit: false, icms: null, icmsDueDay: 12,
    irpjBase: 0, irpj: 0, irpjSurcharge: 0, irpjSurchargeMonthlyThreshold: 0, csllBase: 0, csll: 0, simples: null,
  },
};

const PERCENT_FIELDS = ["pis", "cofins", "icms", "irpjBase", "irpj", "irpjSurcharge", "csllBase", "csll", "simples"] as const;

/** Merges stored/edited rates over the regime defaults, validating ranges. */
export function normalizeTaxRates(regime: TaxRegime, input: unknown): TaxRates {
  const base = { ...DEFAULT_TAX_RATES[regime] };
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  for (const field of PERCENT_FIELDS) {
    if (!(field in raw)) continue;
    const value = raw[field];
    if (value === null || value === "") {
      if (field === "icms" || field === "simples") base[field] = null;
      continue;
    }
    const number = Number(String(value).replace(",", "."));
    if (!Number.isFinite(number) || number < 0 || number > 100) throw new Error(`Alíquota inválida: ${field}.`);
    (base as Record<string, unknown>)[field] = Math.round(number * 10000) / 10000;
  }
  if ("pisCofinsCredit" in raw) base.pisCofinsCredit = Boolean(raw.pisCofinsCredit);
  if ("icmsDueDay" in raw) {
    const day = Number(raw.icmsDueDay);
    if (!Number.isInteger(day) || day < 1 || day > 28) throw new Error("Dia de vencimento do ICMS inválido.");
    base.icmsDueDay = day;
  }
  if ("irpjSurchargeMonthlyThreshold" in raw) {
    const value = Number(raw.irpjSurchargeMonthlyThreshold);
    if (!Number.isFinite(value) || value < 0) throw new Error("Limite do adicional de IRPJ inválido.");
    base.irpjSurchargeMonthlyThreshold = value;
  }
  return base;
}

export type MonthFigures = { month: string; revenue: number; inputs: number };
export type TaxLine = {
  tax: "PIS" | "COFINS" | "ICMS" | "IRPJ" | "CSLL" | "SIMPLES";
  label: string;
  competence: string;
  dueDate: string;
  amount: number;
  basis: string;
};

const round = (value: number) => Math.round(value * 100) / 100;
const iso = (date: Date) => date.toISOString().slice(0, 10);

/** Moves a weekend date back to Friday (federal taxes are anticipated). */
function previousBusinessDay(date: Date) {
  const day = date.getUTCDay();
  if (day === 6) date.setUTCDate(date.getUTCDate() - 1);
  if (day === 0) date.setUTCDate(date.getUTCDate() - 2);
  return date;
}

function nextMonth(month: string, day: number | "last") {
  const [year, m] = month.split("-").map(Number) as [number, number];
  if (day === "last") return previousBusinessDay(new Date(Date.UTC(year, m + 1, 0)));
  return previousBusinessDay(new Date(Date.UTC(year, m, day)));
}

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Estimated tax payments for each month of revenue (competence). */
export function estimateTaxes(regime: TaxRegime, rates: TaxRates, months: MonthFigures[]): TaxLine[] {
  const lines: TaxLine[] = [];
  for (const { month, revenue, inputs } of months) {
    if (revenue <= 0) continue;
    const push = (tax: TaxLine["tax"], label: string, due: Date, amount: number, basis: string) => {
      if (amount > 0.005) lines.push({ tax, label, competence: month, dueDate: iso(due), amount: round(amount), basis });
    };
    if (regime === "SIMPLES_NACIONAL") {
      if (rates.simples !== null) push("SIMPLES", "DAS do Simples", nextMonth(month, 20), revenue * (rates.simples / 100), `${rates.simples}% de ${brl(revenue)}`);
      continue;
    }
    const pisCofinsBase = rates.pisCofinsCredit ? Math.max(0, revenue - inputs) : revenue;
    const baseText = rates.pisCofinsCredit ? `vendas ${brl(revenue)} − insumos ${brl(inputs)}` : `vendas ${brl(revenue)}`;
    const pisCofinsDue = nextMonth(month, 25);
    push("PIS", "PIS", pisCofinsDue, pisCofinsBase * (rates.pis / 100), `${rates.pis}% sobre ${baseText}`);
    push("COFINS", "COFINS", pisCofinsDue, pisCofinsBase * (rates.cofins / 100), `${rates.cofins}% sobre ${baseText}`);
    if (rates.icms !== null) push("ICMS", "ICMS", nextMonth(month, rates.icmsDueDay), revenue * (rates.icms / 100), `${rates.icms}% efetivo sobre ${brl(revenue)}`);
    const irpjBase = revenue * (rates.irpjBase / 100);
    const surcharge = Math.max(0, irpjBase - rates.irpjSurchargeMonthlyThreshold) * (rates.irpjSurcharge / 100);
    const incomeDue = nextMonth(month, "last");
    push("IRPJ", "IRPJ (estimativa mensal)", incomeDue, irpjBase * (rates.irpj / 100) + surcharge, `${rates.irpj}% sobre ${rates.irpjBase}% das vendas${surcharge ? " + adicional" : ""}`);
    push("CSLL", "CSLL (estimativa mensal)", incomeDue, revenue * (rates.csllBase / 100) * (rates.csll / 100), `${rates.csll}% sobre ${rates.csllBase}% das vendas`);
  }
  return lines;
}
