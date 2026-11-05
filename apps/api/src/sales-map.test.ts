import assert from "node:assert/strict";
import test from "node:test";
import type { SalesMapNode } from "@bbos/shared";
import {
  buildSalesMap,
  previousPeriodWindow,
  type SalesMapOrder,
} from "./sales-map";

const findNode = (
  node: SalesMapNode,
  level: SalesMapNode["level"],
  code: string,
): SalesMapNode | undefined => {
  if (node.level === level && node.code === code) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, level, code);
    if (found) return found;
  }
  return undefined;
};

const currentOrder: SalesMapOrder = {
  id: "order-current",
  code: "B-2026-000100",
  totalAmount: 200,
  quantity: 3,
  customer: {
    id: "customer-1",
    name: "Café Centro",
    countryCode: "BR",
    countryName: "Brasil",
    state: "São Paulo",
    city: "São Paulo",
  },
  finishedProduct: null,
  items: [
    {
      productVariantId: "variant-1",
      productName: "Clássicos 500 g",
      quantity: 2,
      totalAmount: 120,
      productVariant: {
        netWeightGrams: 500,
        unitCost: 30,
        product: { id: "product-1", name: "Clássicos" },
      },
    },
    {
      productVariantId: "variant-2",
      productName: "Contemporâneos 1 kg",
      quantity: 1,
      totalAmount: 80,
      productVariant: {
        netWeightGrams: 1000,
        unitCost: 40,
        product: { id: "product-2", name: "Contemporâneos" },
      },
    },
  ],
};

const previousOrder: SalesMapOrder = {
  ...currentOrder,
  id: "order-previous",
  code: "B-2026-000099",
  totalAmount: 100,
  quantity: 1,
  items: [
    {
      ...currentOrder.items[0]!,
      quantity: 1,
      totalAmount: 100,
    },
  ],
};

test("buildSalesMap creates the real geographic drill-down from order data", () => {
  const map = buildSalesMap([currentOrder], [previousOrder]);
  const brazil = findNode(map, "country", "BR");
  const southeast = findNode(map, "region", "SUDESTE");
  const saoPaulo = findNode(map, "state", "SP");
  const city = findNode(map, "city", undefined as unknown as string);
  const customer = findNode(map, "customer", "customer-1");
  const product = findNode(map, "product", "product-1");
  const order = findNode(map, "order", "B-2026-000100");

  assert.equal(map.name, "Mundo");
  assert.equal(map.revenue, 200);
  assert.equal(map.volumeKg, 2);
  assert.equal(map.marginPercent, 50);
  assert.equal(map.growthPercent, 100);
  assert.equal(map.orderCount, 1);
  assert.equal(map.customerCount, 1);
  assert.equal(map.hasTarget, false);
  assert.equal(brazil?.revenue, 200);
  assert.equal(southeast?.name, "Sudeste");
  assert.equal(saoPaulo?.name, "São Paulo");
  assert.equal(city?.name, "São Paulo");
  assert.equal(customer?.name, "Café Centro");
  assert.equal(product?.revenue, 120);
  assert.equal(order?.revenue, 120);
});

test("buildSalesMap keeps unavailable margin and missing geography explicit", () => {
  const map = buildSalesMap(
    [
      {
        ...currentOrder,
        id: "order-without-address",
        code: "B-2026-000101",
        totalAmount: 50,
        customer: {
          id: "customer-2",
          name: "Cliente sem endereço",
          countryCode: null,
          countryName: null,
          state: null,
          city: null,
        },
        items: [],
        finishedProduct: {
          id: "legacy-product",
          name: "Produto legado",
          packageWeightG: 500,
        },
        quantity: 2,
      },
    ],
    [],
  );

  assert.equal(findNode(map, "country", "NI")?.name, "País não informado");
  assert.equal(map.volumeKg, 1);
  assert.equal(map.hasMargin, false);
  assert.equal(map.hasPreviousPeriod, false);
  assert.equal(map.hasTarget, false);
});

test("previousPeriodWindow compares the same elapsed calendar interval", () => {
  const currentStart = new Date("2026-11-01T00:00:00.000Z");
  const currentEnd = new Date("2026-11-05T09:30:00.000Z");
  const previous = previousPeriodWindow("month", currentStart, currentEnd);

  assert.equal(previous.start.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(previous.end.toISOString(), "2026-10-05T09:30:00.000Z");
});
