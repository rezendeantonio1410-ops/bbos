export type ReconciliationDirection = "IN" | "OUT";
export type ReconciliationStatus =
  | "PENDING"
  | "MATCHED"
  | "PARTIALLY_MATCHED"
  | "DIVERGENT"
  | "IGNORED";

export type ReconciliationMatchInput = {
  externalAmount: number;
  externalDirection: ReconciliationDirection;
  externalDate: Date | string;
  externalReference?: string | null;
  externalCounterparty?: string | null;
  externalAccountId?: string | null;
  transactionAccountId?: string | null;
  externalCurrency?: string | null;
  transactionCurrency?: string | null;
  transactionAmount: number;
  transactionDirection: ReconciliationDirection;
  transactionDate: Date | string;
  transactionReference?: string | null;
  transactionCounterparty?: string | null;
  matchedAmount?: number;
};

export type ReconciliationMatchResult = {
  status: ReconciliationStatus;
  matchedAmount: number;
  difference: number;
  confidence: "exact" | "partial" | "divergent" | "none";
  reasons: string[];
};

const dayMs = 24 * 60 * 60 * 1000;

function normalize(value?: string | null) {
  return value?.trim().toLocaleLowerCase() || undefined;
}

function closeDate(left: Date | string, right: Date | string) {
  return Math.abs(new Date(left).getTime() - new Date(right).getTime()) <= 3 * dayMs;
}

export function financialTransactionDirection(type: string): ReconciliationDirection {
  return type === "RECEIPT" || type === "TRANSFER_IN" ? "IN" : "OUT";
}

export function bankTransactionDirection(direction: "CREDIT" | "DEBIT"): ReconciliationDirection {
  return direction === "CREDIT" ? "IN" : "OUT";
}

export function evaluateReconciliationMatch(input: ReconciliationMatchInput): ReconciliationMatchResult {
  const reasons: string[] = [];
  if (input.externalAccountId && input.transactionAccountId && input.externalAccountId !== input.transactionAccountId) {
    return { status: "DIVERGENT", matchedAmount: 0, difference: input.externalAmount, confidence: "none", reasons: ["Contas financeiras incompatíveis."] };
  }
  if (input.externalCurrency && input.transactionCurrency && input.externalCurrency.toUpperCase() !== input.transactionCurrency.toUpperCase()) {
    return { status: "DIVERGENT", matchedAmount: 0, difference: input.externalAmount, confidence: "none", reasons: ["Moedas incompatíveis."] };
  }
  if (input.externalDirection !== input.transactionDirection) {
    return { status: "DIVERGENT", matchedAmount: 0, difference: input.externalAmount, confidence: "none", reasons: ["Direção da movimentação incompatível."] };
  }
  const referenceMatches = Boolean(normalize(input.externalReference) && normalize(input.externalReference) === normalize(input.transactionReference));
  const counterpartyMatches = Boolean(normalize(input.externalCounterparty) && normalize(input.externalCounterparty) === normalize(input.transactionCounterparty));
  const dateMatches = closeDate(input.externalDate, input.transactionDate);
  if (referenceMatches) reasons.push("referência/documento correspondente");
  if (counterpartyMatches) reasons.push("cliente/fornecedor correspondente");
  if (dateMatches) reasons.push("data dentro da janela de conciliação");

  const requested = input.matchedAmount ?? input.externalAmount;
  const matchedAmount = Math.min(Math.max(requested, 0), input.transactionAmount);
  const difference = Number((input.externalAmount - matchedAmount).toFixed(2));
  if (matchedAmount === input.externalAmount && matchedAmount === input.transactionAmount && (referenceMatches || dateMatches || counterpartyMatches)) {
    return { status: "MATCHED", matchedAmount, difference: 0, confidence: "exact", reasons };
  }
  if (input.matchedAmount !== undefined && matchedAmount > 0 && matchedAmount < input.externalAmount && (referenceMatches || dateMatches || counterpartyMatches)) {
    return { status: "PARTIALLY_MATCHED", matchedAmount, difference, confidence: "partial", reasons };
  }
  if (matchedAmount > 0 && (referenceMatches || dateMatches || counterpartyMatches)) {
    return { status: "DIVERGENT", matchedAmount, difference, confidence: "divergent", reasons: [...reasons, "valor ou contexto divergente"] };
  }
  return { status: "PENDING", matchedAmount: 0, difference: input.externalAmount, confidence: "none", reasons: ["Nenhum correspondente compatível encontrado."] };
}
