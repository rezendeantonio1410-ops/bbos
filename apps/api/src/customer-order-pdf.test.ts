import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerOrderPdf } from "./customer-order-pdf";

test("builds the customer order copy as a valid PDF without commission data", () => {
  const pdf = buildCustomerOrderPdf({
    orderCode: "B-2026-000123",
    customerName: "Cliente Exemplo Ltda.",
    orderDate: "2026-10-12T15:00:00.000Z",
    expectedDeliveryDate: "2026-10-13T15:00:00.000Z",
    paymentTerms: "À vista",
    freightResponsibility: "PICKUP",
    subtotalCents: 172200,
    discountCents: 0,
    freightCents: 0,
    totalCents: 172200,
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
  assert.match(source, /GOU-ESS-500/);
  assert.doesNotMatch(source, /92,50/);
  assert.ok(pdf.length > 2_000);
});

