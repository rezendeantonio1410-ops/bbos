import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPurchaseConfirmationPdf,
  nextConfirmationVersion,
} from "./purchase-confirmation-pdf";

test("increments confirmation document versions without overwriting history", () => {
  assert.equal(nextConfirmationVersion([{ version: 1 }, { version: 3 }]), 4);
  assert.equal(nextConfirmationVersion([]), 1);
});

test("generates a PDF from the provided immutable snapshot", () => {
  const pdf = buildPurchaseConfirmationPdf({
    snapshot: {
      purchaseNumber: "CP-2026-000004",
      company: { name: "Bispo Coffees" },
      supplier: { name: "Cooperativa QA", municipality: "Londrina", state: "PR" },
      coffee: { harvest: "2026/27", species: "ARABICA", variety: "IPR_100" },
      quantity: { contractedWeightKg: 1000, volumeQuantity: 10 },
      commercial: { totalValue: 100000, currency: "BRL" },
    },
    version: 1,
    documentId: "doc-test",
    documentHash: "hash-test",
    createdAt: new Date("2026-08-21T12:00:00.000Z"),
  });
  const text = pdf.toString("latin1");
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /CP-2026-000004/);
  assert.match(text, /doc-test/);
  assert.match(text, /IPR 100/);
});
