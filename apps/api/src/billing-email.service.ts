import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "@bbos/database";
import {
  type BillingEmailContent,
  type BillingEmailTemplate,
  billingEmailKeys,
  billingEmailSubject,
  billingEmailsActivation,
  isTrustedFiscalUrl,
  looksLikeNfeXml,
  looksLikePdf,
  reminderDueDate,
  renderInvoiceIssuedEmail,
  renderReceivablePaidEmail,
  renderReceivableReminderEmail,
  renderBoletoIssuedEmail,
} from "./billing-emails";
import { beneficiaryAccount } from "./boleto-itau";
import { buildBoletoPdf } from "./boleto-pdf";
import { loadSalesOrderBillingData } from "./sales-order-billing-data";
import { buildSalesOrderBillingPdf } from "./sales-order-billing-pdf";

const SYNC_INTERVAL_MS = 60_000;
/** After this many failed downloads the NF e-mail goes out with a link instead. */
const ATTACHMENT_ATTEMPTS = 4;

/** Picks the first valid address of a customer e-mail field ("a@x.com; b@y.com"). */
export function primaryEmail(value: unknown): string {
  const first = String(value ?? "")
    .split(/[;,\s]+/)
    .map((part) => part.trim().toLowerCase())
    .find((part) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(part));
  return first ?? "";
}

/** Raised when a queued e-mail no longer makes sense (e.g. already paid). */
export class NotificationSkipped extends Error {}

type Attachment = { filename: string; content: string; content_type?: string };
export type ComposedEmail = {
  subject: string;
  html: string;
  attachments?: Attachment[];
};
type Assets = { logoUrl: string; sealUrl: string };
type Deps = { assets: Assets; fetch?: typeof fetch };

const safeName = (value: unknown) =>
  String(value ?? "").replace(/[^A-Za-z0-9._-]/g, "-");

