import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { FinanceService } from "./finance.service";

type Overrides = {
  existing?: Record<string, unknown> | null;
  supplier?: Record<string, unknown> | null;
  center?: Record<string, unknown> | null;
  account?: Record<string, unknown> | null;
  duplicateDocument?: Record<string, unknown> | null;
};

function serviceWithDatabase(overrides: Overrides = {}) {
  const calls = {
    costs: [] as Array<Record<string, unknown>>,
    payables: [] as Array<Record<string, unknown>>,
    payments: [] as Array<Record<string, unknown>>,
    transactions: [] as Array<Record<string, unknown>>,
  };
  const supplier =
    overrides.supplier === undefined
      ? { id: "supplier-1", companyId: "company-1", active: true }
      : overrides.supplier;
  const center =
    overrides.center === undefined
      ? { id: "center-1", category: "INDUSTRIAL" }
      : overrides.center;
  const account =
    overrides.account === undefined
      ? { id: "account-1", companyId: "company-1", active: true }
      : overrides.account;
  let payableSequence = 0;
  let costSequence = 0;
  const tx = {
    supplier: { findFirst: async () => supplier },
    costCenter: { findFirst: async () => center },
    financialAccount: { findFirst: async () => account },
    costEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        costSequence += 1;
        calls.costs.push(data);
        return { id: `cost-${costSequence}`, ...data };
      },
    },
    accountsPayable: {
      findFirst: async () => overrides.duplicateDocument ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        payableSequence += 1;
        calls.payables.push(data);
        return { id: `payable-${payableSequence}`, ...data };
      },
    },
    payment: {
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
    accountsPayable: {
      findFirst: async () => overrides.existing ?? null,
    },
    $transaction: async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
  };
  const service = new FinanceService();
  (service as unknown as { database: typeof database }).database = database;
  return { service, calls };
}

const baseExpense = {
  companyId: "company-1",
  supplierId: "supplier-1",
  costCenterId: "center-1",
  description: "Conta de água — novembro",
  issueDate: "2026-11-01",
  dueDate: "2026-11-20",
  competenceDate: "2026-11-01",
  amount: 120.5,
  category: "Água",
  idempotencyKey: "expense-operation-1",
  createdById: "user-1",
  createdByName: "Gestor BBOS",
};

test("one expense creates one payable linked to one cost event", async () => {
  const { service, calls } = serviceWithDatabase();
  const result = await service.createPayable(baseExpense);

  assert.equal(result.idempotent, false);
  assert.equal(calls.costs.length, 1);
  assert.equal(calls.costs[0]?.type, "WATER");
  assert.equal(calls.payables.length, 1);
  assert.equal(calls.payables[0]?.costEventId, "cost-1");
  assert.equal(calls.payables[0]?.source, "MANUAL_EXPENSE");
  assert.equal(calls.payments.length, 0);
});

test("an already paid expense also creates the audited payment and cash transaction", async () => {
  const { service, calls } = serviceWithDatabase();
  await service.createPayable({
    ...baseExpense,
    idempotencyKey: "expense-operation-2",
    paidNow: true,
    financialAccountId: "account-1",
    paymentMethod: "pix",
    paidAt: "2026-11-01T10:00:00.000Z",
  });

  assert.equal(calls.payables[0]?.status, "PAID");
  assert.equal(calls.payables[0]?.openAmount, 0);
  assert.equal(calls.payments[0]?.method, "PIX");
  assert.equal(calls.payments[0]?.recordedByName, "Gestor BBOS");
  assert.equal(calls.transactions[0]?.costCenterId, "center-1");
});

test("monthly recurrence creates separate commitments and clamps shorter months", async () => {
  const { service, calls } = serviceWithDatabase();
  await service.createPayable({
    ...baseExpense,
    idempotencyKey: "expense-operation-3",
    issueDate: "2027-01-31",
    dueDate: "2027-01-31",
    competenceDate: "2027-01-31",
    repeatMonthly: true,
    repeatCount: 2,
  });

  assert.equal(calls.payables.length, 2);
  assert.equal(
    (calls.payables[1]?.dueDate as Date).toISOString(),
    "2027-02-28T12:00:00.000Z",
  );
  assert.equal(calls.payables[1]?.recurrenceIndex, 2);
  assert.equal(calls.costs.length, 2);
});

test("an immediate payment cannot use an account outside the company", async () => {
  const { service, calls } = serviceWithDatabase({ account: null });
  await assert.rejects(
    service.createPayable({
      ...baseExpense,
      idempotencyKey: "expense-operation-4",
      paidNow: true,
      financialAccountId: "foreign-account",
      paidAt: "2026-11-01T10:00:00.000Z",
    }),
    (error) =>
      error instanceof BadRequestException &&
      error.message === "Selecione a conta utilizada no pagamento.",
  );
  assert.equal(calls.payables.length, 0);
  assert.equal(calls.transactions.length, 0);
});
