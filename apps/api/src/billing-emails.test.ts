import assert from "node:assert/strict";
import test from "node:test";
import {
  billingEmailKeys,
  billingEmailSubject,
  billingEmailsActivation,
  replacedByInvoiceEmail,
  formatDueDate,
  isTrustedFiscalUrl,
  reminderDueDate,
  renderInvoiceIssuedEmail,
  renderReceivablePaidEmail,
  renderReceivableReminderEmail,
} from "./billing-emails";
import {
  NotificationSkipped,
  composeBillingEmail,
  primaryEmail,
} from "./billing-email.service";

const assets = { logoUrl: "https://x/logo.png", sealUrl: "https://x/seal.png" };

test("billing e-mails stay off until an activation date is configured", () => {
  assert.equal(billingEmailsActivation({}), null);
  assert.equal(billingEmailsActivation({ BBOS_BILLING_EMAILS_ENABLED_AT: "amanhã" }), null);
  assert.equal(
    billingEmailsActivation({ BBOS_BILLING_EMAILS_ENABLED_AT: "2026-12-01T00:00:00-03:00" })?.toISOString(),
    "2026-12-01T03:00:00.000Z",
  );
});

test("reminder targets the due date two days ahead, only from 8h in São Paulo", () => {
  // 10:00 UTC = 07:00 in São Paulo → too early
  assert.equal(reminderDueDate(new Date("2026-11-24T10:00:00Z")), null);
  // 12:00 UTC = 09:00 in São Paulo
  assert.equal(reminderDueDate(new Date("2026-11-24T12:00:00Z")), "2026-11-26");
  // 02:00 UTC on the 25th is still the 24th at 23:00 in São Paulo
  assert.equal(reminderDueDate(new Date("2026-11-25T02:00:00Z")), "2026-11-26");
  assert.equal(reminderDueDate(new Date("2026-12-30T15:00:00Z")), "2027-01-01");
});

test("idempotency keys are stable per document and due date", () => {
  assert.equal(billingEmailKeys.invoice("fd1"), "notify:email:fiscal:fd1:invoice-issued");
  assert.equal(billingEmailKeys.reminder("ar1", "2026-11-26"), "notify:email:receivable:ar1:reminder:2026-11-26");
  assert.equal(billingEmailKeys.paid("ar1"), "notify:email:receivable:ar1:paid");
});

test("only Bling HTTPS links are downloaded", () => {
  assert.equal(isTrustedFiscalUrl("https://www.bling.com.br/doc.view.php?id=1"), true);
  assert.equal(isTrustedFiscalUrl("http://www.bling.com.br/doc.view.php"), false);
  assert.equal(isTrustedFiscalUrl("https://bling.com.br.evil.com/x"), false);
  assert.equal(isTrustedFiscalUrl("https://169.254.169.254/latest"), false);
});

test("customer e-mail field picks the first valid address", () => {
  assert.equal(primaryEmail(" Compras@Cafe.com.br; financeiro@cafe.com.br"), "compras@cafe.com.br");
  assert.equal(primaryEmail("sem email"), "");
  assert.equal(primaryEmail(null), "");
});

test("templates carry order, NF, due date and friendly copy", () => {
  const content = {
    customerName: "Café da Praça Ltda",
    orderCode: "B-2026-000150",
    invoiceNumber: "1234",
    totalCents: 45000,
    dueDate: "2026-12-10T00:00:00.000Z",
    openCents: 45000,
    pixCode: "000201PIX",
    items: [{ name: "Bispo Catuaí 1kg", quantity: 3, totalCents: 45000 }],
  };
  assert.equal(formatDueDate(content.dueDate), "10/12/2026");
  const invoice = renderInvoiceIssuedEmail(content, assets);
  assert.match(invoice, /Olá, Café da Praça Ltda! Seu pedido B-2026-000150 foi faturado/);
  assert.match(invoice, /nº 1234/);
  assert.match(invoice, /10\/12\/2026/);
  assert.match(invoice, /000201PIX/);
  assert.match(invoice, /QR Code Pix/);
  assert.equal(billingEmailSubject("INVOICE_ISSUED", content), "Nota fiscal 1234 e cobrança · pedido B-2026-000150");

  const cash = renderInvoiceIssuedEmail({ ...content, dueDate: null, openCents: 0, pixCode: null }, assets);
  assert.match(cash, /Sua nota fiscal chegou/);
  assert.doesNotMatch(cash, /Pague com Pix/);

  assert.match(renderReceivableReminderEmail(content, assets), /vence em 2 dias, em 10\/12\/2026/);
  const paid = renderReceivablePaidEmail({ ...content, paidCents: 45000 }, assets);
  assert.match(paid, /Sua fatura foi recebida/);
  assert.match(paid, /Bispo Coffees/);
  assert.doesNotMatch(renderInvoiceIssuedEmail({ ...content, customerName: "<b>x</b>" }, assets), /<b>x<\/b>/);
});

const pdfBytes = Buffer.from("%PDF-1.4 fake");
const xmlText = '<?xml version="1.0"?><nfeProc versao="4.00"><NFe/></nfeProc>';

