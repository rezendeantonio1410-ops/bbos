import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { SalesOrdersService } from "./sales-orders.service";

test("sales order list and detail are isolated by company", async () => {
  const calls: Array<{ method: string; args: Record<string, unknown> }> = [];
  const service = new SalesOrdersService({} as never);
  Object.defineProperty(service, "database", {
    value: {
      salesOrder: {
        findMany: async (args: Record<string, unknown>) => {
          calls.push({ method: "findMany", args });
          return [];
        },
        findFirst: async (args: Record<string, unknown>) => {
          calls.push({ method: "findFirst", args });
          return { id: "order-a" };
        },
      },
    },
  });

  await service.list("company-a");
  await service.get("company-a", "order-a");
  await service.exportOverview("company-a");

  assert.deepEqual(calls[0]?.args.where, { companyId: "company-a" });
  assert.deepEqual(calls[1]?.args.where, {
    id: "order-a",
    companyId: "company-a",
  });
  assert.deepEqual(calls[2]?.args.where, {
    companyId: "company-a",
    salesChannel: { type: "EXPORTACAO" },
  });
});

test("export overview never assumes BRL when export currency is missing", async () => {
  const service = new SalesOrdersService({} as never);
  Object.defineProperty(service, "database", {
    value: {
      salesOrder: {
        findMany: async () => [
          {
            id: "export-a",
            code: "EXP-001",
            orderNumber: "EXP-001",
            status: "CONFIRMED",
            totalAmount: 12500,
            quantity: 1,
            orderedAt: new Date("2026-10-01T12:00:00.000Z"),
            expectedDeliveryDate: new Date("2026-11-01T12:00:00.000Z"),
            incoterm: "FOB",
            incotermLocation: "Santos",
            customerReference: null,
            customer: { name: "International Buyer" },
            salesChannel: { name: "Exportação", currency: null },
            items: [],
          },
        ],
      },
    },
  });

  const overview = await service.exportOverview("company-a");

  assert.deepEqual(overview.metrics.totalsByCurrency, [
    { currency: "UNSPECIFIED", amount: 12500 },
  ]);
  assert.equal(overview.items[0]?.currency, "UNSPECIFIED");
  assert.deepEqual(overview.items[0]?.readiness.missing, ["Moeda"]);
});

test("every sales order state transition loads the order inside company scope", () => {
  const source = readFileSync(
    join(__dirname, "sales-orders.service.ts"),
    "utf8",
  );
  const scopedOrderReads = source.match(/where:\s*\{\s*id,\s*companyId\s*\}/g);
  assert.ok(
    (scopedOrderReads?.length ?? 0) >= 7,
    "detail, confirmation, reservation, cancellation, shipment, transition and picking must be company-scoped",
  );
  assert.doesNotMatch(
    source,
    /async (confirm|reserve|cancel|ship|confirmPicking)\(id: string/,
  );
});

test("sales order controller derives order access from the signed session", () => {
  const source = readFileSync(
    join(__dirname, "sales-orders.controller.ts"),
    "utf8",
  );
  assert.match(source, /actorForOrder\(request, id\)/);
  assert.match(
    source,
    /this\.salesOrders\.list\(\(await this\.actor\(request\)\)\.companyId\)/,
  );
  assert.match(
    source,
    /nextOrderNumber\(\(await this\.actor\(request\)\)\.companyId\)/,
  );
  assert.match(source, /so\."companyId"=\$2/);
  assert.match(
    source,
    /Pedidos de exportação exigem Incoterm e local nomeado/,
  );
  assert.doesNotMatch(
    source,
    /this\.salesOrders\.(get|confirm|reserve|cancel|ship)\(id[,)]/,
  );
});
