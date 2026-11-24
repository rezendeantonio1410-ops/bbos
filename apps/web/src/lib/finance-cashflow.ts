export type CashFlowKind = "RECEIVABLE" | "PAYABLE" | "PURCHASE" | "TAX";

/** Estimated tax payment (management estimate, from the finance settings). */
export type TaxProjectionSource = {
  tax: string;
  label: string;
  competence: string;
  dueDate: string;
  amount: number;
  basis: string;
};

export type CashFlowProjectionSource = {
  id: string;
  document?: string | null;
  counterparty: string;
  description?: string | null;
  category?: string | null;
  dueDate: string;
  amount: number | string;
  status: string;
};

export type GreenCoffeeProjectionSource = {
  id: string;
  purchaseNumber: string;
  supplier: string;
  amount: number | string;
  dueDate: string;
  status: string;
  approvalStatus?: string;
};

export type CashFlowLine = {
  id: string;
  kind: CashFlowKind;
  dueDate: string;
  document: string;
  counterparty: string;
  description: string;
  status: string;
  amount: number;
  signedAmount: number;
  balance: number;
  /** Where the money comes from / goes to (for the breakdown charts). */
  group: string;
};

export type CashFlowTransaction = {
  id: string;
  type: string;
  amount: number | string;
  occurredAt: string;
};

export type CashFlowPoint = {
  id: string;
  date: string;
  balance: number;
};

const inactiveStatuses = new Set(["PAID", "CANCELLED"]);

const PAYABLE_GROUPS: Record<string, string> = {
  COMPRA_CAFE_VERDE: "Café verde",
  COMISSAO_VENDA: "Comissões",
  INSUMOS_E_SERVICOS: "Insumos e serviços",
};

/** Readable group of a payable category ("Frete / logística · Melhor Envio" → "Frete / logística"). */
export function payableGroup(category?: string | null) {
  const value = (category ?? "").trim();
  if (!value) return "Outras despesas";
  if (PAYABLE_GROUPS[value]) return PAYABLE_GROUPS[value];
  const head = value.split(" · ")[0]!.trim();
  return /^[A-Z_]+$/.test(head) ? head.charAt(0) + head.slice(1).toLowerCase().replace(/_/g, " ") : head;
}

function amount(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function effectiveStatus(status: string, dueDate: string) {
  if (status === "PARTIALLY_PAID") return "Parcial";
  if (status === "OVERDUE" || new Date(dueDate).getTime() < Date.now())
    return "Vencido";
  return "A vencer";
}

export function buildCashFlowLines(input: {
  cash: number;
  receivables?: CashFlowProjectionSource[];
  payables?: CashFlowProjectionSource[];
  purchases?: GreenCoffeeProjectionSource[];
  taxes?: TaxProjectionSource[];
}) {
  const receivables = (input.receivables ?? [])
    .filter(
      (item) => !inactiveStatuses.has(item.status) && amount(item.amount) > 0,
    )
    .map((item) => ({
      id: `receivable-${item.id}`,
      kind: "RECEIVABLE" as const,
      dueDate: item.dueDate,
      document: item.document || "Sem documento fiscal",
      counterparty: item.counterparty || "Cliente não identificado",
      description: item.description || "Conta a receber",
      group: item.counterparty || "Cliente não identificado",
      status: effectiveStatus(item.status, item.dueDate),
      amount: amount(item.amount),
      signedAmount: amount(item.amount),
    }));

  const payables = (input.payables ?? [])
    .filter(
      (item) => !inactiveStatuses.has(item.status) && amount(item.amount) > 0,
    )
    .map((item) => ({
      id: `payable-${item.id}`,
      kind: "PAYABLE" as const,
      dueDate: item.dueDate,
      document: item.document || (item.category ? payableGroup(item.category) : "Lançamento financeiro"),
      counterparty: item.counterparty || "Fornecedor não identificado",
      description: item.description || "Conta a pagar",
      group: payableGroup(item.category),
      status: effectiveStatus(item.status, item.dueDate),
      amount: amount(item.amount),
      signedAmount: -amount(item.amount),
    }));

  const purchases = (input.purchases ?? [])
    .filter(
      (item) =>
        item.approvalStatus !== "DRAFT" &&
        item.status.startsWith("PREVISTO") &&
        amount(item.amount) > 0,
    )
    .map((item) => ({
      id: `purchase-${item.id}`,
      kind: "PURCHASE" as const,
      dueDate: item.dueDate,
      document: item.purchaseNumber,
      counterparty: item.supplier || "Fornecedor não identificado",
      description: "Compra de café verde prevista",
      group: "Café verde",
      status: "Previsto",
      amount: amount(item.amount),
      signedAmount: -amount(item.amount),
    }));

  const taxes = (input.taxes ?? [])
    .filter((item) => amount(item.amount) > 0)
    .map((item) => {
      const [year, month] = item.competence.split("-");
      return {
        id: `tax-${item.tax}-${item.competence}`,
        kind: "TAX" as const,
        dueDate: item.dueDate,
        document: `${item.label} ${month}/${year}`,
        counterparty: item.tax === "ICMS" ? "Secretaria da Fazenda" : "Receita Federal",
        description: item.basis,
        status: "Estimado",
        group: "Impostos",
        amount: amount(item.amount),
        signedAmount: -amount(item.amount),
      };
    });

  const ordered = [...receivables, ...payables, ...purchases, ...taxes].sort(
    (left, right) => {
      const byDate =
        new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
      return (
        byDate ||
        left.kind.localeCompare(right.kind) ||
        left.id.localeCompare(right.id)
      );
    },
  );

  let balance = Number(input.cash) || 0;
  return ordered.map<CashFlowLine>((item) => {
    balance += item.signedAmount;
    return { ...item, balance };
  });
}

function transactionAmount(transaction: CashFlowTransaction) {
  const value = amount(transaction.amount);
  if (["PAYMENT", "TRANSFER_OUT"].includes(transaction.type)) return -value;
  return value;
}

export function buildCashFlowSeries(input: {
  cash: number;
  transactions?: CashFlowTransaction[];
  projection: CashFlowLine[];
}) {
  const transactions = [...(input.transactions ?? [])].sort(
    (left, right) =>
      new Date(left.occurredAt).getTime() -
      new Date(right.occurredAt).getTime(),
  );
  const openingBalance =
    input.cash -
    transactions.reduce((sum, item) => sum + transactionAmount(item), 0);
  let actualBalance = openingBalance;
  const actual: CashFlowPoint[] = transactions.length
    ? transactions.map((item) => {
        actualBalance += transactionAmount(item);
        return { id: item.id, date: item.occurredAt, balance: actualBalance };
      })
    : [{ id: "cash-now", date: new Date().toISOString(), balance: input.cash }];

  const current = {
    id: "projection-start",
    date: new Date().toISOString(),
    balance: input.cash,
  };
  const projected = [
    current,
    ...input.projection.map((item) => ({
      id: item.id,
      date: item.dueDate,
      balance: item.balance,
    })),
  ];
  return { actual, projected };
}

/** First projected line whose running balance falls below the minimum. */
export function firstBelowMinimum(lines: CashFlowLine[], minimum: number) {
  if (!(minimum > 0)) return null;
  return lines.find((line) => line.balance < minimum) ?? null;
}

export type CashFlowBucket = {
  key: string;
  label: string;
  start: string;
  end: string;
  inflow: number;
  outflow: number;
  closing: number;
  lines: CashFlowLine[];
  includesOverdue: boolean;
};

const DAY = 86_400_000;
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);
const shortDate = (time: number) => new Date(time).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Groups the projection into weeks (Monday–Sunday) or months from today.
 * Overdue items fall in the first period, flagged as such.
 */
