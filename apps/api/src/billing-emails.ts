/**
 * Customer billing e-mails: NF-e issued, due-date reminder and payment thank-you.
 * Pure helpers and HTML templates only; no database or network access here.
 */

export const BILLING_EMAIL_TEMPLATES = [
  "INVOICE_ISSUED",
  "RECEIVABLE_REMINDER",
  "RECEIVABLE_PAID",
] as const;
export type BillingEmailTemplate = (typeof BILLING_EMAIL_TEMPLATES)[number];

export const REMINDER_DAYS_BEFORE_DUE = 2;
/** Reminders go out from this local hour on, never at midnight. */
export const REMINDER_LOCAL_HOUR = 8;
const TIME_ZONE = "America/Sao_Paulo";

export function isBillingEmailTemplate(
  value: unknown,
): value is BillingEmailTemplate {
  return BILLING_EMAIL_TEMPLATES.includes(value as BillingEmailTemplate);
}

/**
 * Billing e-mails stay off until BBOS_BILLING_EMAILS_ENABLED_AT holds a valid
 * date. Only invoices and payments from that moment on are e-mailed, so turning
 * the feature on never sends messages about the past.
 */
export function billingEmailsActivation(
  env: Record<string, string | undefined> = process.env,
): Date | null {
  const value = env.BBOS_BILLING_EMAILS_ENABLED_AT?.trim();
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Once billing e-mails are on, a B2B order's invoice goes out as INVOICE_ISSUED
 * (with PDF and XML). The plain "Nota fiscal emitida" status e-mail for the same
 * order would be a second message about the same invoice, so it is skipped.
 * Storefront orders (no salesOrderId) keep the status e-mail.
 */
export function replacedByInvoiceEmail(
  row: { template?: unknown; salesOrderId?: unknown; createdAt?: unknown; payload?: unknown },
  activation: Date | null = billingEmailsActivation(),
): boolean {
  if (!activation || row.template !== "ORDER_STATUS" || !row.salesOrderId) return false;
  const payload = (row.payload ?? {}) as { eventType?: unknown };
  if (payload.eventType !== "INVOICE_AUTHORIZED") return false;
  const created = row.createdAt ? new Date(row.createdAt as string) : null;
  return Boolean(created && !Number.isNaN(created.getTime()) && created >= activation);
}

function localParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}

