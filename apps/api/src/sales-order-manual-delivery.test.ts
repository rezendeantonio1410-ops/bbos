import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { SalesOrderStatus } from "@bbos/database";
import { SalesOrdersService } from "./sales-orders.service";

test("manual delivery dispatches inventory once and closes the order with audit", async () => {
  const lifecycle: unknown[][] = [];
  const updates: any[] = [];
  const service = new SalesOrdersService({
    record: async (...args: unknown[]) => lifecycle.push(args),
  } as never);

  Object.defineProperty(service, "database", {
    value: {
      salesOrder: {
        findFirst: async () => ({
          id: "order-1",
          status: SalesOrderStatus.INVOICED,
        }),
        update: async (input: any) => {
          updates.push(input);
          return input.data;
        },
      },
    },
  });

  const shipments: unknown[][] = [];
  service.ship = async (...args: any[]) => {
    shipments.push(args);
    return { orderId: "order-1", idempotent: false, movementIds: [] };
  };

  const result = await service.deliver("company-1", "order-1", {
    method: "MANUAL_DELIVERY",
    actorName: "José Rezende",
    actorRole: "ADMIN",
  });

  assert.equal(result.status, "DELIVERED");
  assert.equal(shipments.length, 1);
  assert.deepEqual(shipments[0]?.slice(0, 2), ["company-1", "order-1"]);
  assert.deepEqual(shipments[0]?.[2], {
    allowMissingCarrierLabel: true,
    skipCustomerNotification: true,
  });
  assert.equal(updates[0]?.data.status, SalesOrderStatus.DELIVERED);
  assert.ok(updates[0]?.data.deliveredAt instanceof Date);
  assert.equal(lifecycle[0]?.[1], "DELIVERED");
  assert.equal(lifecycle[0]?.[2], "Pedido entregue");
  assert.equal((lifecycle[0]?.[6] as any)?.actorName, "José Rezende");
});

test("orders screen exposes explicit shipment and completion actions", () => {
  const root = join(__dirname, "../../..");
  const page = readFileSync(
    join(root, "apps/web/src/app/(system)/pedidos/page.tsx"),
    "utf8",
  );
  const controller = readFileSync(
    join(root, "apps/api/src/sales-orders.controller.ts"),
    "utf8",
  );
  const dashboard = readFileSync(
    join(root, "apps/api/src/dashboard.service.ts"),
    "utf8",
  );

  assert.match(page, /Confirmar expedição/);
  assert.match(page, /Confirmar retirada e concluir/);
  assert.match(page, /Confirmar entrega e concluir/);
  assert.match(page, /operationalAction\("deliver", \{ method \}\)/);
  assert.match(page, /setCanCompleteDelivery\([\s\S]*?"SALES"/);
  assert.match(controller, /@Post\(":id\/deliver"\)/);
  assert.match(controller, /assertOrderVisibleToActor/);
  assert.match(
    dashboard,
    /!\["SHIPPED", "DELIVERED", "CANCELLED"\]\.includes\(o\.status\)/,
  );
});
