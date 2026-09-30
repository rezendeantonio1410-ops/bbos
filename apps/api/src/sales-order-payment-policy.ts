export type SalesOrderPaymentPolicyInput = {
  paymentType?: unknown;
  customerActive?: boolean;
  creditStatus?: unknown;
  creditLimit?: unknown;
  openReceivables?: unknown;
  orderTotal?: unknown;
};

export type SalesOrderPaymentPolicy =
  | { mode: "BLOCKED"; reason: "INACTIVE_CUSTOMER"; availableCredit: number }
  | {
      mode: "PIX";
      reason: "CASH_ORDER" | "CREDIT_NOT_APPROVED" | "INSUFFICIENT_CREDIT";
      availableCredit: number;
    }
  | { mode: "CREDIT"; reason: "APPROVED_CREDIT"; availableCredit: number };

const amount = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export function resolveSalesOrderPaymentPolicy(
  input: SalesOrderPaymentPolicyInput,
): SalesOrderPaymentPolicy {
  const availableCredit = Math.max(
    0,
    amount(input.creditLimit) - amount(input.openReceivables),
  );

  if (input.customerActive === false) {
    return { mode: "BLOCKED", reason: "INACTIVE_CUSTOMER", availableCredit };
  }

  if (String(input.paymentType ?? "CASH").toUpperCase() !== "TERM") {
    return { mode: "PIX", reason: "CASH_ORDER", availableCredit };
  }

  if (String(input.creditStatus ?? "") !== "APPROVED") {
    return {
      mode: "PIX",
      reason: "CREDIT_NOT_APPROVED",
      availableCredit,
    };
  }

  if (amount(input.orderTotal) > availableCredit) {
    return {
      mode: "PIX",
      reason: "INSUFFICIENT_CREDIT",
      availableCredit,
    };
  }

  return { mode: "CREDIT", reason: "APPROVED_CREDIT", availableCredit };
}
