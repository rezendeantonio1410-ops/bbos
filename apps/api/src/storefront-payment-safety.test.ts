import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { InventoryReservationStatus, SalesOrderStatus } from "@bbos/database";
import { SalesOrdersService } from "./sales-orders.service";

test("checkout reserva estoque e confirma o pedido na mesma transação", async () => {
  const calls: string[] = [];
  const item = {
    id: "item-1",
    companyId: "company-1",
    productVariantId: "variant-1",
    productName: "Caramelo",
    sku: "CARAMELO-500",
    quantity: 2,
  };
  const balance = {
    id: "balance-1",
    companyId: "company-1",
    productVariantId: "variant-1",
    warehouseId: "warehouse-1",
    quantityOnHand: 10,
    reservedQuantity: 1,
  };
  const transaction = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join("?");
      calls.push(
        sql.includes('FROM "SalesOrder"') ? "lock-order" : "lock-stock",
      );
      return [
        { id: sql.includes('FROM "SalesOrder"') ? "order-1" : "balance-1" },
      ];
    },
    salesOrder: {
      findFirst: async () => ({
        id: "order-1",
        companyId: "company-1",
        status: SalesOrderStatus.DRAFT,
        items: [item],
        reservations: [],
      }),
      update: async ({ data }: any) => {
        calls.push(`order:${data.status}`);
        return { id: "order-1", ...data };
      },
    },
    finishedProduct: {
      findFirst: async () => balance,
      findUniqueOrThrow: async () => balance,
      update: async ({ data }: any) => {
        calls.push(`stock:+${data.reservedQuantity.increment}`);
        return balance;
      },
    },
    inventoryReservation: {
      create: async ({ data }: any) => {
        calls.push("reservation:create");
        return { id: "reservation-1", ...data };
      },
      findMany: async () => [
        {
          id: "reservation-1",
          status: InventoryReservationStatus.ACTIVE,
        },
      ],
    },
  };
  const service = new SalesOrdersService({} as never);
  Object.defineProperty(service, "database", {
    value: {
      $transaction: async (operation: (client: any) => unknown) =>
        operation(transaction),
    },
  });

  const result = await service.reserveForPayment("company-1", "order-1");

  assert.equal(result.status, SalesOrderStatus.RESERVED);
  assert.deepEqual(calls, [
    "lock-order",
    "lock-stock",
    "stock:+2",
    "reservation:create",
    `order:${SalesOrderStatus.RESERVED}`,
  ]);
});

test("fluxo da loja reutiliza cobrança e exige cancelamento antes de uma nova", () => {
  const source = readFileSync(
    join(__dirname, "storefront-orders.controller.ts"),
    "utf8",
  );

  assert.match(
    source,
    /activeAttempt\?\.externalId[\s\S]*activeAttempt\.metadata\?\.pix/,
  );
  assert.match(
    source,
    /await this\.reserveSalesOrderForPayment\(order\.id\);[\s\S]*await this\.cancelActiveMercadoPagoPayment\(order\);[\s\S]*ensureMercadoPagoCheckout\(order, retryKey, true\)/,
  );
  assert.match(
    source,
    /const retryKey = `retry-\$\{order\.id\}-\$\{order\.paymentExternalId \|\| "initial"\}`/,
  );
  assert.doesNotMatch(
    source,
    /retry-\$\{existing\[0\]\.id\}-\$\{Date\.now\(\)\}/,
  );
});
