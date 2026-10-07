import assert from "node:assert/strict";
import test from "node:test";
import { MelhorEnvioShipmentService } from "./melhor-envio-shipment.service";

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
