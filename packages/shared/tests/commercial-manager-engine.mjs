import assert from "node:assert/strict";
import test from "node:test";
import {
  percentChange,
  isInactiveCustomer,
  isOrderAttention,
  prioritizeCommercialAttention,
  representativeStatus,
  weightedPipeline,
} from "../dist/commercial-manager-engine.js";

test("pipeline vazio e ponderado usam somente valores reais", () => {
  assert.equal(weightedPipeline([]), 0);
  assert.equal(weightedPipeline([{ estimatedValue: 100_000, probability: 40 }]), 40_000);
});

test("comparação não é inventada sem período anterior", () => {
  assert.equal(percentChange(20_000, 0), null);
  assert.equal(percentChange(120, 100), 20);
});

test("meta zerada não produz falso estado crítico", () => {
  assert.equal(representativeStatus({ revenue: 0, target: 0, weightedPipeline: 0, elapsedRatio: 0.8 }), "ON_TRACK");
});

test("meta atingida ou superada prevalece", () => {
  assert.equal(representativeStatus({ revenue: 100, target: 100, weightedPipeline: 0, elapsedRatio: 0.8 }), "ABOVE_TARGET");
  assert.equal(representativeStatus({ revenue: 120, target: 100, weightedPipeline: 0, elapsedRatio: 0.8 }), "ABOVE_TARGET");
});

test("pipeline relevante mantém representante no caminho", () => {
  assert.equal(representativeStatus({ revenue: 60, target: 100, weightedPipeline: 45, elapsedRatio: 0.7 }), "ON_TRACK");
});

test("crítico exige avanço material do mês e projeção insuficiente", () => {
  assert.equal(representativeStatus({ revenue: 5, target: 100, weightedPipeline: 5, elapsedRatio: 0.1 }), "ATTENTION");
  assert.equal(representativeStatus({ revenue: 20, target: 100, weightedPipeline: 10, elapsedRatio: 0.8 }), "CRITICAL");
});

test("clientes sem comprar e pedidos atrasados geram atenção", () => {
  const now = new Date("2026-08-10T12:00:00Z");
  assert.equal(isInactiveCustomer(new Date("2026-05-01T12:00:00Z"), now), true);
  assert.equal(isInactiveCustomer(new Date("2026-08-01T12:00:00Z"), now), false);
  assert.equal(isOrderAttention(new Date("2026-08-09T12:00:00Z"), "CONFIRMED", now), true);
  assert.equal(isOrderAttention(new Date("2026-08-09T12:00:00Z"), "DELIVERED", now), false);
});

test("atenções vazias permanecem compactas e alertas respeitam prioridade", () => {
  assert.deepEqual(prioritizeCommercialAttention([]), []);
  const ordered = prioritizeCommercialAttention([
    { id: "opportunity", priority: "OPPORTUNITY" },
    { id: "critical", priority: "CRITICAL" },
    { id: "high", priority: "HIGH" },
  ]);
  assert.deepEqual(ordered.map((item) => item.id), ["critical", "high", "opportunity"]);
});