export function bucketCashFlow(
  lines: CashFlowLine[],
  options: { cash: number; today?: Date; granularity: "week" | "month"; periods: number },
): CashFlowBucket[] {
  const now = options.today ?? new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const starts: number[] = [];
  if (options.granularity === "week") {
    const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY;
    for (let i = 0; i < options.periods; i++) starts.push(monday + i * 7 * DAY);
  } else {
    const d = new Date(today);
    for (let i = 0; i < options.periods; i++) starts.push(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1));
  }
  const ends = starts.map((start) =>
    options.granularity === "week" ? start + 6 * DAY : Date.UTC(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth() + 1, 0),
  );
  const buckets: CashFlowBucket[] = starts.map((start, i) => ({
    key: isoDay(start),
    label:
      options.granularity === "week"
        ? shortDate(start)
        : `${MONTHS[new Date(start).getUTCMonth()]}/${String(new Date(start).getUTCFullYear()).slice(2)}`,
    start: isoDay(start),
    end: isoDay(ends[i]!),
    inflow: 0,
    outflow: 0,
    closing: 0,
    lines: [],
    includesOverdue: false,
  }));
  for (const line of lines) {
    const due = Date.parse(line.dueDate.slice(0, 10) + "T00:00:00Z");
    let index = starts.findIndex((start, i) => due >= start && due <= ends[i]!);
    if (index < 0 && due < starts[0]!) {
      index = 0;
      buckets[0]!.includesOverdue = true;
    }
    if (index < 0) continue;
    const bucket = buckets[index]!;
    bucket.lines.push(line);
    if (line.signedAmount >= 0) bucket.inflow += line.signedAmount;
    else bucket.outflow += -line.signedAmount;
  }
  let balance = Number(options.cash) || 0;
  for (const bucket of buckets) {
    balance += bucket.inflow - bucket.outflow;
    bucket.closing = Math.round(balance * 100) / 100;
    bucket.inflow = Math.round(bucket.inflow * 100) / 100;
    bucket.outflow = Math.round(bucket.outflow * 100) / 100;
  }
  return buckets;
}

/** Totals by group for one direction, largest first; the tail folds into "Outros". */
export function groupTotals(lines: CashFlowLine[], direction: "in" | "out", top = 5) {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if ((direction === "in") !== (line.signedAmount >= 0)) continue;
    totals.set(line.group, (totals.get(line.group) ?? 0) + Math.abs(line.signedAmount));
  }
  const sorted = [...totals.entries()].map(([group, amount]) => ({ group, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount);
  if (sorted.length <= top + 1) return sorted;
  const rest = sorted.slice(top).reduce((sum, item) => sum + item.amount, 0);
  return [...sorted.slice(0, top), { group: "Outros", amount: Math.round(rest * 100) / 100 }];
}