/** Due date (YYYY-MM-DD) whose reminder is due now, or null before 8h local. */
export function reminderDueDate(now = new Date()): string | null {
  const local = localParts(now);
  if (local.hour < REMINDER_LOCAL_HOUR) return null;
  const date = new Date(`${local.date}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + REMINDER_DAYS_BEFORE_DUE);
  return date.toISOString().slice(0, 10);
}

export const billingEmailKeys = {
  invoice: (fiscalDocumentId: string) =>
    `notify:email:fiscal:${fiscalDocumentId}:invoice-issued`,
  reminder: (receivableId: string, dueDate: string) =>
    `notify:email:receivable:${receivableId}:reminder:${dueDate}`,
  paid: (receivableId: string) =>
    `notify:email:receivable:${receivableId}:paid`,
};

/** Only Bling's own HTTPS links are downloaded (no arbitrary URLs). */
export function isTrustedFiscalUrl(value: unknown): value is string {
  try {
    const url = new URL(String(value ?? ""));
    return (
      url.protocol === "https:" &&
      (url.hostname === "bling.com.br" || url.hostname.endsWith(".bling.com.br"))
    );
  } catch {
    return false;
  }
}

export const looksLikePdf = (buffer: Buffer) =>
  buffer.subarray(0, 5).toString("latin1") === "%PDF-";

export const looksLikeNfeXml = (text: string) =>
  /<(nfeProc|NFe)[\s>]/.test(text.slice(0, 4000));

// ---------------------------------------------------------------- templates

export type BillingEmailItem = {
  name: string;
  quantity: number;
  totalCents: number;
};

export type BillingEmailContent = {
  customerName: string;
  orderCode: string;
  invoiceNumber?: string | null;
  items?: BillingEmailItem[];
  totalCents?: number;
  dueDate?: string | null;
  openCents?: number;
  paidCents?: number;
  pixCode?: string | null;
  danfeUrl?: string | null;
  attachmentsMissing?: boolean;
};

type Assets = { logoUrl: string; sealUrl: string };

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const formatMoney = (cents: unknown) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(cents || 0) / 100,
  );

/** Due dates are calendar dates; read them without time-zone shifts. */
export function formatDueDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "";
  const [year, month, day] = date.toISOString().slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/** B2B customers are companies: greet with the full trade name. */
export function greeting(name: unknown) {
  const value = String(name ?? "").trim();
  return value ? `Olá, ${value}!` : "Olá!";
}

const label = (text: string) =>
  `<div style="font:10px/14px Arial,sans-serif;letter-spacing:1.7px;text-transform:uppercase;color:#626B69">${escapeHtml(text)}</div>`;

function factsTable(rows: Array<[string, string]>) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows
    .filter(([, value]) => value)
    .map(
      ([name, value]) =>
        `<tr><td style="padding:7px 0;border-bottom:1px solid #E0EAE9;font:13px Arial,sans-serif;color:#626B69">${escapeHtml(name)}</td><td align="right" style="padding:7px 0;border-bottom:1px solid #E0EAE9;font:600 13px Arial,sans-serif;color:#0E191D">${escapeHtml(value)}</td></tr>`,
    )
    .join("")}</table>`;
}

function itemsTable(items: BillingEmailItem[]) {
  if (!items.length) return "";
  return `<tr><td style="padding:0 42px 26px">${label("Itens do pedido")}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px">${items
    .map(
      (item) =>
        `<tr><td style="padding:6px 0;font:13px/19px Arial,sans-serif;color:#0E191D">${escapeHtml(item.quantity.toLocaleString("pt-BR"))} × ${escapeHtml(item.name)}</td><td align="right" style="padding:6px 0;font:13px Arial,sans-serif;color:#0E191D">${escapeHtml(formatMoney(item.totalCents))}</td></tr>`,
    )
    .join("")}</table></td></tr>`;
}

function pixBlock(pixCode: string) {
  return `<tr><td style="padding:0 42px 26px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#E0EAE9;border-left:3px solid #087568"><tr><td style="padding:18px 20px">${label("Pague com Pix")}<div style="padding-top:8px;font:13px/20px Arial,sans-serif;color:#0E191D">O QR Code está no PDF da cobrança em anexo. Se preferir, use o Pix copia e cola:</div><div style="margin-top:10px;padding:10px;background:#FFFFFF;font:11px/16px 'Courier New',monospace;color:#0E191D;word-break:break-all">${escapeHtml(pixCode)}</div></td></tr></table></td></tr>`;
}

function shell(options: {
  assets: Assets;
  preheader: string;
  eyebrow: string;
  headline: string;
  intro: string;
  body: string;
}) {
  const { assets } = options;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(options.eyebrow)}</title></head><body style="margin:0;padding:0;background:#F1EEE8;color:#0E191D"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(options.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F1EEE8"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#FFFFFF">
    <tr><td style="height:4px;background:#0E191D;font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="padding:25px 38px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="72" valign="middle"><img src="${escapeHtml(assets.sealUrl)}" width="62" height="62" alt="Selo Bispo True Coffee" style="display:block;border:0;border-radius:50%"></td><td valign="middle"><img src="${escapeHtml(assets.logoUrl)}" width="168" alt="Bispo True Coffee" style="display:block;border:0;width:168px;max-width:100%;height:auto"></td></tr></table></td></tr>
    <tr><td style="padding:40px 42px 34px;background:#0A0A0A;color:#FFFFFF"><div style="font:10px/14px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#E0EAE9">${escapeHtml(options.eyebrow)}</div><h1 style="margin:16px 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:39px;font-weight:400;color:#FFFFFF">${escapeHtml(options.headline)}</h1><div style="font:14px/23px Arial,sans-serif;color:#E0EAE9">${escapeHtml(options.intro)}</div></td></tr>
    <tr><td style="padding-top:30px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${options.body}<tr><td style="padding:4px 42px 32px;text-align:center;font:11px/18px Arial,sans-serif;color:#626B69">Qualquer dúvida, é só responder este e-mail.<br>Será um prazer ajudar.</td></tr></table></td></tr>
    <tr><td style="padding:25px 42px;background:#E0EAE9"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="font:500 13px Arial,sans-serif;letter-spacing:2px;color:#0E191D">BISPO</td><td align="right" style="font:9px/15px Arial,sans-serif;letter-spacing:.4px;text-transform:uppercase;color:#52605D">José &amp; Suzi · Bispo Coffees<br>True Coffee · Londrina, Paraná</td></tr></table></td></tr>
  </table></td></tr></table></body></html>`;
}

export function renderInvoiceIssuedEmail(
  content: BillingEmailContent,
  assets: Assets,
) {
  const withBilling = Boolean(content.dueDate && content.openCents);
  const hello = greeting(content.customerName);
  const intro = withBilling
    ? `${hello} Seu pedido ${content.orderCode} foi faturado. Seguem a nota fiscal e a cobrança, com vencimento em ${formatDueDate(content.dueDate)}.`
    : `${hello} Seu pedido ${content.orderCode} foi faturado. Seguem em anexo o PDF e o XML da nota fiscal.`;
  const facts = factsTable([
    ["Pedido", content.orderCode],
    ["Nota fiscal", content.invoiceNumber ? `nº ${content.invoiceNumber}` : ""],
    ["Valor total", content.totalCents ? formatMoney(content.totalCents) : ""],
    ["Vencimento", withBilling ? formatDueDate(content.dueDate) : ""],
    ["Valor a pagar", withBilling ? formatMoney(content.openCents) : ""],
  ]);
  const attachments = withBilling
    ? "Em anexo: PDF e XML da nota fiscal e o PDF da cobrança com o QR Code Pix."
    : "Em anexo: PDF e XML da nota fiscal.";
  const missing =
    content.attachmentsMissing && content.danfeUrl
      ? `<tr><td style="padding:0 42px 22px;font:13px/20px Arial,sans-serif;color:#0E191D">Não conseguimos anexar os arquivos da nota desta vez. <a href="${escapeHtml(content.danfeUrl)}" style="color:#087568">Abra a nota fiscal aqui</a>.</td></tr>`
      : "";
  const body = `<tr><td style="padding:0 42px 26px">${facts}</td></tr>${itemsTable(content.items ?? [])}${withBilling && content.pixCode ? pixBlock(content.pixCode) : ""}<tr><td style="padding:0 42px 22px;font:13px/20px Arial,sans-serif;color:#626B69">${escapeHtml(content.attachmentsMissing ? "" : attachments)}</td></tr>${missing}`;
  return shell({
    assets,
    preheader: intro,
    eyebrow: withBilling ? "Nota fiscal e cobrança" : "Sua nota fiscal",
    headline: withBilling
      ? "Seu pedido foi faturado."
      : "Sua nota fiscal chegou.",
    intro,
    body,
  });
}

export function renderReceivableReminderEmail(
  content: BillingEmailContent,
  assets: Assets,
) {
  const hello = greeting(content.customerName);
  const due = formatDueDate(content.dueDate);
  const intro = `${hello} Passando para lembrar que a fatura do pedido ${content.orderCode} vence em ${REMINDER_DAYS_BEFORE_DUE} dias, em ${due}. Se você já pagou, pode desconsiderar esta mensagem.`;
  const body = `<tr><td style="padding:0 42px 26px">${factsTable([
    ["Pedido", content.orderCode],
    ["Nota fiscal", content.invoiceNumber ? `nº ${content.invoiceNumber}` : ""],
    ["Vencimento", due],
    ["Valor", formatMoney(content.openCents)],
  ])}</td></tr>${content.pixCode ? pixBlock(content.pixCode) : ""}`;
  return shell({
    assets,
    preheader: `Sua fatura vence em ${REMINDER_DAYS_BEFORE_DUE} dias (${due}).`,
    eyebrow: "Lembrete de vencimento",
    headline: `Sua fatura vence em ${REMINDER_DAYS_BEFORE_DUE} dias.`,
    intro,
    body,
  });
}

export function renderReceivablePaidEmail(
  content: BillingEmailContent,
  assets: Assets,
) {
  const hello = greeting(content.customerName);
  const intro = `${hello} Recebemos o pagamento da sua fatura do pedido ${content.orderCode}. Muito obrigado pela confiança e por fazer parte da história da Bispo Coffees.`;
  const body = `<tr><td style="padding:0 42px 26px">${factsTable([
    ["Pedido", content.orderCode],
    ["Nota fiscal", content.invoiceNumber ? `nº ${content.invoiceNumber}` : ""],
    ["Valor recebido", content.paidCents ? formatMoney(content.paidCents) : ""],
  ])}</td></tr><tr><td style="padding:0 42px 26px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#E0EAE9;border-left:3px solid #0E191D"><tr><td style="padding:18px 20px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:23px;font-style:italic;color:#0E191D">Que cada xícara valha a pena. Até o próximo café!</td></tr></table></td></tr>`;
  return shell({
    assets,
    preheader: "Sua fatura foi recebida pela Bispo Coffees. Obrigado!",
    eyebrow: "Pagamento recebido",
    headline: "Sua fatura foi recebida. Obrigado!",
    intro,
    body,
  });
}

export function billingEmailSubject(
  template: BillingEmailTemplate,
  content: BillingEmailContent,
) {
  const nf = content.invoiceNumber ? ` ${content.invoiceNumber}` : "";
  if (template === "INVOICE_ISSUED")
    return content.dueDate && content.openCents
      ? `Nota fiscal${nf} e cobrança · pedido ${content.orderCode}`
      : `Sua nota fiscal${nf} · pedido ${content.orderCode}`;
  if (template === "RECEIVABLE_REMINDER")
    return `Sua fatura vence em ${REMINDER_DAYS_BEFORE_DUE} dias · pedido ${content.orderCode}`;
  return `Fatura recebida, obrigado! · pedido ${content.orderCode}`;
}
