import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const controllerSource = readFileSync(
  resolve(__dirname, "sales-orders.controller.ts"),
  "utf8",
);
const outboxSource = readFileSync(
  resolve(__dirname, "integrations/bling/bling-outbox.service.ts"),
  "utf8",
);
const salesOrdersSource = readFileSync(
  resolve(__dirname, "sales-orders.service.ts"),
  "utf8",
);
const databaseSchema = readFileSync(
  resolve(__dirname, "../../../packages/database/prisma/schema.prisma"),
  "utf8",
);

test("international orders require foreign customer, fiscal route and exchange audit", () => {
  assert.match(controllerSource, /customer\.countryCode === "BR"/);
  assert.match(controllerSource, /exportFiscalRoute\(/);
  assert.match(controllerSource, /exchangeRateToBrl/);
  assert.match(controllerSource, /exchangeRateDate/);
  assert.match(
    controllerSource,
    /SELECT c\.name,c\."legalName",c\."taxId",c\."countryCode",c\."countryName",c\."foreignTaxId"/,
  );
});

test("Bling export draft is repaired and checked before SEFAZ transmission", () => {
  assert.match(outboxSource, /operacaoComExterior: true/);
  assert.match(outboxSource, /localEmbarque: route\.departureLocation/);
  assert.match(outboxSource, /tipoPessoa: "E"/);
  assert.match(
    outboxSource,
    /sampleCfopIsApplied\(updatedDraft\?\.itens, route\.cfop\)/,
  );
  assert.match(
    outboxSource,
    /repairExportInvoice[\s\S]*\/nfe\/\$\{encodeURIComponent\(blingNfeId\)\}\/enviar/,
  );
});

test("foreign-priced orders are converted to BRL before the fiscal draft", () => {
  assert.match(
    outboxSource,
    /valor: internationalSampleFiscal[\s\S]*roundCurrency\(Number\(item\.unitPrice\) \* exchangeRateToBrl\)/,
  );
  assert.match(
    outboxSource,
    /fiscalTotalBrl = internationalSampleFiscal[\s\S]*roundCurrency\(Number\(order\.totalAmount\) \* exchangeRateToBrl/,
  );
});

test("international samples use export CFOP and a separate customs value", () => {
  assert.match(
    controllerSource,
    /isSample &&[\s\S]*isExport &&[\s\S]*customsDeclaredValue/,
  );
  assert.match(
    controllerSource,
    /isSample && !isExport && freightResponsibility === "BISPO"/,
  );
  assert.match(
    outboxSource,
    /order\.orderType === "SAMPLE" && !isExport[\s\S]*sampleFiscalRoute/,
  );
  assert.match(outboxSource, /internationalSampleFiscalValues/);
  assert.match(outboxSource, /AMOSTRA INTERNACIONAL SEM VALOR COMERCIAL/);
});

test("green coffee export reserves approved lots in kilograms before invoicing", () => {
  assert.match(databaseSchema, /model GreenCoffeeSalesReservation/);
  assert.match(salesOrdersSource, /productLine: \{ code: "GREEN_COFFEE" \}/);
  assert.match(salesOrdersSource, /status='APPROVED'/);
  assert.match(
    salesOrdersSource,
    /currentWeightKg: \{ decrement: quantityKg \}/,
  );
  assert.match(
    salesOrdersSource,
    /reservedWeightKg: \{ increment: quantityKg \}/,
  );
  assert.match(salesOrdersSource, /WAITING_GREEN_COFFEE/);
});

test("green coffee is not converted into roasted WIP or finished packages", () => {
  assert.match(salesOrdersSource, /line\.code <> 'GREEN_COFFEE'/);
  assert.match(salesOrdersSource, /productLine\?\.code !== "GREEN_COFFEE"/);
});

test("shipping consumes the reserved green lot with an auditable event", () => {
  assert.match(salesOrdersSource, /movementType: "green-coffee-export-sale"/);
  assert.match(
    salesOrdersSource,
    /reservedWeightKg: \{ decrement: reservation\.quantityKg \}/,
  );
  assert.match(
    salesOrdersSource,
    /status: InventoryReservationStatus\.CONSUMED/,
  );
});
