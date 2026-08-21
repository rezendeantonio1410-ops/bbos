import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@bbos/database";
import {
  calculateBrokerCommission,
  ensureBrokerCommissionPayable,
} from "./broker-commission";

test("calcula corretagem percentual no backend", () => {
  assert.equal(calculateBrokerCommission(100_000, 1.5), 1_500);
});

test("não duplica a conta a pagar de corretagem", async () => {
  let creates = 0;
  const existing = { id: "payable-1" };
  const tx = {
    accountsPayable: {
      findUnique: async () => (creates ? existing : null),
      create: async () => {
        creates += 1;
        return existing;
      },
    },
  } as any;
  const purchase = {
    id: "purchase-1",
    companyId: "company-1",
    supplierId: "supplier-1",
    purchasedAt: new Date("2026-08-20"),
    expectedAt: null,
    purchaseNumber: "CP-2026-000001",
    totalValue: new Prisma.Decimal(100000),
    brokerId: "broker-1",
    brokerCommissionPercent: new Prisma.Decimal(1.5),
    brokerCommissionAmount: new Prisma.Decimal(1500),
  };
  await ensureBrokerCommissionPayable(tx, purchase);
  await ensureBrokerCommissionPayable(tx, purchase);
  assert.equal(creates, 1);
});
