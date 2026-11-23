import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { SalesOrderStatus } from "@bbos/database";
import { SalesOrdersService } from "./sales-orders.service";

test("manual delivery dispatches inventory once and closes the order with audit", async () => {
  const lifecycle: unknown[][] = [];
  const updates: any[] = [];
  const shipmentUpdates: unknown[][] = [];
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
      $executeRawUnsafe: async (...args: unknown[]) => {
        shipmentUpdates.push(args);
        return 1;
      },
    },
  });

  const shipments: unknown[][] = [];
  service.ship = async (...args: any[]) => {
    shipments.push(args);
    return {
      orderId: "order-1",
      idempotent: false,
      movementIds: [],
      greenReservationIds: [],
    };
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
  assert.equal(shipmentUpdates.length, 1);
  assert.match(String(shipmentUpdates[0]?.[0]), /status='DELIVERED'/);
  assert.match(String(shipmentUpdates[0]?.[4]), /manualDeliveryConfirmedAt/);
  assert.equal(lifecycle[0]?.[1], "DELIVERED");
  assert.equal(lifecycle[0]?.[2], "Pedido entregue");
  assert.equal((lifecycle[0]?.[6] as any)?.actorName, "José Rezende");
});

test("authorized cash shipment carries executive identity and does not mark a payment as received", async () => {
  const shipments: unknown[][] = [];
  const service = new SalesOrdersService({
    record: async () => null,
  } as never);
  Object.defineProperty(service, "database", {
    value: {
      salesOrder: {
        findFirst: async () => ({ id: "order-cash", status: SalesOrderStatus.INVOICED }),
        update: async () => ({}),
      },
      $executeRawUnsafe: async () => 1,
    },
  });
  service.ship = async (...args: unknown[]) => {
    shipments.push(args);
    return { orderId: "order-cash", idempotent: false };
  };
  await service.deliver("company-1", "order-cash", {
    method: "PICKUP",
    actorName: "José",
    actorRole: "ADMIN",
    unpaidReleaseAuthorizedBy: { actorId: "admin-1", name: "José", role: "ADMIN" },
  });
  assert.deepEqual(shipments[0]?.[2], {
    allowMissingCarrierLabel: true,
    skipCustomerNotification: true,
    unpaidReleaseAuthorizedBy: { actorId: "admin-1", name: "José", role: "ADMIN" },
  });
});

test("unpaid shipment requires designated executive and creates private audit within shipment transaction", () => {
  const root = join(__dirname, "../../..");
  const service = readFileSync(join(root, "apps/api/src/sales-orders.service.ts"), "utf8");
  const controller = readFileSync(join(root, "apps/api/src/sales-orders.controller.ts"), "utf8");
  const page = readFileSync(join(root, "apps/web/src/app/(system)/pedidos/page.tsx"), "utf8");
  assert.match(controller, /isDesignatedTermCreditApprover\(actor\)/);
  assert.match(controller, /unpaidReleaseAuthorizedBy: this\.unpaidShipmentAuthorizer\(actor\)/);
  assert.match(service, /if \(!paymentRows\[0\]\?\.paid\) \{/);
  assert.match(service, /unpaidReleaseAuthorizedBy/);
  assert.match(service, /UNPAID_SHIPMENT_AUTHORIZED/);
  assert.match(service, /'ADMIN',FALSE/);
  assert.match(service, /paymentPendingAtAuthorization: true/);
  assert.match(service, /A NF-e vigente precisa estar autorizada pela SEFAZ/);
  assert.match(service, /Pedido não possui reservas ativas/);
  assert.doesNotMatch(page, /A expedição permanece bloqueada\s+até a baixa financeira/);
  assert.match(page, /O recebimento continuará pendente até a conciliação/);
});

test("an already delivered order still reconciles a stale carrier exception", async () => {
  const lifecycle: unknown[][] = [];
  const shipmentUpdates: unknown[][] = [];
  const service = new SalesOrdersService({
    record: async (...args: unknown[]) => lifecycle.push(args),
  } as never);

  Object.defineProperty(service, "database", {
    value: {
      salesOrder: {
        findFirst: async () => ({
          id: "order-delivered",
          status: SalesOrderStatus.DELIVERED,
        }),
      },
      $executeRawUnsafe: async (...args: unknown[]) => {
        shipmentUpdates.push(args);
        return 1;
      },
    },
  });

  const result = await service.deliver("company-1", "order-delivered", {
    method: "MANUAL_DELIVERY",
    actorName: "José Rezende",
    actorRole: "ADMIN",
  });

  assert.equal(result.status, "DELIVERED");
  assert.equal(result.idempotent, true);
  assert.equal(result.shipmentReconciled, true);
  assert.equal(shipmentUpdates.length, 1);
  assert.match(String(shipmentUpdates[0]?.[0]), /status='DELIVERED'/);
  assert.equal(lifecycle[0]?.[2], "Entrega confirmada no BBOS");
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
  assert.match(page, /const canFinalizeDelivery/);
  assert.match(page, /const canReconcileDeliveredException/);
  assert.match(page, /Confirmar entrega e encerrar pendência/);
  assert.match(page, /overflow-y-auto overscroll-contain/);
  assert.match(page, /\["OVERDUE", "Atrasados"\]/);
  assert.match(page, /searchParams\.get\("filtro"\) === "atrasados"/);
  assert.match(page, /Abrir e resolver/);
  assert.match(page, /operationalAction\("deliver", \{ method \}\)/);
  assert.match(page, /setCanCompleteDelivery\([\s\S]*?"SALES"/);
  assert.match(controller, /@Post\(":id\/deliver"\)/);
  assert.match(controller, /assertOrderVisibleToActor/);
  assert.match(
    dashboard,
    /!\["SHIPPED", "DELIVERED", "CANCELLED"\]\.includes\(o\.status\)/,
  );
  assert.match(dashboard, /\/pedidos\?filtro=atrasados/);
  assert.match(dashboard, /Resolver atrasos/);
  assert.match(dashboard, /WITH effective_shipments AS/);
  assert.match(
    dashboard,
    /CASE WHEN shipment\.id=reexpedition\."replacementShipmentId" THEN 0 ELSE 1 END/,
  );
  assert.match(dashboard, /so\.status NOT IN \('DELIVERED','CANCELLED'\)/);
  assert.match(dashboard, /resolved\.status='DELIVERED'/);
});
