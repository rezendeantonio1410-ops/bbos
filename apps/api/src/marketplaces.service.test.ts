import assert from "node:assert/strict";
import test from "node:test";
import { MarketplacesService } from "./marketplaces.service";

const marketplaceChannel = {
  id: "channel-ml",
  code: "MERCADO_LIVRE",
  name: "Mercado Livre",
  platformCode: "MERCADO_LIVRE",
  connectionStatus: "NOT_CONNECTED",
  orders: 2,
  pending: 1,
  gross: "100",
  fees: "12",
  freight: "8",
  errors: 0,
};

const storeChannel = {
  id: "channel-store",
  code: "LOJA_BISPO",
  name: "Loja Bispo",
  platformCode: "BISPO_STORE",
  connectionStatus: "CONNECTED",
  orders: 3,
  pending: 2,
  gross: "165.50",
  fees: "0",
  freight: "15.50",
  errors: 0,
};

function createService() {
  const service = new MarketplacesService();
  const queries: string[] = [];
  const database = {
    $queryRawUnsafe: async (sql: string) => {
      queries.push(sql);
      if (sql.includes('LEFT JOIN "SalesOrder"')) return [storeChannel];
      if (sql.includes('LEFT JOIN "MarketplaceOrderInbox"')) {
        return [marketplaceChannel];
      }
      return [];
    },
  };
  Object.defineProperty(service, "database", { value: database });
  return { service, queries };
}

test("includes Loja Bispo first and consolidates its sales in channel totals", async () => {
  const { service } = createService();

  const result = await service.dashboard("company-1", "user-1", "ADMIN");

  assert.deepEqual(
    result.channels.map((channel) => channel.platformCode),
    ["BISPO_STORE", "MERCADO_LIVRE"],
  );
  assert.deepEqual(result.channels[0], {
    ...storeChannel,
    orders: 3,
    pending: 2,
    errors: 0,
    gross: 165.5,
    fees: 0,
    freight: 15.5,
    net: 150,
  });
  assert.deepEqual(result.summary, {
    gross: 265.5,
    net: 230,
    orders: 5,
    pending: 3,
    errors: 0,
  });
});

test("keeps the internal Loja Bispo channel hidden from marketplace operators", async () => {
  const { service, queries } = createService();

  const result = await service.dashboard(
    "company-1",
    "operator-1",
    "MARKETPLACE_OPERATOR",
  );

  assert.deepEqual(
    result.channels.map((channel) => channel.platformCode),
    ["MERCADO_LIVRE"],
  );
  assert.equal(
    queries.some((sql) => sql.includes('LEFT JOIN "SalesOrder"')),
    false,
  );
});
