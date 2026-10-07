import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  resolveSalesOrderType,
  SAMPLE_DEFAULT_SHIPPING_BOX,
  SAMPLE_FISCAL_PACKAGE_VALUE,
  sampleFiscalPrice,
  sampleFiscalSubtotalCents,
  sampleShippingPackages,
} from "./sales-order-sample-policy";

test("sample orders use the fixed fiscal-only package value", () => {
  assert.equal(SAMPLE_FISCAL_PACKAGE_VALUE, 1);
  assert.equal(sampleFiscalPrice(1), 1);
  assert.equal(sampleFiscalPrice(12), 12);
  assert.equal(sampleFiscalSubtotalCents(1), 100);
  assert.equal(sampleFiscalSubtotalCents(2), 200);
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
  const service = readFileSync(
    join(__dirname, "sales-orders.service.ts"),
    "utf8",
  );
  const controller = readFileSync(
    join(__dirname, "sales-orders.controller.ts"),
    "utf8",
  );
  const fiscal = readFileSync(
    join(__dirname, "integrations/bling/bling-outbox.service.ts"),
    "utf8",
  );
  const dashboard = readFileSync(
    join(__dirname, "dashboard.service.ts"),
    "utf8",
  );
  const paymentScheduleMigration = readFileSync(
    join(
      __dirname,
      "../../../packages/database/prisma/migrations/20261006014000_skip_sample_payment_schedule/migration.sql",
    ),
    "utf8",
  );

  assert.match(
    service,
    /target === "INVOICED" && order\.orderType !== "SAMPLE"/,
  );
  assert.match(controller, /paymentType = isSample\s*\? "SAMPLE"/);
  assert.match(controller, /isSample && freightResponsibility === "BISPO"/);
  assert.match(
    controller,
    /unitPrice: isSample\s*\? SAMPLE_FISCAL_PACKAGE_VALUE/,
  );
  assert.match(
    service,
    /orderType === "SAMPLE"\s*\? SAMPLE_FISCAL_PACKAGE_VALUE/,
  );
  assert.match(
    controller,
    /subtotalCents \+= isSample\s*\? sampleFiscalSubtotalCents\(item\.quantity\)/,
  );
  assert.match(controller, /sampleShippingPackages\(weightGrams\)/);
  assert.match(fiscal, /REMESSA DE AMOSTRA SEM VALOR COMERCIAL/);
  assert.match(fiscal, /naturezaOperacao/);
  assert.match(fiscal, /sampleCfopIsApplied/);
  assert.match(controller, /sampleFiscalRoute/);
  assert.match(dashboard, /orderType: "COMMERCIAL"/);
  assert.match(
    paymentScheduleMigration,
    /IF NEW\."orderType" = 'SAMPLE' THEN\s+RETURN NEW;/,
  );
});

test("invoice request waits for SEFAZ authorization before invoicing the order", () => {
  const controller = readFileSync(
    join(__dirname, "sales-orders.controller.ts"),
    "utf8",
  );
  const fiscal = readFileSync(
    join(__dirname, "integrations/bling/bling-outbox.service.ts"),
    "utf8",
  );
  const financialMigration = readFileSync(
    join(
      __dirname,
      "../../../packages/database/prisma/migrations/20261006170000_invoice_authorization_financials/migration.sql",
    ),
    "utf8",
  );
  const salesOrderService = readFileSync(
    join(__dirname, "sales-orders.service.ts"),
    "utf8",
  );

  assert.doesNotMatch(
    controller,
    /salesOrders\.transition\(actor\.companyId, id, "INVOICED"\)/,
  );
  assert.match(
    fiscal,
    /if \(sefaz\.status === "AUTHORIZED"\)[\s\S]*SET status='INVOICED'/,
  );
  assert.match(fiscal, /resetMissingSalesOrderInvoice/);
  assert.match(
    salesOrderService,
    /NF-e vigente precisa estar autorizada pela SEFAZ antes da expedição/,
  );
  assert.match(
    fiscal,
    /const updatePayload = \{[\s\S]*\.\.\.remoteOrder[\s\S]*method: "PUT"/,
  );
  assert.doesNotMatch(
    fiscal,
    /pedidos\/vendas[\s\S]{0,2000}method: "PATCH"/,
  );
  assert.match(fiscal, /isBlingSalesOrderInvoiceAlreadyGenerated/);
  assert.match(fiscal, /indicadorIe: this\.blingStateRegistrationIndicator/);
  assert.match(
    fiscal,
    /sefazStatusCode\) === 696[\s\S]*consumerFinalRepairAttempted/,
  );
  assert.match(
    fiscal,
    /recoverAfterNatureConsumerFinalFix[\s\S]*natureConsumerFinalRecoveryAttempted/,
  );
  assert.match(
    fiscal,
    /repairSampleInvoiceConsumerFinal[\s\S]*contribuinte: this\.blingStateRegistrationIndicator/,
  );
  assert.match(
    fiscal,
    /if \(sefaz\.status === "REJECTED"\)[\s\S]*SET status='READY_TO_SHIP',"invoicedAt"=NULL/,
  );
  assert.match(
    fiscal,
    /staleSalesOrderRecoveryAttempt === 0[\s\S]*DELETE FROM "IntegrationResourceMap"[\s\S]*return this\.processSalesOrderInvoice\(row, 1\)/,
  );
  assert.match(
    fiscal,
    /if \(salesMap\?\.externalId\)[\s\S]*isBlingNotFound\(error\)[\s\S]*"resourceType"='SALES_ORDER'[\s\S]*salesMap = null/,
  );
  assert.match(
    financialMigration,
    /OLD\.status::text = 'INVOICED'[\s\S]*NEW\."orderType" = 'SAMPLE'/,
  );
  assert.match(financialMigration, /ON CONFLICT \("salesOrderId"\) DO NOTHING/);
});
