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

  assert.deepEqual(calls[0]?.args.where, { companyId: "company-a" });
  assert.deepEqual(calls[1]?.args.where, {
    id: "order-a",
    companyId: "company-a",
  });
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
  assert.doesNotMatch(
    source,
    /this\.salesOrders\.(get|confirm|reserve|cancel|ship)\(id[,)]/,
  );
});
