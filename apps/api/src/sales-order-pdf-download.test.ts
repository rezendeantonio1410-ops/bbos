import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSalesOrderPdfDownload,
  pdfContentDisposition,
} from "./sales-order-pdf-download";

test("downloads a populated order PDF with a readable customer filename", async () => {
  const order = {
    id: "order-1",
    code: "B-2026-000006",
    orderNumber: "B-2026-000006",
    orderType: "COMMERCIAL",
    status: "INVOICED",
    orderedAt: new Date("2026-10-12T15:00:00.000Z"),
    expectedDeliveryDate: new Date("2026-10-13T15:00:00.000Z"),
    subtotal: 1722,
    discount: 0,
    freight: 0,
    totalAmount: 1722,
    paymentType: "TERM",
    paymentTermsSnapshot: "7 dias",
    freightResponsibility: "PICKUP",
    customer: {
      name: "HUIOS BARBEARIA",
      legalName: "HUIOS BARBEARIA LTDA",
      taxId: "58.210.699/0001-02",
      email: "cliente@example.com",
      address: "Rua Georgetown",
      addressNumber: "52",
      district: "Guanabara",
      city: "Londrina",
      state: "PR",
      postalCode: "86050-130",
    },
    items: [
      {
        productName: "Café Gourmet White Label - 500 g",
        sku: "GOU ESS 500",
        quantity: 33,
        unitPrice: 42,
        totalAmount: 1386,
      },
      {
        productName: "Café Gourmet White Label - 1 kg",
        sku: "GOU ESS 1 KG",
        quantity: 4,
        unitPrice: 84,
        totalAmount: 336,
      },
    ],
  };
  const { body, fileName } = buildSalesOrderPdfDownload(order, {
    acceptedByName: "Responsável do cliente",
    acceptedAt: new Date("2026-10-12T23:54:00.000Z"),
  });

  assert.equal(fileName, "Pedido - HUIOS BARBEARIA - B-2026-000006.pdf");
  assert.match(
    pdfContentDisposition(fileName),
    /Pedido - HUIOS BARBEARIA - B-2026-000006\.pdf/,
  );
  assert.equal(body.subarray(0, 8).toString("latin1"), "%PDF-1.4");
  assert.ok(body.length > 4_000);
  const source = body.toString("latin1");
  assert.match(source, /HUIOS BARBEARIA LTDA/);
  assert.match(source, /GOU ESS 500/);
});