async function download(
  url: unknown,
  fetchImpl: typeof fetch,
): Promise<Buffer | null> {
  if (!isTrustedFiscalUrl(url)) return null;
  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function loadOrder(database: any, companyId: string, orderId: string) {
  const order = await database.salesOrder.findFirst({
    where: { id: orderId, companyId },
    include: { customer: true, items: true },
  });
  if (!order) throw new NotificationSkipped("Pedido não encontrado.");
  return order;
}

function orderContent(order: any): BillingEmailContent {
  return {
    customerName: order.customer?.tradeName || order.customer?.name || "",
    orderCode: String(order.orderNumber ?? order.code),
    totalCents: Math.round(Number(order.totalAmount || 0) * 100),
    items: (order.items ?? []).map((item: any) => ({
      name: String(item.productName || item.sku || "Produto"),
      quantity: Number(item.quantity),
      totalCents: Math.round(Number(item.totalAmount || 0) * 100),
    })),
  };
}

async function latestInvoice(database: any, companyId: string, orderId: string) {
  const rows = await database.$queryRawUnsafe(
    `SELECT id,number,status FROM "FiscalDocument"
      WHERE "companyId"=$1 AND "salesOrderId"=$2 AND direction='OUTBOUND'
      ORDER BY "createdAt" DESC LIMIT 1`,
    companyId,
    orderId,
  );
  return rows[0] as { id: string; number: string | null; status: string } | undefined;
}

/** Billing data for an open TERM receivable, or null when there is nothing to charge. */
async function openBilling(database: any, order: any) {
  try {
    return await loadSalesOrderBillingData(database, order, order.companyId);
  } catch {
    return null;
  }
}

function billingAttachment(data: NonNullable<Awaited<ReturnType<typeof openBilling>>>, code: string): Attachment {
  return {
    filename: `Cobranca-${safeName(code)}.pdf`,
    content: buildSalesOrderBillingPdf(data).toString("base64"),
    content_type: "application/pdf",
  };
}

type OpenBoleto = {
  id: string;
  digitableLine: string;
  barcode: string;
  pixCopyPaste: string | null;
  ourNumber: string;
  amount: string;
  dueDate: Date;
  createdAt: Date;
};

/**
 * Only a boleto registered at the bank goes to customers: test and sandbox
 * boletos are not valid for payment.
 */
export async function openProductionBoleto(database: any, receivableId: string): Promise<OpenBoleto | null> {
  try {
    const rows = await database.$queryRawUnsafe(
      `SELECT id,"digitableLine",barcode,"pixCopyPaste","ourNumber","amount"::text AS amount,"dueDate","createdAt"
         FROM "ReceivableBoleto"
        WHERE "accountsReceivableId"=$1 AND status='ISSUED' AND mode='producao'
        ORDER BY "createdAt" DESC LIMIT 1`,
      receivableId,
    );
    const row = rows?.[0];
    const valid = row && typeof row.digitableLine === "string" && /^\d{47}$/.test(row.digitableLine) &&
      !Number.isNaN(new Date(row.dueDate).getTime());
    return valid ? row : null;
  } catch {
    return null;
  }
}

function boletoAttachment(boleto: OpenBoleto, order: any, _receivable: unknown, invoiceNumber: string | null): Attachment {
  const customer = order.customer ?? {};
  const bank = beneficiaryAccount();
  const pdf = buildBoletoPdf({
    digitableLine: boleto.digitableLine,
    barcode: boleto.barcode,
    ourNumber: boleto.ourNumber,
    wallet: bank.wallet,
    agency: bank.agency,
    account: bank.account,
    amountCents: Math.round(Number(boleto.amount) * 100),
    dueDate: boleto.dueDate,
    issueDate: boleto.createdAt,
    yourNumber: invoiceNumber || String(order.orderNumber ?? order.code),
    payer: {
      name: customer.legalName || customer.name || "",
      taxId: customer.taxId || "",
      address: [customer.address, customer.addressNumber, customer.district, customer.city, customer.state, customer.postalCode].filter(Boolean).join(" - "),
    },
    pixCopyPaste: boleto.pixCopyPaste,
  });
  return { filename: `Boleto-${safeName(invoiceNumber || order.orderNumber || order.code)}.pdf`, content: pdf.toString("base64"), content_type: "application/pdf" };
}

/**
 * Builds the e-mail for a queued billing notification from current data, so a
 * reminder never goes out for a receivable that was paid in the meantime.
 */
export async function composeBillingEmail(
  database: any,
  row: { template: BillingEmailTemplate; companyId?: string; payload: any; attempts?: number },
  deps: Deps,
): Promise<ComposedEmail> {
  const payload = row.payload || {};
  const fetchImpl = deps.fetch ?? fetch;

  if (row.template === "INVOICE_ISSUED") {
    const rows = await database.$queryRawUnsafe(
      `SELECT id,"companyId","salesOrderId",number,status,"xmlContent",
              "payloadSnapshot"#>>'{blingNfe,linkPDF}' AS "pdfUrl",
              "payloadSnapshot"#>>'{blingNfe,linkDanfe}' AS "danfeUrl",
              "payloadSnapshot"#>>'{blingNfe,xml}' AS "xmlUrl"
         FROM "FiscalDocument" WHERE id=$1 LIMIT 1`,
      payload.fiscalDocumentId,
    );
    const invoice = rows[0];
    if (!invoice || invoice.status !== "AUTHORIZED")
      throw new NotificationSkipped("A NF-e não está mais autorizada.");
    const order = await loadOrder(database, invoice.companyId, invoice.salesOrderId);
    if (order.status === "CANCELLED")
      throw new NotificationSkipped("Pedido cancelado.");
    const content: BillingEmailContent = {
      ...orderContent(order),
      invoiceNumber: invoice.number,
      danfeUrl: isTrustedFiscalUrl(invoice.danfeUrl) ? invoice.danfeUrl : null,
    };

    let pdf: Buffer | null = null;
    for (const url of [invoice.pdfUrl, invoice.danfeUrl]) {
      const file = await download(url, fetchImpl);
      if (file && looksLikePdf(file)) {
        pdf = file;
        break;
      }
    }
    let xml = typeof invoice.xmlContent === "string" && looksLikeNfeXml(invoice.xmlContent)
      ? invoice.xmlContent
      : "";
    if (!xml) {
      const file = await download(invoice.xmlUrl, fetchImpl);
      const text = file?.toString("utf8") ?? "";
      if (looksLikeNfeXml(text)) xml = text;
    }
    if ((!pdf || !xml) && Number(row.attempts ?? 1) < ATTACHMENT_ATTEMPTS)
      throw new Error("Arquivos da NF-e ainda indisponíveis no Bling; nova tentativa em breve.");

    const nf = safeName(invoice.number || content.orderCode);
    const attachments: Attachment[] = [];
    if (pdf) attachments.push({ filename: `NF-${nf}.pdf`, content: pdf.toString("base64"), content_type: "application/pdf" });
    if (xml) attachments.push({ filename: `NF-${nf}.xml`, content: Buffer.from(xml, "utf8").toString("base64"), content_type: "application/xml" });
    content.attachmentsMissing = !pdf || !xml;

    if (order.paymentType === "TERM" && order.orderType !== "SAMPLE") {
      const billing = await openBilling(database, order);
      if (billing) {
        content.dueDate = billing.receivable.dueDate.toISOString();
        content.openCents = billing.openCents;
        const boleto = await openProductionBoleto(database, billing.receivable.id);
        if (boleto) {
          content.dueDate = new Date(boleto.dueDate).toISOString();
          content.boleto = { digitableLine: boleto.digitableLine, pixCopyPaste: boleto.pixCopyPaste };
          attachments.push(boletoAttachment(boleto, order, billing.receivable, invoice.number));
        } else {
          content.pixCode = billing.pix;
          attachments.push(billingAttachment(billing, content.orderCode));
        }
      }
    }
    return {
      subject: billingEmailSubject("INVOICE_ISSUED", content),
      html: renderInvoiceIssuedEmail(content, deps.assets),
      attachments,
    };
  }

  const receivable = await database.accountsReceivable.findFirst({
    where: { id: payload.receivableId },
  });
  if (!receivable?.salesOrderId)
    throw new NotificationSkipped("Título não encontrado.");
  const order = await loadOrder(database, receivable.companyId, receivable.salesOrderId);
  const invoice = await latestInvoice(database, receivable.companyId, order.id);
  const content: BillingEmailContent = {
    ...orderContent(order),
    invoiceNumber: invoice?.status === "AUTHORIZED" ? invoice.number : null,
    dueDate: receivable.dueDate?.toISOString?.() ?? null,
  };

  if (row.template === "BOLETO_ISSUED") {
    if (["PAID", "CANCELLED"].includes(receivable.status) || Number(receivable.openAmount) <= 0)
      throw new NotificationSkipped("Título já quitado.");
    const boleto = await openProductionBoleto(database, receivable.id);
    if (!boleto || boleto.id !== payload.boletoId)
      throw new NotificationSkipped("O boleto não está mais em aberto.");
    content.dueDate = new Date(boleto.dueDate).toISOString();
    content.openCents = Math.round(Number(boleto.amount) * 100);
    content.boleto = { digitableLine: boleto.digitableLine, pixCopyPaste: boleto.pixCopyPaste };
    return {
      subject: billingEmailSubject("BOLETO_ISSUED", content),
      html: renderBoletoIssuedEmail(content, deps.assets),
      attachments: [boletoAttachment(boleto, order, receivable, content.invoiceNumber ?? null)],
    };
  }

  if (row.template === "RECEIVABLE_REMINDER") {
    if (["PAID", "CANCELLED"].includes(receivable.status) || Number(receivable.openAmount) <= 0)
      throw new NotificationSkipped("Título já quitado.");
    const boleto = await openProductionBoleto(database, receivable.id);
    // The reminder follows the boleto's due date when one was issued.
    const due = boleto ? new Date(boleto.dueDate).toISOString() : content.dueDate;
    if (due?.slice(0, 10) !== payload.dueDate)
      throw new NotificationSkipped("O vencimento foi alterado.");
    content.dueDate = due;
    const billing = await openBilling(database, order);
    content.openCents = billing?.openCents ?? Math.round(Number(receivable.openAmount) * 100);
    if (boleto) {
      content.boleto = { digitableLine: boleto.digitableLine, pixCopyPaste: boleto.pixCopyPaste };
      return {
        subject: billingEmailSubject("RECEIVABLE_REMINDER", content),
        html: renderReceivableReminderEmail(content, deps.assets),
        attachments: [boletoAttachment(boleto, order, receivable, content.invoiceNumber ?? null)],
      };
    }
    content.pixCode = billing?.pix ?? null;
    return {
      subject: billingEmailSubject("RECEIVABLE_REMINDER", content),
      html: renderReceivableReminderEmail(content, deps.assets),
      attachments: billing ? [billingAttachment(billing, content.orderCode)] : [],
    };
  }

  if (receivable.status !== "PAID")
    throw new NotificationSkipped("O título não está mais pago.");
  content.paidCents = Math.round(Number(receivable.amount) * 100);
  return {
    subject: billingEmailSubject("RECEIVABLE_PAID", content),
    html: renderReceivablePaidEmail(content, deps.assets),
  };
}

/**
 * Queues billing e-mails into the existing customer notification outbox.
 * Reads invoices and receivables only; it never changes NF-e, receivables or payments.
 */
@Injectable()
export class BillingEmailService {
  private readonly logger = new Logger(BillingEmailService.name);
  private readonly database: any = prisma;
  private nextSyncAt = 0;

  async sync(now = new Date(), force = false) {
    const activation = billingEmailsActivation();
    if (!activation) return 0;
    if (!force && now.getTime() < this.nextSyncAt) return 0;
    this.nextSyncAt = now.getTime() + SYNC_INTERVAL_MS;

    const invoices = await this.database.$queryRawUnsafe(
      `SELECT fd.id,fd."companyId",fd."salesOrderId",c.email
         FROM "FiscalDocument" fd
         JOIN "SalesOrder" so ON so.id=fd."salesOrderId" AND so."companyId"=fd."companyId"
         JOIN "Customer" c ON c.id=so."customerId"
        WHERE fd.direction='OUTBOUND' AND fd.status='AUTHORIZED'
          AND COALESCE(fd."issueDate",fd."createdAt") >= $1::timestamptz - interval '12 hours'
          AND fd."updatedAt" >= $1::timestamptz
          AND so.status<>'CANCELLED'
          AND NOT EXISTS (
            SELECT 1 FROM "FiscalDocument" newer
             WHERE newer."salesOrderId"=fd."salesOrderId" AND newer.direction='OUTBOUND'
               AND newer."createdAt">fd."createdAt")
        LIMIT 100`,
      activation,
    );
    let queued = 0;
    for (const item of invoices)
      queued += await this.enqueue(item, "INVOICE_ISSUED", billingEmailKeys.invoice(item.id), {
        fiscalDocumentId: item.id,
      });

    const dueDate = reminderDueDate(now);
    if (dueDate) {
      const reminders = await this.database.$queryRawUnsafe(
        `SELECT ar.id,ar."companyId",ar."salesOrderId",c.email
           FROM "AccountsReceivable" ar
           JOIN "SalesOrder" so ON so.id=ar."salesOrderId" AND so."companyId"=ar."companyId"
           JOIN "Customer" c ON c.id=ar."customerId"
          WHERE ar.status IN ('OPEN','PARTIALLY_PAID') AND ar."openAmount">0
            AND so."paymentType"='TERM' AND so."orderType"<>'SAMPLE' AND so.status<>'CANCELLED'
            AND COALESCE(
                  (SELECT b."dueDate" FROM "ReceivableBoleto" b
                    WHERE b."accountsReceivableId"=ar.id AND b.status='ISSUED' AND b.mode='producao'
                    ORDER BY b."createdAt" DESC LIMIT 1),
                  ar."dueDate")::date=$1::date
          LIMIT 200`,
        dueDate,
      );
      for (const item of reminders)
        queued += await this.enqueue(item, "RECEIVABLE_REMINDER", billingEmailKeys.reminder(item.id, dueDate), {
          receivableId: item.id,
          dueDate,
        });
    }

    // A boleto issued after the NF e-mail went out gets its own e-mail. When
    // the NF e-mail is still queued, that e-mail already carries the boleto.
    const boletos = await this.database.$queryRawUnsafe(
      `SELECT b.id AS "boletoId",ar.id,ar."companyId",ar."salesOrderId",c.email
         FROM "ReceivableBoleto" b
         JOIN "AccountsReceivable" ar ON ar.id=b."accountsReceivableId"
         JOIN "SalesOrder" so ON so.id=ar."salesOrderId" AND so."companyId"=ar."companyId"
         JOIN "Customer" c ON c.id=ar."customerId"
        WHERE b.status='ISSUED' AND b.mode='producao' AND b."createdAt" >= $1::timestamptz
          AND ar.status IN ('OPEN','PARTIALLY_PAID','OVERDUE') AND so.status<>'CANCELLED'
          AND NOT EXISTS (
            SELECT 1 FROM "CustomerNotificationOutbox" n
             WHERE n."salesOrderId"=ar."salesOrderId" AND n.template='INVOICE_ISSUED'
               AND (n.status IN ('PENDING','FAILED','PROCESSING') OR n."sentAt" >= b."createdAt"))
        LIMIT 100`,
      activation,
    ).catch(() => []);
    for (const item of boletos)
      queued += await this.enqueue(item, "BOLETO_ISSUED", billingEmailKeys.boleto(item.boletoId), {
        receivableId: item.id,
        boletoId: item.boletoId,
      });

    const paid = await this.database.$queryRawUnsafe(
      `SELECT ar.id,ar."companyId",ar."salesOrderId",c.email
         FROM "AccountsReceivable" ar
         JOIN "SalesOrder" so ON so.id=ar."salesOrderId" AND so."companyId"=ar."companyId"
         JOIN "Customer" c ON c.id=ar."customerId"
        WHERE ar.status='PAID' AND so."paymentType"='TERM' AND so."orderType"<>'SAMPLE'
          AND ar."updatedAt" >= $1::timestamptz
          AND COALESCE(ar."paymentDate",ar."updatedAt") >= $1::timestamptz - interval '7 days'
        LIMIT 200`,
      activation,
    );
    for (const item of paid)
      queued += await this.enqueue(item, "RECEIVABLE_PAID", billingEmailKeys.paid(item.id), {
        receivableId: item.id,
      });

    if (queued) this.logger.log(`${queued} e-mail(s) de faturamento na fila.`);
    return queued;
  }

  private async enqueue(
    item: { companyId: string; salesOrderId: string; email: string | null },
    template: BillingEmailTemplate,
    idempotencyKey: string,
    payload: Record<string, unknown>,
  ) {
    const destination = primaryEmail(item.email);
    if (!destination) return 0;
    return this.database.$executeRawUnsafe(
      `INSERT INTO "CustomerNotificationOutbox"
        (id,"companyId","salesOrderId",channel,destination,template,payload,status,attempts,"idempotencyKey","createdAt","updatedAt")
       VALUES ($1,$2,$3,'EMAIL',$4,$5,$6::jsonb,'PENDING',0,$7,NOW(),NOW())
       ON CONFLICT ("idempotencyKey") DO NOTHING`,
      randomUUID(),
      item.companyId,
      item.salesOrderId,
      destination,
      template,
      JSON.stringify(payload),
      idempotencyKey,
    );
  }
}
