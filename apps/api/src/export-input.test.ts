import assert from "node:assert/strict";
import test from "node:test";
import {
  ExportInputError,
  parseExportBuyer,
  parseExportContract,
  parseExportSample,
  parseSampleEvaluation,
  parseSampleStep,
  sampleAlert,
  stepEffects,
  trackingUrl,
} from "./export-input";

test("cliente externo: país em 2 letras, moeda e e-mail conferidos", () => {
  const buyer = parseExportBuyer({ name: " Yamato Coffee ", country: "jp", email: "Buyer@Yamato.JP", incoterm: "fob" });
  assert.equal(buyer.name, "Yamato Coffee");
  assert.equal(buyer.country, "JP");
  assert.equal(buyer.currency, "USD");
  assert.equal(buyer.incoterm, "FOB");
  assert.equal(buyer.email, "buyer@yamato.jp");
  assert.equal(buyer.status, "PROSPECT");
  assert.throws(() => parseExportBuyer({ name: "X", country: "Japão" }), ExportInputError);
  assert.throws(() => parseExportBuyer({ name: "X", country: "JP", email: "sem-arroba" }), ExportInputError);
  assert.throws(() => parseExportBuyer({ name: "X", country: "JP", currency: "ARS" }), ExportInputError);
});

test("amostra: peso, nota SCA, transportadora e código normalizado", () => {
  const sample = parseExportSample({ buyerId: "b1", lotReference: "Lote Sublime", weightGrams: "300", scaScore: "86,5", carrier: "dhl", trackingCode: "12 3456 7890" });
  assert.equal(sample.weightGrams, 300);
  assert.equal(sample.scaScore, 86.5);
  assert.equal(sample.carrier, "DHL");
  assert.equal(sample.trackingCode, "1234567890");
  assert.equal(sample.responseDays, 7);
  assert.equal(sample.coffeeType, "GREEN");
  assert.throws(() => parseExportSample({ buyerId: "b1", lotReference: "L", weightGrams: 0 }), ExportInputError);
  assert.throws(() => parseExportSample({ buyerId: "b1", lotReference: "L", weightGrams: 300, scaScore: 120 }), ExportInputError);
  assert.throws(() => parseExportSample({ buyerId: "b1", lotReference: "L", weightGrams: 300, carrier: "Jadlog" }), ExportInputError);
});

test("etapas: entregue abre o prazo de resposta; avaliação tem registro próprio", () => {
  const step = parseSampleStep({ status: "delivered", occurredAt: "2026-11-18T12:00:00Z" });
  assert.equal(step.status, "DELIVERED");
  const effects = stepEffects("DELIVERED", step.occurredAt, 7);
  assert.equal((effects.responseDueAt as Date).toISOString(), "2026-11-25T12:00:00.000Z");
  assert.deepEqual(Object.keys(stepEffects("SENT", new Date(), 7)), ["sentAt"]);
  assert.throws(() => parseSampleStep({ status: "EVALUATED" }), ExportInputError);
  assert.equal(parseSampleEvaluation({ result: "approved", buyerScore: "86" }).result, "APPROVED");
});

test("alertas: alfândega 3+ dias, resposta vencida e envio parado", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  assert.deepEqual(sampleAlert({ status: "CUSTOMS", lastEventAt: "2026-11-21T12:00:00Z" }, now), { kind: "CUSTOMS_STUCK", days: 4 });
  assert.equal(sampleAlert({ status: "CUSTOMS", lastEventAt: "2026-11-24T12:00:00Z" }, now), null);
  assert.equal(sampleAlert({ status: "DELIVERED", responseDueAt: "2026-11-25T11:00:00Z" }, now)?.kind, "FOLLOW_UP");
  assert.equal(sampleAlert({ status: "IN_TRANSIT", lastEventAt: "2026-11-10T12:00:00Z" }, now)?.kind, "NO_MOVEMENT");
  assert.equal(sampleAlert({ status: "EVALUATED" }, now), null);
});

test("contrato: quantidade, janela de embarque e unidade de preço", () => {
  const contract = parseExportContract({ buyerId: "b1", product: "Sublime", quantityKg: "1.200", unitPrice: "3,85", shipmentFrom: "2027-02-01", shipmentTo: "2027-03-31" });
  assert.equal(contract.quantityKg, 1200);
  assert.equal(contract.unitPrice, 3.85);
  assert.equal(contract.priceUnit, "PER_LB");
  assert.throws(() => parseExportContract({ buyerId: "b1", product: "S", quantityKg: 10, shipmentFrom: "2027-03-01", shipmentTo: "2027-02-01" }), ExportInputError);
});

test("link de rastreio de cada transportadora", () => {
  assert.match(trackingUrl("DHL", "123") ?? "", /dhl\.com.*tracking-id=123/);
  assert.match(trackingUrl("FEDEX", "9") ?? "", /fedex\.com.*trknbr=9/);
  assert.match(trackingUrl("UPS", "1Z") ?? "", /ups\.com.*tracknum=1Z/);
  assert.match(trackingUrl("CORREIOS", "LB1BR") ?? "", /correios\.com\.br.*LB1BR/);
  assert.match(trackingUrl("OTHER", "X1") ?? "", /17track/);
  assert.equal(trackingUrl("DHL", null), null);
});

test("amostra real de 11/11: 15 kg para a China, FedEx, pró-forma e valor declarado", () => {
  const sample = parseExportSample({
    buyerId: "b1", lotReference: "Green coffee sample (unroasted)", weightKg: "15", carrier: "FEDEX",
    trackingCode: "8799 5139 6830", reference: "bc-br-0001", proformaNumber: "BC-BR-PI-0001",
    declaredValue: "105", declaredCurrency: "usd", shippedByName: "Suzi",
  });
  assert.equal(sample.weightGrams, 15000);
  assert.equal(sample.trackingCode, "879951396830");
  assert.equal(sample.reference, "BC-BR-0001");
  assert.equal(sample.proformaNumber, "BC-BR-PI-0001");
  assert.equal(sample.declaredValue, 105);
  assert.equal(sample.declaredCurrency, "USD");
  const buyer = parseExportBuyer({ name: "Hainan Laoyouqian International Trade Co., Ltd.", country: "CN", city: "Shenzhen", taxId: "91460000MA5U1T6R74", legalRepresentative: "Hu Liping (胡立平)", contactName: "Mr Dong He", messenger: "WeChat 18676708112" });
  assert.equal(buyer.legalRepresentative, "Hu Liping (胡立平)");
  assert.equal(buyer.messenger, "WeChat 18676708112");
});
