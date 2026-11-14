import assert from "node:assert/strict";
import test from "node:test";
import { buildCashFlowLines, buildCashFlowSeries } from "./finance-cashflow";

test("cash flow orders receivables and payables and calculates the running balance", () => {
  const lines = buildCashFlowLines({
    cash: 1_000,
    receivables: [
      {
        id: "r1",
        counterparty: "Cliente A",
        document: "NF 10",
        dueDate: "2099-01-10T12:00:00.000Z",
        amount: 500,
        status: "OPEN",
      },
    ],
    payables: [
      {
        id: "p1",
        counterparty: "Fornecedor B",
        description: "Energia",
        dueDate: "2099-01-05T12:00:00.000Z",
        amount: 200,
        status: "OPEN",
      },
    ],
  });

  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.kind, "PAYABLE");
  assert.equal(lines[0]?.balance, 800);
  assert.equal(lines[1]?.kind, "RECEIVABLE");
  assert.equal(lines[1]?.balance, 1_300);
});

test("draft and committed purchases are not counted again in planned cash flow", () => {
  const lines = buildCashFlowLines({
    cash: 100,
    purchases: [
      {
        id: "draft",
        purchaseNumber: "CP-1",
        supplier: "Fornecedor",
        dueDate: "2099-01-01T12:00:00.000Z",
        amount: 20,
        status: "RASCUNHO — NÃO COMPROMETE CAIXA",
        approvalStatus: "DRAFT",
      },
      {
        id: "committed",
        purchaseNumber: "CP-2",
        supplier: "Fornecedor",
        dueDate: "2099-01-02T12:00:00.000Z",
        amount: 20,
        status: "COMPROMETIDO / PROGRAMADO",
        approvalStatus: "APPROVED",
      },
      {
        id: "planned",
        purchaseNumber: "CP-3",
        supplier: "Fornecedor",
        dueDate: "2099-01-03T12:00:00.000Z",
        amount: 20,
        status: "PREVISTO — AGUARDANDO ACEITE",
        approvalStatus: "APPROVED",
      },
    ],
  });

  assert.deepEqual(
    lines.map((item) => item.document),
    ["CP-3"],
  );
  assert.equal(lines[0]?.balance, 80);
});

test("realized series reconstructs opening balance and ends at current cash", () => {
  const series = buildCashFlowSeries({
    cash: 130,
    transactions: [
      {
        id: "in",
        type: "RECEIPT",
        amount: 50,
        occurredAt: "2026-01-02T12:00:00.000Z",
      },
      {
        id: "out",
        type: "PAYMENT",
        amount: 20,
        occurredAt: "2026-01-03T12:00:00.000Z",
      },
    ],
    projection: [],
  });

  assert.deepEqual(
    series.actual.map((point) => point.balance),
    [150, 130],
  );
  assert.equal(series.projected[0]?.balance, 130);
});
