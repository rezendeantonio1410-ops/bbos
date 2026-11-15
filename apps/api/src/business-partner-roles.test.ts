import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(join(__dirname, path), "utf8");

test("business partners are the master record for sales and coffee brokers", () => {
  const schema = read("../../../packages/database/prisma/schema.prisma");
  assert.match(schema, /isSalesPartner\s+Boolean\s+@default\(true\)/);
  assert.match(schema, /isSalesBroker\s+Boolean\s+@default\(false\)/);
  assert.match(
    schema,
    /isGreenCoffeeBroker\s+Boolean\s+@default\(false\)/,
  );
  assert.match(schema, /businessPartnerId\s+String\?\s+@unique/);
});

test("sales and green-coffee flows enforce the matching partner role", () => {
  const salesOrders = read("sales-orders.service.ts");
  const greenCoffee = read("green-coffee-purchases.controller.ts");
  assert.match(salesOrders, /JOIN "StorefrontPartner" partner/);
  assert.equal(salesOrders.match(/partner\."isSalesBroker" = TRUE/g)?.length, 2);
  assert.equal(
    greenCoffee.match(/isGreenCoffeeBroker:\s*true/g)?.length,
    2,
  );
});

test("partner writes keep the compatibility broker profile synchronized", () => {
  const partners = read("storefront-partners.controller.ts");
  assert.match(partners, /syncBrokerProfile/);
  assert.match(partners, /Habilite ao menos uma função/);
  assert.match(partners, /businessPartnerId:\s*partner\.id/);
  assert.match(partners, /broker\.id AS "brokerId"/);
});
