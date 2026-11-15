import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  ensureSalesOrderReceivable,
  resolveSalesOrderDueDate,
} from "./sales-order-receivable";

test("uses the first term to calculate the receivable due date", () => {
  const issueDate = new Date("2026-11-04T12:00:00.000Z");
  assert.equal(
    resolveSalesOrderDueDate(issueDate, "14/28 dias").toISOString(),
    "2026-11-18T12:00:00.000Z",
  );
  assert.equal(
    resolveSalesOrderDueDate(issueDate, null).toISOString(),
    "2026-12-04T12:00:00.000Z",
  );
});

test("creates an idempotent title for an authorized term order", async () => {
  let upsert: any;
  const result = await ensureSalesOrderReceivable(
    {
      salesOrder: {
        findUnique: async () => ({
          id: "order-1",
          companyId: "company-1",
          customerId: "customer-1",
          orderType: "COMMERCIAL",
          paymentType: "TERM",
          paymentTermsSnapshot: "14 dias",
          totalAmount: 208,
          invoicedAt: new Date("2026-11-04T12:00:00.000Z"),
        }),
      },
      accountsReceivable: {
        upsert: async (args: any) => {
          upsert = args;
          return { id: "receivable-1" };
        },
      },
    } as any,
    "order-1",
    "12345",
  );

  assert.deepEqual(result, { id: "receivable-1" });
  assert.deepEqual(upsert.where, { salesOrderId: "order-1" });
  assert.equal(upsert.create.invoiceId, "12345");
  assert.equal(upsert.create.dueDate.toISOString(), "2026-11-18T12:00:00.000Z");
  assert.deepEqual(upsert.update, { invoiceId: "12345" });
});

test("Bling authorization and reconciliation both ensure the title", () => {
  const source = readFileSync(
    join(__dirname, "integrations/bling/bling-outbox.service.ts"),
    "utf8",
  );
  assert.equal(source.match(/ensureSalesOrderReceivable\(/g)?.length, 2);
});
