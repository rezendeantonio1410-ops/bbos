import assert from "node:assert/strict";
import test from "node:test";
import { PayableStatus, ReceivableStatus } from "@bbos/database";
import {
  nextSalesCommissionPaymentDate,
  releaseSalesCommission,
} from "./sales-commission";

function fixture(
  options: {
    paid?: boolean;
    existing?: Record<string, unknown> | null;
  } = {},
) {
  const created: Array<Record<string, any>> = [];
  const transaction = {
    salesOrder: {
      findUnique: async () => ({
        id: "order-1",
        companyId: "company-1",
        orderNumber: "B-2026-000001",
        code: "B-2026-000001",
        orderType: "COMMERCIAL",
        status: "INVOICED",
        brokerId: "broker-1",
        brokerCommissionMode: "PERCENTAGE",
        brokerCommissionPercent: 5,
        brokerCommissionPerPackage: null,
        brokerCommissionAmount: 50,
        broker: { businessPartnerId: "partner-1" },
        accountsReceivable: [
          {
            status: options.paid
              ? ReceivableStatus.PAID
              : ReceivableStatus.PARTIALLY_PAID,
            openAmount: options.paid ? 0 : 500,
          },
        ],
      }),
    },
    accountsPayable: {
      findUnique: async () => options.existing ?? null,
      create: async ({ data }: { data: Record<string, any> }) => {
        created.push(data);
        return { id: "payable-1", ...data };
      },
    },
  } as any;
  return { transaction, created };
}

test("commission payment is always scheduled for day 02 of the next month", () => {
  assert.equal(
    nextSalesCommissionPaymentDate(
      new Date("2026-11-01T10:00:00Z"),
    ).toISOString(),
    "2026-12-02T12:00:00.000Z",
  );
  assert.equal(
    nextSalesCommissionPaymentDate(
      new Date("2026-12-31T23:59:00Z"),
    ).toISOString(),
    "2027-01-02T12:00:00.000Z",
  );
});

test("partial customer payment keeps sales commission reserved", async () => {
  const { transaction, created } = fixture({ paid: false });
  const result = await releaseSalesCommission(transaction, {
    salesOrderId: "order-1",
    paidAt: new Date("2026-11-16T15:00:00Z"),
  });
  assert.equal(result.released, false);
  assert.equal(result.reason, "CUSTOMER_NOT_PAID");
  assert.equal(created.length, 0);
});

test("full customer payment releases one commission payable for day 02", async () => {
  const { transaction, created } = fixture({ paid: true });
  const result = await releaseSalesCommission(transaction, {
    salesOrderId: "order-1",
    paidAt: new Date("2026-11-16T15:00:00Z"),
  });
  assert.equal(result.released, true);
  assert.equal(result.idempotent, false);
  assert.equal(created.length, 1);
  assert.equal(created[0]!.status, PayableStatus.OPEN);
  assert.equal(created[0]!.amount, 50);
  assert.equal(created[0]!.storefrontPartnerId, "partner-1");
  assert.equal(created[0]!.dueDate.toISOString(), "2026-12-02T12:00:00.000Z");
});

test("commission release is idempotent", async () => {
  const existing = {
    id: "payable-existing",
    status: PayableStatus.OPEN,
    openAmount: 50,
  };
  const { transaction, created } = fixture({ paid: true, existing });
  const result = await releaseSalesCommission(transaction, {
    salesOrderId: "order-1",
    paidAt: new Date("2026-11-16T15:00:00Z"),
  });
  assert.equal(result.released, true);
  assert.equal(result.idempotent, true);
  assert.equal(created.length, 0);
});
