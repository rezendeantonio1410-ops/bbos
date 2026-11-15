export type CashFlowKind = "RECEIVABLE" | "PAYABLE" | "PURCHASE";

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
      document: item.document || item.category || "Lançamento financeiro",
      counterparty: item.counterparty || "Fornecedor não identificado",
      description: item.description || "Conta a pagar",
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
      status: "Previsto",
      amount: amount(item.amount),
      signedAmount: -amount(item.amount),
    }));

  const ordered = [...receivables, ...payables, ...purchases].sort(
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
