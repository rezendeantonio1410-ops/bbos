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

test("international orders require foreign customer, fiscal route and exchange audit", () => {
  assert.match(controllerSource, /customer\.countryCode === "BR"/);
  assert.match(controllerSource, /exportFiscalRoute\(/);
  assert.match(controllerSource, /exchangeRateToBrl/);
  assert.match(controllerSource, /exchangeRateDate/);
});

test("Bling export draft is repaired and checked before SEFAZ transmission", () => {
  assert.match(outboxSource, /operacaoComExterior: true/);
  assert.match(outboxSource, /localEmbarque: route\.departureLocation/);
  assert.match(outboxSource, /tipoPessoa: "E"/);
  assert.match(outboxSource, /sampleCfopIsApplied\(updatedDraft\?\.itens, route\.cfop\)/);
  assert.match(
    outboxSource,
    /repairExportInvoice[\s\S]*\/nfe\/\$\{encodeURIComponent\(blingNfeId\)\}\/enviar/,
  );
});

test("foreign-priced orders are converted to BRL before the fiscal draft", () => {
  assert.match(
    outboxSource,
    /valor: roundCurrency\(Number\(item\.unitPrice\) \* exchangeRateToBrl\)/,
  );
  assert.match(
    outboxSource,
    /fiscalTotalBrl = roundCurrency\([\s\S]*Number\(order\.totalAmount\) \* exchangeRateToBrl/,
  );
});
