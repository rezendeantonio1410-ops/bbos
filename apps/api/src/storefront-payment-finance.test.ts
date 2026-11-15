import assert from "node:assert/strict";
import test from "node:test";
import {
  recordPaidStorefrontOrder,
  STOREFRONT_PAYMENT_SOURCE,
} from "./storefront-payment-finance";

function financeDouble() {
  const state = {
    institutions: new Map<string, any>(),
    accounts: new Map<string, any>(),
    receivables: new Map<string, any>(),
    payments: new Map<string, any>(),
    transactions: new Map<string, any>(),
  };
  const upsert = (map: Map<string, any>, key: string, input: any) => {
    const current = map.get(key);
    const value = current
      ? { ...current, ...input.update }
      : { id: key, ...input.create };
    map.set(key, value);
    return value;
  };
  const transaction = {
    financialInstitution: {
      upsert: (input: any) => upsert(state.institutions, input.where.id, input),
    },
    financialAccount: {
      upsert: (input: any) => upsert(state.accounts, input.where.id, input),
    },
    accountsReceivable: {
      upsert: (input: any) =>
        upsert(state.receivables, input.where.salesOrderId, {
          ...input,
          create: {
            id: `receivable:${input.where.salesOrderId}`,
            ...input.create,
          },
        }),
      update: (input: any) => {
        const entry = [...state.receivables.entries()].find(
          ([, value]) => value.id === input.where.id,
        );
        assert.ok(entry);
        const value = { ...entry[1], ...input.data };
        state.receivables.set(entry[0], value);
        return value;
      },
    },
    payment: {
      findFirst: ({ where }: any) =>
        [...state.payments.values()].find(
          (item) => item.accountsReceivableId === where.accountsReceivableId,
        ) ?? null,
      upsert: (input: any) => {
        const current = [...state.payments.values()].find(
          (item) => item.idempotencyKey === input.where.idempotencyKey,
        );
        if (current) return current;
        const value = {
          id: `payment:${state.payments.size + 1}`,
          ...input.create,
        };
        state.payments.set(value.id, value);
        return value;
      },
    },
    financialTransaction: {
      upsert: (input: any) => {
        const current = [...state.transactions.values()].find(
          (item) => item.paymentId === input.where.paymentId,
        );
        if (current) return current;
        const value = {
          id: `transaction:${state.transactions.size + 1}`,
          ...input.create,
        };
        state.transactions.set(value.id, value);
        return value;
      },
    },
  };
  return { state, transaction };
}

test("registra uma única vez o pagamento confirmado da Loja Bispo", async () => {
  const { state, transaction } = financeDouble();
  const input = {
    salesOrderId: "sales-1",
    storefrontOrderId: "store-1",
    paymentAttemptId: "attempt-1",
    companyId: "company-1",
    customerId: "customer-1",
    orderCode: "WEB-1",
    provider: "MERCADO_PAGO",
    method: "PIX",
    externalId: "mp-1",
    amountCents: 6_879,
    orderTotal: 68.79,
    paidAt: "2026-10-07T22:50:34.188Z",
  };

  const first = await recordPaidStorefrontOrder(transaction as never, input);
  const second = await recordPaidStorefrontOrder(transaction as never, input);

  assert.equal(first?.idempotent, false);
  assert.equal(second?.idempotent, true);
  assert.equal(state.institutions.size, 1);
  assert.equal(state.accounts.size, 1);
  assert.equal(state.receivables.size, 1);
  assert.equal(state.payments.size, 1);
  assert.equal(state.transactions.size, 1);
  assert.equal([...state.receivables.values()][0].status, "PAID");
  assert.equal(Number([...state.receivables.values()][0].openAmount), 0);
  assert.equal(
    [...state.payments.values()][0].source,
    STOREFRONT_PAYMENT_SOURCE,
  );
});

test("bloqueia baixa financeira quando o provedor diverge do total do pedido", async () => {
  const { transaction } = financeDouble();
  await assert.rejects(
    recordPaidStorefrontOrder(transaction as never, {
      salesOrderId: "sales-1",
      storefrontOrderId: "store-1",
      paymentAttemptId: "attempt-1",
      companyId: "company-1",
      customerId: "customer-1",
      orderCode: "WEB-1",
      provider: "MERCADO_PAGO",
      method: "PIX",
      amountCents: 6_800,
      orderTotal: 68.79,
      paidAt: "2026-10-07T22:50:34.188Z",
    }),
    /divergente/,
  );
});
