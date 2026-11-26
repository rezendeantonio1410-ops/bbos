import assert from "node:assert/strict";
import test from "node:test";
import { billingEmailKeys, billingEmailSubject, renderBoletoIssuedEmail, renderInvoiceIssuedEmail, renderReceivableReminderEmail } from "./billing-emails";
import { buildBoletoPdf, itfModules } from "./boleto-pdf";
import { digitableLine, itauBarcode } from "./boleto-itau";

const assets = { logoUrl: "https://x/logo.png", sealUrl: "https://x/seal.png" };
const { barcode } = itauBarcode({ agency: "0057", account: "12345", wallet: "109", ourNumber: "7", due: new Date("2026-12-10T12:00:00Z"), amountCents: 295000 });
const line = digitableLine(barcode);
const content = { customerName: "Safras", orderCode: "PV-000041", invoiceNumber: "1234", dueDate: "2026-12-10T12:00:00Z", openCents: 295000, totalCents: 295000, pixCode: "PIX-ESTATICO", boleto: { digitableLine: line, pixCopyPaste: null } };

test("with a boleto, NF and reminder e-mails show the boleto instead of the loose Pix", () => {
  for (const html of [renderInvoiceIssuedEmail(content, assets), renderReceivableReminderEmail(content, assets)]) {
    assert.match(html, /Pague com boleto/);
    assert.match(html, new RegExp(line.slice(0, 5)));
    assert.doesNotMatch(html, /PIX-ESTATICO/);
  }
  assert.match(renderInvoiceIssuedEmail(content, assets), /o boleto em PDF/);
  const noBoleto = renderInvoiceIssuedEmail({ ...content, boleto: null }, assets);
  assert.match(noBoleto, /PIX-ESTATICO/);
});

test("boleto e-mail: subject with the NF, own idempotency key", () => {
  assert.equal(billingEmailSubject("BOLETO_ISSUED", content), "Boleto da NF 1234 · pedido PV-000041");
  assert.match(renderBoletoIssuedEmail(content, assets), /nota fiscal nº 1234/);
  assert.equal(billingEmailKeys.boleto("b1"), "notify:email:boleto:b1:issued");
});

test("boleto PDF carries the digitable line and a FEBRABAN-size barcode", () => {
  const pdf = buildBoletoPdf({
    digitableLine: line, barcode, ourNumber: "00000007", wallet: "109", agency: "0057", account: "12345",
    amountCents: 295000, dueDate: "2026-12-10T12:00:00Z", issueDate: "2026-11-27T12:00:00Z", yourNumber: "1234",
    payer: { name: "Safras Ltda", taxId: "12.345.678/0001-90", address: "Rua A, 10 - Londrina - PR" },
  });
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 2000);
  assert.equal(itfModules(barcode).width, 4 + 22 * 18 + 5);
});
