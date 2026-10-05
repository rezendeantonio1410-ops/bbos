import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  resolveSalesOrderType,
  SAMPLE_DEFAULT_SHIPPING_BOX,
  SAMPLE_FISCAL_UNIT_VALUE,
  sampleFiscalPrice,
  sampleShippingPackages,
} from "./sales-order-sample-policy";

test("sample orders use the fixed fiscal-only unit value", () => {
  assert.equal(SAMPLE_FISCAL_UNIT_VALUE, 0.01);
  assert.equal(sampleFiscalPrice(1), 0.01);
  assert.equal(sampleFiscalPrice(12), 0.12);
});

test("unknown order types cannot bypass commercial pricing", () => {
  assert.equal(resolveSalesOrderType("sample"), "SAMPLE");
  assert.equal(resolveSalesOrderType("COMMERCIAL"), "COMMERCIAL");
  assert.equal(resolveSalesOrderType("free"), "COMMERCIAL");
  assert.equal(resolveSalesOrderType(undefined), "COMMERCIAL");
});

test("sample shipping reuses the standard Bispo box and splits weight safely", () => {
  assert.deepEqual(SAMPLE_DEFAULT_SHIPPING_BOX, {
    widthCm: 35,
    heightCm: 22,
    lengthCm: 11,
    maxWeightGrams: 2_500,
  });
  assert.deepEqual(sampleShippingPackages(500), [
    { widthCm: 35, heightCm: 22, lengthCm: 11, weightGrams: 500 },
  ]);
  assert.deepEqual(sampleShippingPackages(2_501), [
    { widthCm: 35, heightCm: 22, lengthCm: 11, weightGrams: 1_251 },
    { widthCm: 35, heightCm: 22, lengthCm: 11, weightGrams: 1_250 },
  ]);
  assert.deepEqual(sampleShippingPackages(5_001), [
    { widthCm: 35, heightCm: 22, lengthCm: 11, weightGrams: 1_667 },
    { widthCm: 35, heightCm: 22, lengthCm: 11, weightGrams: 1_667 },
    { widthCm: 35, heightCm: 22, lengthCm: 11, weightGrams: 1_667 },
  ]);
});

test("sample orders remain fiscal and operational without becoming revenue", () => {
  const service = readFileSync(join(__dirname, "sales-orders.service.ts"), "utf8");
  const controller = readFileSync(
    join(__dirname, "sales-orders.controller.ts"),
    "utf8",
  );
  const fiscal = readFileSync(
    join(__dirname, "integrations/bling/bling-outbox.service.ts"),
    "utf8",
  );
  const dashboard = readFileSync(join(__dirname, "dashboard.service.ts"), "utf8");

  assert.match(service, /target === "INVOICED" && order\.orderType !== "SAMPLE"/);
  assert.match(controller, /paymentType = isSample\s*\? "SAMPLE"/);
  assert.match(controller, /isSample && freightResponsibility === "BISPO"/);
  assert.match(controller, /sampleShippingPackages\(weightGrams\)/);
  assert.match(fiscal, /REMESSA DE AMOSTRA SEM VALOR COMERCIAL/);
  assert.match(dashboard, /orderType: "COMMERCIAL"/);
});
