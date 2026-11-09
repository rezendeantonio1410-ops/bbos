import assert from "node:assert/strict";
import test from "node:test";
import {
  MelhorEnvioShipmentService,
  normalizeMelhorEnvioTrackingStatus,
} from "./melhor-envio-shipment.service";

function createService(database: Record<string, unknown>) {
  const storefrontEvents: unknown[][] = [];
  const salesEvents: unknown[][] = [];
  const service = new MelhorEnvioShipmentService(
    {
      record: async (...args: unknown[]) => {
        storefrontEvents.push(args);
        return null;
      },
    } as never,
    {} as never,
    {
      record: async (...args: unknown[]) => {
        salesEvents.push(args);
        return null;
      },
    } as never,
  );
  Object.defineProperty(service, "database", { value: database });
  return { service, storefrontEvents, salesEvents };
}

test("reuses an existing storefront shipment in the operational order", async () => {
  const executions: Array<{ sql: string; params: unknown[] }> = [];
  const database = {
    $queryRawUnsafe: async (sql: string) => {
      if (sql.includes("SELECT so.*,q.package")) {
        return [
          {
            id: "sales-1",
            companyId: "company-1",
            storefrontOrderId: "store-1",
            shippingProvider: "MELHOR_ENVIO",
          },
        ];
      }
      if (sql.includes('FROM "FiscalDocument"')) {
        return [{ id: "fiscal-1", accessKey: "key-1" }];
      }
      if (sql.includes('FROM "Shipment"')) {
        return [
          {
            id: "shipment-1",
            storefrontOrderId: "store-1",
            salesOrderId: null,
            labelUrl: "https://example.com/label.pdf",
          },
        ];
      }
      return [];
    },
    $executeRawUnsafe: async (sql: string, ...params: unknown[]) => {
      executions.push({ sql, params });
      return 1;
    },
  };
  const { service, storefrontEvents } = createService(database);

  const result = await service.createLabelForSalesOrder("sales-1");

  assert.equal(result.idempotent, true);
  assert.equal(result.labelUrl, "https://example.com/label.pdf");
  assert.equal(storefrontEvents[0]?.[0], "store-1");
  assert.equal(
    executions.some(
      ({ sql, params }) =>
        sql.includes('"salesOrderId"=COALESCE') &&
        params.includes("sales-1") &&
        params.includes("store-1"),
    ),
    true,
  );
});

test("tracking updates both sides of an integrated storefront sale", async () => {
  const executions: string[] = [];
  const database = {
    $queryRawUnsafe: async () => [
      {
        id: "shipment-1",
        status: "LABEL_READY",
        storefrontOrderId: "store-1",
        salesOrderId: "sales-1",
      },
    ],
    $executeRawUnsafe: async (sql: string) => {
      executions.push(sql);
      return 1;
    },
  };
  const { service, storefrontEvents, salesEvents } = createService(database);

  const result = await service.applyTrackingUpdate(
    "shipment-external-1",
    "in_transit",
    {},
  );

  assert.equal(result.storefrontOrderId, "store-1");
  assert.equal(result.salesOrderId, "sales-1");
  assert.equal(storefrontEvents[0]?.[0], "store-1");
  assert.equal(salesEvents[0]?.[0], "sales-1");
  assert.equal(
    executions.some((sql) => sql.includes('UPDATE "StorefrontOrder"')),
    true,
  );
  assert.equal(
    executions.some((sql) => sql.includes('UPDATE "SalesOrder"')),
    true,
  );
});

test("never treats an unsuccessful delivery as delivered", () => {
  assert.equal(
    normalizeMelhorEnvioTrackingStatus("order.undelivered"),
    "undelivered",
  );
  assert.equal(
    normalizeMelhorEnvioTrackingStatus("A entrega não pode ser efetuada"),
    "undelivered",
  );
  assert.equal(
    normalizeMelhorEnvioTrackingStatus("Seu pacote será devolvido"),
    "returned",
  );
  assert.equal(
    normalizeMelhorEnvioTrackingStatus("order.delivered"),
    "delivered",
  );
});

test("opens a critical operational notification when delivery fails", async () => {
  const executions: Array<{ sql: string; params: unknown[] }> = [];
  const database = {
    $queryRawUnsafe: async () => [
      {
        id: "shipment-1",
        companyId: "company-1",
        status: "OUT_FOR_DELIVERY",
        storefrontOrderId: null,
        salesOrderId: "sales-1",
        salesOrderNumber: "B-2026-000018",
        customerName: "Signa Coffee",
      },
    ],
    $executeRawUnsafe: async (sql: string, ...params: unknown[]) => {
      executions.push({ sql, params });
      return 1;
    },
  };
  const { service, salesEvents } = createService(database);

  const result = await service.applyTrackingUpdate(
    "shipment-external-1",
    "order.undelivered",
    { data: { reason: "Endereço incorreto ou incompleto" } },
  );

  assert.equal(result.status, "EXCEPTION");
  assert.equal(salesEvents[0]?.[1], "UNDELIVERED");
  const notification = executions.find(({ sql }) =>
    sql.includes('INSERT INTO "OperationalNotification"'),
  );
  assert.ok(notification);
  assert.equal(notification.params.includes("company-1"), true);
  assert.match(String(notification.params.at(-1)), /B-2026-000018/);
  assert.match(String(notification.params.at(-1)), /Endereço incorreto/);
});

