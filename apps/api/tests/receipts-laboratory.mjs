import assert from "node:assert/strict";
import test from "node:test";
import { ReceiptsService } from "../dist/receipts.service.js";
import { LaboratoryService } from "../dist/laboratory.service.js";

const baseBody = {
  companyId: "company-1",
  supplierId: "supplier-1",
  warehouseId: "warehouse-1",
  origin: "Sul de Minas",
  variety: "Catuaí",
  weightKg: 100,
  costs: { coffeeValue: 1000, freight: 100, nonRecoverableTaxes: 20, unloading: 10, initialProcessing: 30, otherDirectCosts: 5 },
};

function receiptHarness({ activeUser = true } = {}) {
  const rows = { lots: [], samples: [], industrialEvents: [], costEvents: [] };
  const transaction = {
    user: { findFirst: async () => activeUser ? { id: "user-1" } : null },
    coffeeLot: { create: async ({ data }) => { const lot = { id: `lot-${rows.lots.length + 1}`, receivedAt: new Date("2026-08-12T12:00:00Z"), ...data }; rows.lots.push(lot); return lot; } },
    industrialEvent: { create: async ({ data }) => { rows.industrialEvents.push(data); return data; } },
    costEvent: { createMany: async ({ data }) => { rows.costEvents.push(...data); return { count: data.length }; } },
    labSample: { create: async ({ data }) => { const sample = { id: `sample-${rows.samples.length + 1}`, ...data }; rows.samples.push(sample); return sample; } },
  };
  const database = { $transaction: async (callback) => callback(transaction) };
  const service = new ReceiptsService();
  service.database = database;
  return { service, rows };
}

test("QUALITY_REVIEW cria exatamente uma LabSample PENDING e preserva eventos/custos", async () => {
  const { service, rows } = receiptHarness();
  const result = await service.create({ ...baseBody, lab: { moisturePercent: 12.1, waterActivity: 0.62, densityGPerL: 700, screen: "16", defects: 5, approval: "attention" } });
  assert.equal(result.status, "QUALITY_REVIEW");
  assert.equal(rows.samples.length, 1);
  assert.equal(rows.samples[0].status, "PENDING");
  assert.equal(rows.samples[0].sampleType, "ENTRY");
  assert.equal(rows.samples[0].lotId, rows.lots[0].id);
  assert.equal(rows.samples[0].sampleCode, `AM-${rows.lots[0].code}`);
  assert.equal(result.labSampleId, rows.samples[0].id);
  assert.equal(rows.industrialEvents.length, 1);
  assert.equal(rows.costEvents.length, 6);
});

for (const [approval, expectedStatus] of [["approved", "APPROVED"], ["rejected", "BLOCKED"]]) {
  test(`${expectedStatus} não cria LabSample automática`, async () => {
    const { service, rows } = receiptHarness();
    const result = await service.create({ ...baseBody, lab: { moisturePercent: 11, waterActivity: 0.5, densityGPerL: 700, screen: "16", defects: 2, approval } });
    assert.equal(result.status, expectedStatus);
    assert.equal(result.labSampleId, null);
    assert.equal(rows.samples.length, 0);
    assert.equal(rows.industrialEvents.length, 1);
    assert.equal(rows.costEvents.length, 6);
  });
}

test("ausência de usuário ativo falha antes de criar registros órfãos", async () => {
  const { service, rows } = receiptHarness({ activeUser: false });
  await assert.rejects(() => service.create(baseBody), /Nenhum usuário ativo/);
  assert.deepEqual(rows, { lots: [], samples: [], industrialEvents: [], costEvents: [] });
});

test("dashboard do LaboratoryService expõe PENDING e ASSIGNED na fila", async () => {
  const pending = { id: "sample-1", lotId: "lot-1", sampleCode: "AM-CV-1", sampleType: "ENTRY", status: "PENDING", createdAt: new Date(), lot: { code: "CV-1", origin: "Minas", variety: "Catuaí", receivedAt: new Date(), supplier: { name: "Fornecedor" } } };
  const assigned = { ...pending, id: "sample-2", status: "ASSIGNED" };
  const service = new LaboratoryService();
  let sampleQuery = 0;
  service.database = {
    cuppingSession: { findMany: async () => [] },
    labSample: { findMany: async () => ++sampleQuery === 1 ? [pending, assigned] : [pending, assigned] },
    cuppingDecision: { findMany: async () => [] },
    sensoryProfile: { findMany: async () => [] },
  };
  const dashboard = await service.dashboard();
  assert.deepEqual(dashboard.queue.map((item) => item.status), ["PENDING", "ASSIGNED"]);
  assert.equal(dashboard.queue[0].lot.supplier.name, "Fornecedor");
});
