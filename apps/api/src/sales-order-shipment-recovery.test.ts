import assert from "node:assert/strict";
import test from "node:test";
import { InventoryReservationStatus, SalesOrderStatus } from "@bbos/database";
import { SalesOrdersService } from "./sales-orders.service";

test("recupera o estado faturado antes da baixa física e da expedição", async () => {
  const calls: string[] = [];
  const transaction = {
    salesOrder: {
      findFirst: async () => ({
        id: "sales-1",
        companyId: "company-1",
        code: "WEB-1",
        status: SalesOrderStatus.READY_TO_SHIP,
        invoicedAt: null,
        shippingProvider: "MELHOR_ENVIO",
        reservations: [
          {
            id: "reservation-1",
            companyId: "company-1",
            salesOrderId: "sales-1",
            salesOrderItemId: "item-1",
            productVariantId: "variant-1",
            finishedProductId: "finished-1",
            warehouseId: "warehouse-1",
            quantity: 1,
            status: InventoryReservationStatus.ACTIVE,
            productVariant: { salesUnit: "UN", netWeightGrams: 500 },
          },
        ],
        finishedGoodsMovements: [],
      }),
      update: async ({ data }: any) => {
        calls.push(`order:${data.status}`);
        return { id: "sales-1", ...data };
      },
    },
    $queryRawUnsafe: async (sql: string) =>
      sql.includes('FROM "FiscalDocument"')
        ? [{ status: "AUTHORIZED" }]
        : [{ status: "LABEL_READY", labelUrl: "https://label.example" }],
    $queryRaw: async () => [{ id: "finished-1" }],
    finishedProduct: {
      findUniqueOrThrow: async () => ({
        id: "finished-1",
        quantityOnHand: 10,
        reservedQuantity: 1,
      }),
      update: async () => {
        calls.push("stock:decrement");
      },
    },
    finishedGoodsMovement: {
      create: async ({ data }: any) => {
        calls.push("movement:SALE_OUT");
        return { id: "movement-1", ...data };
      },
    },
    inventoryReservation: {
      update: async () => {
        calls.push("reservation:CONSUMED");
      },
    },
  };
  const lifecycle: unknown[][] = [];
  const service = new SalesOrdersService({
    record: async (...args: unknown[]) => lifecycle.push(args),
  } as never);
  Object.defineProperty(service, "database", {
    value: {
      $transaction: async (operation: (client: any) => unknown) =>
        operation(transaction),
    },
  });

  const result = await service.ship("company-1", "sales-1");

  assert.equal(result.idempotent, false);
  assert.deepEqual(calls, [
    `order:${SalesOrderStatus.INVOICED}`,
    "stock:decrement",
    "movement:SALE_OUT",
    "reservation:CONSUMED",
    `order:${SalesOrderStatus.SHIPPED}`,
  ]);
  assert.equal(lifecycle[0]?.[1], "SHIPPED");
});