function fakeDatabase(overrides: { receivable?: any; invoiceStatus?: string; paymentType?: string } = {}) {
  const order = {
    id: "so1",
    companyId: "c1",
    code: "B-1",
    orderNumber: "B-2026-000150",
    status: "INVOICED",
    paymentType: overrides.paymentType ?? "CASH",
    orderType: "SALE",
    totalAmount: 450,
    customer: { name: "Café da Praça", tradeName: null },
    items: [{ productName: "Catuaí 1kg", quantity: 3, totalAmount: 450 }],
  };
  return {
    $queryRawUnsafe: async (sql: string) =>
      sql.includes("xmlContent")
        ? [
            {
              id: "fd1",
              companyId: "c1",
              salesOrderId: "so1",
              number: "1234",
              status: overrides.invoiceStatus ?? "AUTHORIZED",
              xmlContent: null,
              pdfUrl: "https://www.bling.com.br/doc.view.php?PDF=true&id=1",
              danfeUrl: "https://www.bling.com.br/doc.view.php?id=1",
              xmlUrl: "https://www.bling.com.br/relatorios/nfe.xml.php?chave=1",
            },
          ]
        : [{ id: "fd1", number: "1234", status: "AUTHORIZED" }],
    salesOrder: { findFirst: async () => order },
    accountsReceivable: { findFirst: async () => overrides.receivable ?? null },
    company: { findUnique: async () => null },
  };
}

const fakeFetch = (async (url: string) =>
  new Response(String(url).includes("xml") ? xmlText : pdfBytes, { status: 200 })) as unknown as typeof fetch;

test("NF e-mail attaches the PDF and XML downloaded from Bling", async () => {
  const email = await composeBillingEmail(
    fakeDatabase(),
    { template: "INVOICE_ISSUED", payload: { fiscalDocumentId: "fd1" }, attempts: 1 },
    { assets, fetch: fakeFetch },
  );
  assert.deepEqual(email.attachments?.map((a) => a.filename), ["NF-1234.pdf", "NF-1234.xml"]);
  assert.equal(Buffer.from(email.attachments?.[1]?.content ?? "", "base64").toString("utf8"), xmlText);
  assert.equal(email.subject, "Sua nota fiscal 1234 · pedido B-2026-000150");
});

test("NF e-mail retries while Bling files are unavailable, then sends a link", async () => {
  const failing = (async () => new Response("erro", { status: 503 })) as unknown as typeof fetch;
  await assert.rejects(
    composeBillingEmail(fakeDatabase(), { template: "INVOICE_ISSUED", payload: { fiscalDocumentId: "fd1" }, attempts: 1 }, { assets, fetch: failing }),
    /nova tentativa/,
  );
  const email = await composeBillingEmail(
    fakeDatabase(),
    { template: "INVOICE_ISSUED", payload: { fiscalDocumentId: "fd1" }, attempts: 4 },
    { assets, fetch: failing },
  );
  assert.equal(email.attachments?.length, 0);
  assert.match(email.html, /Abra a nota fiscal aqui/);
});

test("cancelled NF and paid receivables are skipped, not sent", async () => {
  await assert.rejects(
    composeBillingEmail(fakeDatabase({ invoiceStatus: "CANCELLED" }), { template: "INVOICE_ISSUED", payload: { fiscalDocumentId: "fd1" } }, { assets, fetch: fakeFetch }),
    NotificationSkipped,
  );
  const paid = { id: "ar1", companyId: "c1", salesOrderId: "so1", status: "PAID", openAmount: 0, amount: 450, dueDate: new Date("2026-12-10T00:00:00Z") };
  await assert.rejects(
    composeBillingEmail(fakeDatabase({ receivable: paid, paymentType: "TERM" }), { template: "RECEIVABLE_REMINDER", payload: { receivableId: "ar1", dueDate: "2026-12-10" } }, { assets }),
    NotificationSkipped,
  );
  const thanks = await composeBillingEmail(
    fakeDatabase({ receivable: paid, paymentType: "TERM" }),
    { template: "RECEIVABLE_PAID", payload: { receivableId: "ar1" } },
    { assets },
  );
  assert.equal(thanks.subject, "Fatura recebida, obrigado! · pedido B-2026-000150");
  assert.match(thanks.html, /R\$\s?450,00/);
});

test("reminder is skipped when the due date changed after queueing", async () => {
  const open = { id: "ar1", companyId: "c1", salesOrderId: "so1", status: "OPEN", openAmount: 450, amount: 450, dueDate: new Date("2026-12-20T00:00:00Z") };
  await assert.rejects(
    composeBillingEmail(fakeDatabase({ receivable: open, paymentType: "TERM" }), { template: "RECEIVABLE_REMINDER", payload: { receivableId: "ar1", dueDate: "2026-12-10" } }, { assets }),
    NotificationSkipped,
  );
});

test("NF status e-mail is skipped only when the invoice e-mail replaces it", () => {
  const on = new Date("2026-11-26T11:00:00Z");
  const nf = { template: "ORDER_STATUS", salesOrderId: "so-1", createdAt: "2026-11-26T12:00:00Z", payload: { eventType: "INVOICE_AUTHORIZED" } };
  assert.equal(replacedByInvoiceEmail(nf, on), true);
  assert.equal(replacedByInvoiceEmail(nf, null), false, "billing e-mails off: keep status e-mail");
  assert.equal(replacedByInvoiceEmail({ ...nf, salesOrderId: null }, on), false, "storefront order keeps it");
  assert.equal(replacedByInvoiceEmail({ ...nf, createdAt: "2026-11-25T12:00:00Z" }, on), false, "before activation");
  assert.equal(replacedByInvoiceEmail({ ...nf, payload: { eventType: "SHIPPED" } }, on), false);
  assert.equal(replacedByInvoiceEmail({ ...nf, template: "INVOICE_ISSUED" }, on), false);
});