test("requires explicit confirmation that the returned package is back at Bispo", async () => {
  const { service } = createService({});

  await assert.rejects(
    () =>
      service.prepareReexpeditionForSalesOrder(
        "sales-1",
        { id: "user-1", companyId: "company-1", name: "José Rezende" },
        { returnConfirmed: false },
      ),
    /retornou fisicamente à Bispo/,
  );
});

test("blocks the old label endpoint while a reexpedition is active", async () => {
  const database = {
    $queryRawUnsafe: async (sql: string) => {
      if (sql.includes("SELECT so.*,q.package")) {
        return [
          {
            id: "sales-1",
            companyId: "company-1",
            shippingProvider: "MELHOR_ENVIO",
          },
        ];
      }
      if (sql.includes('FROM "SalesOrderReexpedition"')) {
        return [
          {
            id: "reexpedition-1",
            status: "AWAITING_FISCAL",
            attemptNumber: 1,
          },
        ];
      }
      return [];
    },
  };
  const { service } = createService(database);

  await assert.rejects(
    () => service.createLabelForSalesOrder("sales-1"),
    /etiqueta antiga não pode ser reutilizada/,
  );
});

test("prepares an audited reexpedition without replacing the original shipment", async () => {
  const transactionQueries: Array<{ sql: string; params: unknown[] }> = [];
  const tx = {
    $queryRawUnsafe: async (sql: string, ...params: unknown[]) => {
      transactionQueries.push({ sql, params });
      if (sql.includes("COALESCE(MAX")) return [{ next: 1 }];
      if (sql.includes('INSERT INTO "SalesOrderReexpedition"')) {
        return [
          {
            id: params[0],
            status: "AWAITING_FISCAL",
            attemptNumber: params[4],
            preparedAt: new Date("2026-11-08T22:45:00.000Z"),
            preparedByName: params[10],
            addressSnapshot: JSON.parse(String(params[6])),
          },
        ];
      }
      return [];
    },
    $executeRawUnsafe: async (sql: string, ...params: unknown[]) => {
      transactionQueries.push({ sql, params });
      return 1;
    },
  };
  const database = {
    $queryRawUnsafe: async () => [
      {
        id: "sales-1",
        companyId: "company-1",
        code: "WEB-20261019-46EE4F",
        shippingProvider: "MELHOR_ENVIO",
        destinationPostalCode: "81830250",
        storefrontOrderId: "store-1",
        storefrontDelivery: {
          name: "Alexandre Campanholi",
          phone: "41999999999",
          email: "alexandre@example.com",
          cpf: "12345678901",
          street: "Professor João Duck Filho",
          number: "107",
          complement: "Sobrado marrom",
          district: "Xaxim",
          city: "Curitiba",
          state: "PR",
          postalCode: "81830250",
        },
        shipmentId: "shipment-original-1",
        shipmentStatus: "IN_TRANSIT",
        hasUnresolvedDeliveryException: true,
        externalId: "melhor-envio-original-1",
        serviceName: "J&T Express",
        carrierName: "J&T Express",
        labelUrl: "https://example.com/original-label.pdf",
        trackingCode: "888030996570936",
        shipmentMetadata: { tracking_snapshot: { status: "in_transit" } },
        originalFiscalDocumentId: "fiscal-original-1",
        originalFiscalNumber: "000044",
      },
    ],
    $transaction: async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
  };
  const { service, storefrontEvents, salesEvents } = createService(database);

  const result = await service.prepareReexpeditionForSalesOrder(
    "sales-1",
    { id: "user-1", companyId: "company-1", name: "José Rezende" },
    { returnConfirmed: true },
  );

  assert.equal(result.status, "AWAITING_FISCAL");
  assert.equal(result.attemptNumber, 1);
  assert.equal(result.addressSnapshot.number, "107");
  assert.match(result.nextAction, /documento fiscal/);
  assert.equal(storefrontEvents[0]?.[1], "EXCEPTION");
  assert.equal(salesEvents[0]?.[1], "REEXPEDITION_PREPARED");
  const inserted = transactionQueries.find(({ sql }) =>
    sql.includes('INSERT INTO "SalesOrderReexpedition"'),
  );
  assert.ok(inserted);
  assert.match(String(inserted.params[6]), /"number":"107"/);
  assert.equal(
    transactionQueries.some(({ sql }) => sql.includes('UPDATE "Shipment"')),
    true,
  );
});
