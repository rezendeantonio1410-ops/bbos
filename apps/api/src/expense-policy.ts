import { BadRequestException } from "@nestjs/common";

const PAYMENT_METHODS = new Set([
  "PIX",
  "BANK_TRANSFER",
  "CASH",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "BOLETO",
  "OTHER",
]);

export type ExpenseCostType =
  | "LABOR"
  | "ENERGY"
  | "WATER"
  | "GAS"
  | "PACKAGING"
  | "SUPPLIES"
  | "MAINTENANCE"
  | "RENT"
  | "LOGISTICS"
  | "TECHNOLOGY"
  | "ADMINISTRATIVE"
  | "TAX"
  | "OTHER";

const expenseTypes: Record<string, ExpenseCostType> = {
  "Funcionários / salários": "LABOR",
  "Encargos trabalhistas": "LABOR",
  "Energia elétrica": "ENERGY",
  Água: "WATER",
  Gás: "GAS",
  Embalagens: "PACKAGING",
  "Insumos / material de consumo": "SUPPLIES",
  Manutenção: "MAINTENANCE",
  Aluguel: "RENT",
  "Frete / logística": "LOGISTICS",
  "Internet / telefonia": "TECHNOLOGY",
  Contabilidade: "ADMINISTRATIVE",
  "Serviços terceirizados": "ADMINISTRATIVE",
  "Despesa administrativa": "ADMINISTRATIVE",
  Segurança: "ADMINISTRATIVE",
  "Impostos e taxas": "TAX",
  "Outras despesas": "OTHER",
};

export function expenseCostType(category: string) {
  return expenseTypes[String(category ?? "").trim()] ?? "OTHER";
}

export function expenseAmount(value: number) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0)
    throw new BadRequestException(
      "O valor da despesa deve ser maior que zero.",
    );
  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 0.000001)
    throw new BadRequestException(
      "Informe o valor da despesa com no máximo duas casas decimais.",
    );
  return cents / 100;
}

export function expenseDate(value: string | undefined, label: string) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new BadRequestException(`${label} é obrigatória.`);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const normalized = dateOnly ? `${raw}T12:00:00.000Z` : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime()))
    throw new BadRequestException(`${label} inválida.`);
  if (dateOnly && date.toISOString().slice(0, 10) !== raw)
    throw new BadRequestException(`${label} inválida.`);
  return date;
}

function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function expensePaymentDate(value?: string) {
  const raw = String(value ?? new Date().toISOString()).trim();
  const date = expenseDate(raw, "Data do pagamento");
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (raw > todayInSaoPaulo())
      throw new BadRequestException(
        "A data do pagamento não pode estar no futuro.",
      );
  } else if (date.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new BadRequestException(
      "A data do pagamento não pode estar no futuro.",
    );
  }
  return date;
}

export function expensePaymentMethod(value?: string) {
  const method = String(value ?? "BANK_TRANSFER")
    .trim()
    .toUpperCase();
  if (!PAYMENT_METHODS.has(method))
    throw new BadRequestException("Forma de pagamento inválida.");
  return method;
}

export function monthlyOccurrence(date: Date, months: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay), 12, 0, 0, 0));
}

export function recurrenceCount(repeatMonthly?: boolean, count?: number) {
  if (!repeatMonthly) return 1;
  const parsed = Number(count);
  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 24)
    throw new BadRequestException(
      "A repetição mensal deve ter entre 2 e 24 lançamentos.",
    );
  return parsed;
}
