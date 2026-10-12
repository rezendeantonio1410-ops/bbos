import assert from "node:assert/strict";
import test from "node:test";
import { SalesOrderCustomerLifecycleService } from "./sales-order-customer-lifecycle.service";

test("confirmed order queues one idempotent email for the linked partner", async () => {
  const notifications = new Map<string, unknown[]>();
  let eventAlreadyExists = false;
  const transaction = {
    $queryRawUnsafe: async (query: string) => {
      if (query.includes('FROM "SalesOrder"')) {
        return [
          {
            id: "order-1",
            companyId: "company-1",
            code: "B-2026-000123",
            status: "CONFIRMED",
            customerName: "Cliente Exemplo",
            email: null,
            totalAmount: 1722,
            brokerId: "broker-1",
            brokerName: "Gustavo Nivov",
            brokerEmail: "broker-legacy@example.com",
            brokerActive: true,
            partnerId: "partner-1",
            partnerName: "Gustavo Nivov",
            partnerEmail: " GUSTAVO@EXAMPLE.COM ",
            partnerActive: true,
            brokerCommissionMode: "PER_PACKAGE",
            brokerCommissionPerPackage: 2.5,
            brokerCommissionPercent: null,
            brokerCommissionAmount: 92.5,
            storefrontOrderId: null,
          },
        ];
      }
      if (query.includes('FROM "SalesOrderItem"')) {
        return [
          {
            name: "Café Gourmet White Label · 500 g",
            quantity: 33,
            unitPrice: 42,
            totalAmount: 1386,
          },
          {
            name: "Café Gourmet White Label · 1 kg",
            quantity: 4,
            unitPrice: 84,
            totalAmount: 336,
          },
        ];
      }
      if (query.includes('INSERT INTO "SalesOrderCustomerEvent"')) {
        return eventAlreadyExists ? [] : [{ id: "event-1" }];
      }
      throw new Error(`Consulta inesperada no teste: ${query}`);
    },
    $executeRawUnsafe: async (...args: unknown[]) => {
      const query = String(args[0]);
      if (!query.includes("PARTNER_ORDER_CONFIRMED")) return 1;
      const idempotencyKey = String(args[6]);
      if (!notifications.has(idempotencyKey)) {
        notifications.set(idempotencyKey, args);
      }
      return 1;
    },
  };
  const service = new SalesOrderCustomerLifecycleService();
  Object.defineProperty(service, "database", {
    value: {
      $transaction: async (
        operation: (client: typeof transaction) => unknown,
      ) => operation(transaction),
    },
  });

  await service.record(
    "order-1",
    "ORDER_CONFIRMED",
    "Pedido confirmado",
    "Pedido confirmado pela Bispo.",
    "BBOS",
    "sales-order:confirmed:order-1",
    {},
    false,
  );
  eventAlreadyExists = true;
  await service.record(
    "order-1",
    "ORDER_CONFIRMED",
    "Pedido confirmado",
    "Pedido confirmado pela Bispo.",
    "BBOS",
    "sales-order:confirmed:order-1",
    {},
    false,
  );

  assert.equal(notifications.size, 1);
  const write = [...notifications.values()][0]!;
  assert.equal(write[4], "gustavo@example.com");
  assert.equal(
    write[6],
    "notify:email:sales-order:order-1:partner-confirmed:partner-1",
  );
  const payload = JSON.parse(String(write[5]));
  assert.equal(payload.partnerName, "Gustavo Nivov");
  assert.equal(payload.customerName, "Cliente Exemplo");
  assert.equal(payload.packageQuantity, 37);
  assert.equal(payload.commissionMode, "PER_PACKAGE");
  assert.equal(payload.commissionPerPackageCents, 250);
  assert.equal(payload.commissionAmountCents, 9250);
});

test("confirmation without a valid partner email does not queue a message", async () => {
  let writes = 0;
  const transaction = {
    $queryRawUnsafe: async (query: string) => {
      if (query.includes('FROM "SalesOrder"')) {
        return [
          {
            id: "order-2",
            companyId: "company-1",
            code: "B-2026-000124",
            status: "CONFIRMED",
            customerName: "Cliente Exemplo",
            brokerId: "broker-2",
            brokerEmail: "sem-email-valido",
            brokerActive: true,
            partnerId: "partner-2",
            partnerName: "Parceiro sem e-mail",
            partnerEmail: null,
            partnerActive: true,
            storefrontOrderId: null,
          },
        ];
      }
      if (query.includes('FROM "SalesOrderItem"')) return [];
      if (query.includes('INSERT INTO "SalesOrderCustomerEvent"')) {
        return [{ id: "event-2" }];
      }
      throw new Error(`Consulta inesperada no teste: ${query}`);
    },
    $executeRawUnsafe: async (...args: unknown[]) => {
      if (String(args[0]).includes("PARTNER_ORDER_CONFIRMED")) writes += 1;
      return 1;
    },
  };
  const service = new SalesOrderCustomerLifecycleService();
  Object.defineProperty(service, "database", {
    value: {
      $transaction: async (
        operation: (client: typeof transaction) => unknown,
      ) => operation(transaction),
    },
  });

  await service.record(
    "order-2",
    "ORDER_CONFIRMED",
    "Pedido confirmado",
    "Pedido confirmado pela Bispo.",
    "BBOS",
    "sales-order:confirmed:order-2",
    {},
    false,
  );

  assert.equal(writes, 0);
});
