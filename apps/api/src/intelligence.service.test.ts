import assert from "node:assert/strict";
import test from "node:test";
import { IntelligenceService } from "./intelligence.service";

const emptyHome = {
  salesToday: 0,
  salesMonth: 0,
  openOrders: 0,
  overdueOrders: 0,
  productionActualKg: 0,
  productionPlannedKg: 0,
  pendingLab: 0,
  openPurchases: 0,
  finishedGoodsUnits: 0,
  finishedGoodsReserved: 0,
  greenLots: [],
  alerts: [],
};

const emptyExports = {
  metrics: {
    orders: 0,
    open: 0,
    ready: 0,
    attention: 0,
    totalsByCurrency: [] as Array<{ currency: string; amount: number }>,
  },
  items: [],
  source: "database",
  updatedAt: new Date().toISOString(),
};

const emptyCosts = {
  period: null,
  periodStatus: "OPEN",
  source: "database",
  metrics: {
    industrialCost: 0,
    averageCostPerKg: 0,
    energy: 0,
    gas: 0,
    maintenance: 0,
    budgetVariance: 0,
  },
  byNature: [],
  products: [],
};

function createService(overrides?: {
  home?: typeof emptyHome;
  exports?: typeof emptyExports;
  costs?: typeof emptyCosts;
}) {
  return new IntelligenceService(
    { home: async () => overrides?.home ?? emptyHome } as never,
    { exportOverview: async () => overrides?.exports ?? emptyExports } as never,
    { summary: async () => overrides?.costs ?? emptyCosts } as never,
  );
}

test("answers an overdue-order question with grounded company data", async () => {
  const service = createService({
    home: { ...emptyHome, salesMonth: 14800, openOrders: 7, overdueOrders: 2 },
  });

  const result = await service.ask("company-a", {
    path: "/pedidos",
    question: "Há pedidos atrasados?",
  });

  assert.match(result.answer, /2 pedido\(s\) atrasado\(s\)/);
  assert.equal(result.generative, false);
  assert.equal(result.mode, "OPERATIONAL_RULES");
  assert.deepEqual(
    result.facts.find((fact) => fact.label === "Pedidos atrasados"),
    { label: "Pedidos atrasados", value: "2", href: "/pedidos" },
  );
});

test("does not interpret an empty operational base as a healthy operation", async () => {
  const result = await createService().ask("company-a", {
    path: "/home",
    question: "Onde existe uma oportunidade?",
  });

  assert.match(result.answer, /não há movimentação operacional suficiente/i);
  assert.doesNotMatch(result.answer, /tudo (está|esta) bem/i);
});

test("surfaces incomplete export readiness from the export command center", async () => {
  const service = createService({
    exports: {
      ...emptyExports,
      metrics: {
        orders: 4,
        open: 3,
        ready: 1,
        attention: 2,
        totalsByCurrency: [{ currency: "USD", amount: 12500 }],
      },
    },
  });

  const result = await service.ask("company-a", {
    path: "/exportacoes",
    question: "O que exige atenção?",
  });

  assert.match(
    result.answer,
    /2 pedido\(s\) internacional\(is\) exigem completar/,
  );
  assert.equal(result.facts.at(-1)?.value, "US$ 12.500");
});

test("refuses to assert margins before a cost period exists", async () => {
  const result = await createService().ask("company-a", {
    path: "/custos",
    question: "Qual produto tem a melhor margem?",
  });

  assert.match(result.answer, /não há período de custos calculado/i);
  assert.match(result.answer, /não afirma margem/i);
});
