import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { SalesOrderPaymentsService } from "./sales-order-payments.service";

function serviceFixture(orderStatus = "INVOICED") {
  const calls = {
    payments: [] as Array<Record<string, unknown>>,
    transactions: [] as Array<Record<string, unknown>>,
    receivables: [] as Array<Record<string, unknown>>,
    orders: [] as Array<Record<string, unknown>>,
    lifecycle: [] as Array<unknown[]>,
  };
  let receivable = {
    id: "receivable-1",
    companyId: "company-1",
    customerId: "customer-1",
    salesOrderId: "order-1",
    amount: 1722,
    openAmount: 1722,
    status: "OPEN",
    paymentDate: null,
  };
  let payment: Record<string, unknown> | null = null;
  const account = {
    id: "account-1",
    companyId: "company-1",
    name: "Itaú — Conta Principal Bispo",
    type: "BANK",
    currency: "BRL",
    active: true,
    financialInstitution: { name: "Itaú Unibanco" },
  };
  const order = {
    id: "order-1",
    companyId: "company-1",
    customerId: "customer-1",
    orderNumber: "B-2026-000006",
    code: "B-2026-000006",
    orderType: "COMMERCIAL",
    status: orderStatus,
    totalAmount: 1722,
  };

  const snapshot = () => [
    {
      ...order,
      receivableId: receivable.id,
      receivableStatus: receivable.status,
      openAmount: receivable.openAmount,
      paymentDate: receivable.paymentDate,
      paymentId: payment?.id ?? null,
      paidAmount: payment?.amount ?? null,
      paidAt: payment?.paidAt ?? null,
      method: payment?.method ?? null,
      source: payment?.source ?? null,
      reference: payment?.reference ?? null,
      recordedByName: payment?.recordedByName ?? null,
      recordedByRole: payment?.recordedByRole ?? null,
      financialAccountId: payment?.financialAccountId ?? null,
      financialAccountName: payment ? account.name : null,
    },
  ];

  const transaction = {
    $queryRaw: async () => [{ id: order.id }],
    $executeRawUnsafe: async () => 1,
    salesOrder: {
      findFirst: async () => order,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        calls.orders.push(data);
        Object.assign(order, data);
        return order;
      },
    },
    financialAccount: { findFirst: async () => account },
    accountsReceivable: {
      findUnique: async () => receivable,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        receivable = { ...receivable, ...data } as typeof receivable;
        return receivable;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        calls.receivables.push(data);
        receivable = { ...receivable, ...data } as typeof receivable;
        return receivable;
      },
    },
    payment: {
      findUnique: async () => payment,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        payment = { id: "payment-1", ...data };
        calls.payments.push(data);
        return payment;
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
    $queryRawUnsafe: async (sql: string) =>
      sql.includes('FROM "SalesOrder" so') ? snapshot() : [],
    $executeRawUnsafe: async () => 1,
    financialAccount: { findMany: async () => [account] },
    $transaction: async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
  };
  const lifecycle = {
    record: async (...args: unknown[]) => {
      calls.lifecycle.push(args);
    },
  };
  const service = new SalesOrderPaymentsService(
    {} as never,
    lifecycle as never,
  );
  Object.defineProperty(service, "database", { value: database });
  return { service, calls };
}

const admin = {
  id: "user-jose",
  name: "José Rezende",
  role: "ADMIN",
  companyId: "company-1",
};

test("manual Pix approval records the account, approver and audit reference", async () => {
  const { service, calls } = serviceFixture();

  const result = await service.confirmManualPix(
    "order-1",
    {
      financialAccountId: "account-1",
      reference: "E2E-PIX-123",
      paidAt: "2025-01-13T12:00:00.000Z",
    },
    admin,
  );

  assert.equal(result.paid, true);
  assert.equal(result.approval?.manual, true);
  assert.equal(calls.payments.length, 1);
  assert.equal(calls.payments[0]?.source, "SALES_ORDER_MANUAL_PIX");
  assert.equal(calls.payments[0]?.recordedByName, "José Rezende");
  assert.equal(calls.payments[0]?.recordedByRole, "ADMIN");
  assert.equal(calls.payments[0]?.reference, "E2E-PIX-123");
  assert.equal(calls.transactions[0]?.category, "RECEBIMENTO_PIX");
  assert.deepEqual(calls.receivables[0], {
    openAmount: 0,
    status: "PAID",
    paymentDate: new Date("2025-01-13T12:00:00.000Z"),
  });
  assert.equal(calls.lifecycle.length, 1);
});

test("manual Pix approval releases a draft order after the receipt is recorded", async () => {
  const { service, calls } = serviceFixture("DRAFT");

  await service.confirmManualPix(
    "order-1",
    {
      financialAccountId: "account-1",
      reference: "PIX-DIRETO-456",
      paidAt: "2025-01-13T12:00:00.000Z",
    },
    admin,
  );

  assert.deepEqual(calls.orders[0], {
    status: "CONFIRMED",
    paymentType: "CASH",
    paymentTermsSnapshot: "Pix direto · confirmado manualmente",
  });
});

test("manual Pix approval is idempotent and never duplicates the receipt", async () => {
  const { service, calls } = serviceFixture();
  const input = {
    financialAccountId: "account-1",
    reference: "PIX-IDEMPOTENTE",
    paidAt: "2025-01-13T12:00:00.000Z",
  };

  await service.confirmManualPix("order-1", input, admin);
  const repeated = await service.confirmManualPix("order-1", input, admin);

  assert.equal(repeated.idempotent, true);
  assert.equal(calls.payments.length, 1);
  assert.equal(calls.transactions.length, 1);
});

test("manual Pix approval rejects every non-administrator profile", async () => {
  const { service, calls } = serviceFixture();

  await assert.rejects(
    service.confirmManualPix(
      "order-1",
      {
        financialAccountId: "account-1",
        reference: "PIX-SEM-ALCADA",
      },
      { ...admin, role: "FINANCE" },
    ),
    ForbiddenException,
  );
  assert.equal(calls.payments.length, 0);
});
