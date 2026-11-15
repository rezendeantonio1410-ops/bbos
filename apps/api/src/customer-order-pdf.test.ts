import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerOrderPdf } from "./customer-order-pdf";

test("builds the customer order copy as a valid PDF without commission data", () => {
  const pdf = buildCustomerOrderPdf({
    orderCode: "B-2026-000123",
    orderStatus: "INVOICED",
    customerName: "Cliente Exemplo Ltda.",
    customerLegalName: "Cliente Exemplo Comércio Ltda.",
    customerTaxId: "12.345.678/0001-90",
    customerEmail: "financeiro@cliente.example",
    customerPhone: "+55 43 99999-9999",
    customerAddress: "Rua Exemplo, 123 - Londrina/PR - CEP 86000-000",
    orderDate: "2026-10-12T15:00:00.000Z",
    expectedDeliveryDate: "2026-10-13T15:00:00.000Z",
    paymentTerms: "À vista",
    freightResponsibility: "PICKUP",
    subtotalCents: 172200,
    discountCents: 0,
    freightCents: 0,
    totalCents: 172200,
    acceptedByName: "Responsável do cliente",
    acceptedAt: "2026-10-12T23:54:00.000Z",
    commissionAmountCents: 9250,
    items: [
      {
        name: "Café Gourmet White Label · 500 g",
        sku: "GOU-ESS-500",
        quantity: 33,
        unitPriceCents: 4200,
        totalCents: 138600,
      },
      {
        name: "Café Gourmet White Label · 1 kg",
        sku: "GOU-ESS-1KG",
        quantity: 4,
        unitPriceCents: 8400,
        totalCents: 33600,
      },
    ],
  });

  assert.equal(pdf.subarray(0, 8).toString("latin1"), "%PDF-1.4");
  const source = pdf.toString("latin1");
  assert.match(source, /B-2026-000123/);
  assert.match(source, /Cliente Exemplo Ltda\./);
  assert.match(source, /CONFIRMA/);
  assert.match(source, /\/Subtype \/Image/);
  assert.match(source, /\/Logo Do/);
  assert.match(source, /TOTAL DO PEDIDO/);
  assert.match(source, /PAGAMENTO VIA PIX/);
  assert.match(source, /Chave PIX/);
  assert.match(source, /13\.008\.726\/0001-12/);
  assert.match(source, /Identifique o pagamento com o pedido B-2026-000123/);
  assert.match(source, /Respons.vel do cliente/);
  assert.match(source, /GOU-ESS-500/);
  assert.doesNotMatch(source, /92,50/);
  assert.ok(pdf.length > 2_000);
});
