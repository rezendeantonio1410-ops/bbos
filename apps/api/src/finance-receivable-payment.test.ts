import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { FinanceService } from "./finance.service";

type Overrides = {
  receivable?: Record<string, unknown> | null;
  account?: Record<string, unknown> | null;
  existingPayment?: Record<string, unknown> | null;
};

function serviceWithDatabase(overrides: Overrides = {}) {
  const calls = {
    payments: [] as Array<Record<string, unknown>>,
    transactions: [] as Array<Record<string, unknown>>,
    receivableUpdates: [] as Array<Record<string, unknown>>,
  };
  const receivable = overrides.receivable === undefined
    ? {
        id: "receivable-1",
        companyId: "company-1",
        invoiceId: "B-2026-000001",
        openAmount: 60.79,
        status: "OVERDUE",
      }
    : overrides.receivable;
  const account = overrides.account === undefined
    ? { id: "account-1", companyId: "company-1", active: true }
    : overrides.account;

  const tx = {
    accountsReceivable: {
      findFirst: async () => receivable,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        calls.receivableUpdates.push(data);
        return { ...receivable, ...data };
      },
    },
    financialAccount: { findFirst: async () => account },
    payment: {
      findUnique: async () => overrides.existingPayment ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.payments.push(data);
        return { id: "payment-1", ...data };
      },
    },
    financialTransaction: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.transactions.push(data);
        return { id: "transaction-1", ...data };
      },
    },
  };
  const database = {
    $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
  };
  const service = new FinanceService();
  (service as unknown as { database: typeof database }).database = database;
  return { service, calls };
}

test("a full manual receipt records an auditable payment and marks the title paid", async () => {
  const { service, calls } = serviceWithDatabase();

  const result = await service.receive(
    "receivable-1",
    {
      financialAccountId: "account-1",
      amount: 60.79,
      paidAt: "2026-10-04T15:00:00.000Z",
      method: "PIX",
      notes: "Comprovante 123",
      idempotencyKey: "receipt-operation-1",
      recordedBy: "Gestor BBOS",
    },
    "company-1",
  );

  assert.equal(result.idempotent, false);
  assert.equal(calls.payments.length, 1);
  assert.equal(calls.payments[0]?.amount, 60.79);
  assert.equal(calls.payments[0]?.method, "PIX");
  assert.match(String(calls.payments[0]?.notes), /Gestor BBOS/);
  assert.match(String(calls.payments[0]?.notes), /Comprovante 123/);
  assert.equal(calls.transactions[0]?.financialAccountId, "account-1");
  assert.equal(
    (calls.transactions[0]?.occurredAt as Date).toISOString(),
    "2026-10-04T15:00:00.000Z",
  );
  assert.deepEqual(calls.receivableUpdates[0], {
    openAmount: 0,
    status: "PAID",
    paymentDate: new Date("2026-10-04T15:00:00.000Z"),
  });
});

test("a partial receipt preserves the remaining balance", async () => {
  const { service, calls } = serviceWithDatabase();

  await service.receive(
    "receivable-1",
    {
      financialAccountId: "account-1",
      amount: 10,
      paidAt: "2026-10-04T15:00:00.000Z",
      method: "BANK_TRANSFER",
      idempotencyKey: "receipt-operation-2",
    },
    "company-1",
  );

  assert.deepEqual(calls.receivableUpdates[0], {
    openAmount: 50.79,
    status: "PARTIALLY_PAID",
    paymentDate: undefined,
  });
});

test("a receipt cannot use a financial account from another company", async () => {
  const { service, calls } = serviceWithDatabase({ account: null });

  await assert.rejects(
    service.receive(
      "receivable-1",
      {
        financialAccountId: "foreign-account",
        amount: 60.79,
        idempotencyKey: "receipt-operation-3",
      },
      "company-1",
    ),
    (error) =>
      error instanceof BadRequestException &&
      error.message === "Conta financeira inválida ou inativa.",
  );
  assert.equal(calls.payments.length, 0);
  assert.equal(calls.transactions.length, 0);
});

test("an idempotency key cannot be reused for another title or company", async () => {
  const { service, calls } = serviceWithDatabase({
    existingPayment: {
      id: "payment-previous",
      companyId: "company-2",
      accountsReceivableId: "receivable-other",
    },
  });

  await assert.rejects(
    service.receive(
      "receivable-1",
      {
        financialAccountId: "account-1",
        amount: 60.79,
        idempotencyKey: "receipt-operation-reused",
      },
      "company-1",
    ),
    /Identificador já utilizado em outra operação/,
  );
  assert.equal(calls.payments.length, 0);
});
