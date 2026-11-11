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

  assert.deepEqual(calls[0]?.args.where, {
    companyId: "company-a",
    status: { not: "CANCELLED" },
  });
  assert.deepEqual(calls[1]?.args.where, {
    id: "order-a",
    companyId: "company-a",
  });
  assert.deepEqual(calls[2]?.args.where, {
    companyId: "company-a",
    salesChannel: { type: "EXPORTACAO" },
  });
});

test("sales role list excludes ecommerce and platform orders", async () => {
  let where: Record<string, unknown> | undefined;
  const service = new SalesOrdersService({} as never);
  Object.defineProperty(service, "database", {
    value: {
      salesOrder: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          where = args.where;
          return [];
        },
      },
    },
  });

  await service.list("company-a", true);

  assert.deepEqual(where, {
    companyId: "company-a",
    status: { not: "CANCELLED" },
    externalOrderId: null,
    importedAt: null,
    OR: [
      { salesChannelId: null },
      {
        salesChannel: {
          is: { type: { not: "ECOMMERCE" }, platformCode: null },
        },
      },
    ],
  });
});

test("seller dashboard receives the same ecommerce restriction", () => {
  const controller = readFileSync(
    join(__dirname, "dashboard.controller.ts"),
    "utf8",
  );
  const service = readFileSync(join(__dirname, "dashboard.service.ts"), "utf8");

  assert.match(controller, /request\.user!\.role === "SALES"/);
  assert.match(service, /excludePlatformOrders/);
  assert.match(service, /externalOrderId: null/);
  assert.match(service, /type: \{ not: "ECOMMERCE" \}/);
  assert.match(service, /channel\.type <> 'ECOMMERCE'/);
  assert.match(service, /roastedStock: excludePlatformOrders/);
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

test("insufficient stock responses explain the blocking item", () => {
  const service = new SalesOrdersService({} as never);
  const exception = (service as any).insufficient(
    { productName: "Raros", sku: "RAR-RAR-250", quantity: 1 },
    0,
  );

  assert.deepEqual(exception.getResponse(), {
    message:
      "Estoque insuficiente para Raros (RAR-RAR-250): solicitado 1, disponível 0, faltante 1.",
    code: "INSUFFICIENT_STOCK",
    product: "Raros",
    sku: "RAR-RAR-250",
    requested: 1,
    available: 0,
    missing: 1,
  });
});

test("sales order controller derives order access from the signed session", () => {
  const source = readFileSync(
    join(__dirname, "sales-orders.controller.ts"),
    "utf8",
  );
  assert.match(source, /actorForOrder\(request, id\)/);
  assert.match(source, /actor\.role === UserRole\.SALES/);
  assert.match(source, /assertOrderVisibleToActor\(actor, id\)/);
  assert.match(source, /externalOrderId: null/);
  assert.match(source, /type: \{ not: "ECOMMERCE" \}/);
  assert.match(
    source,
    /nextOrderNumber\(\(await this\.actor\(request\)\)\.companyId\)/,
  );
  assert.match(source, /so\."companyId"=\$2/);
  assert.match(source, /Pedidos de exportação exigem Incoterm e local nomeado/);
  assert.doesNotMatch(
    source,
    /this\.salesOrders\.(get|confirm|reserve|cancel|ship)\(id[,)]/,
  );
});

test("seller approval links cannot reveal ecommerce or platform orders", () => {
  const source = readFileSync(
    join(__dirname, "sales-order-approvals.controller.ts"),
    "utf8",
  );

  assert.match(source, /assertOrderVisibleToActor\(actor, orderId\)/);
  assert.match(source, /actor\.role !== UserRole\.SALES/);
  assert.match(source, /externalOrderId: null/);
  assert.match(source, /importedAt: null/);
  assert.match(source, /type: \{ not: "ECOMMERCE" \}/);
});
