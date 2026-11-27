// Regras puras do "envio direto": o distribuidor compra a etiqueta no nome dele,
// a Bispo imprime, cola e posta para o cliente final do distribuidor.

export const DIRECT_SHIPMENT_DOCUMENT_KINDS = ["LABEL", "INVOICE", "PACKING_LIST", "OTHER"] as const;
export type DirectShipmentDocumentKind = (typeof DIRECT_SHIPMENT_DOCUMENT_KINDS)[number];
export const DIRECT_SHIPMENT_DOCUMENT_LABEL: Record<DirectShipmentDocumentKind, string> = {
  LABEL: "Etiqueta",
  INVOICE: "Nota fiscal",
  PACKING_LIST: "Romaneio",
  OTHER: "Outro documento",
};
export const DIRECT_SHIPMENT_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const DIRECT_SHIPMENT_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export type DirectShipmentInput = {
  recipientName?: string;
  recipientTaxId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  postalCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  carrier?: string;
  trackingCode?: string;
  trackingUrl?: string;
  volumes?: number | string | null;
  weightKg?: number | string | null;
  notifyEndCustomer?: boolean;
};

export type DirectShipmentData = {
  recipientName: string;
  recipientTaxId: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  postalCode: string;
  street: string;
  number: string;
  complement: string | null;
  district: string | null;
  city: string;
  state: string;
  carrier: string;
  trackingCode: string;
  trackingUrl: string | null;
  volumes: number | null;
  weightKg: number | null;
  notifyEndCustomer: boolean;
};

const text = (value: unknown, max: number) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const optional = (value: unknown, max: number) => text(value, max) || null;

const BR_STATES = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB",
  "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

/** Valida e normaliza a ficha. Lança Error com mensagem pronta para a tela. */
export function validateDirectShipment(input: DirectShipmentInput): DirectShipmentData {
  const recipientName = text(input.recipientName, 160);
  if (recipientName.length < 3) throw new Error("Informe o nome do cliente que vai receber.");
  const postalCode = String(input.postalCode ?? "").replace(/\D/g, "");
  if (postalCode.length !== 8) throw new Error("Informe um CEP com 8 números.");
  const street = text(input.street, 160);
  if (!street) throw new Error("Informe a rua do cliente.");
  const number = text(input.number, 20);
  if (!number) throw new Error("Informe o número do endereço (ou S/N).");
  const city = text(input.city, 80);
  if (!city) throw new Error("Informe a cidade do cliente.");
  const state = text(input.state, 2).toUpperCase();
  if (!BR_STATES.has(state)) throw new Error("Informe a UF do cliente (ex.: SP).");
  const carrier = text(input.carrier, 80);
  if (!carrier) throw new Error("Informe a transportadora da etiqueta.");
  const trackingCode = text(input.trackingCode, 60).replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z0-9-]{6,60}$/.test(trackingCode)) throw new Error("Informe o código de rastreio da etiqueta.");
  const recipientEmail = optional(input.recipientEmail, 160)?.toLowerCase() ?? null;
  if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) throw new Error("E-mail do cliente inválido.");
  const notifyEndCustomer = input.notifyEndCustomer === true;
  if (notifyEndCustomer && !recipientEmail) throw new Error("Para avisar o seu cliente, informe o e-mail dele.");
  const rawUrl = optional(input.trackingUrl, 300);
  if (rawUrl && !/^https:\/\/[^\s]+$/i.test(rawUrl)) throw new Error("O link de rastreio precisa começar com https://");
  const volumes = input.volumes === null || input.volumes === undefined || input.volumes === "" ? null : Number(input.volumes);
  if (volumes !== null && (!Number.isInteger(volumes) || volumes < 1 || volumes > 99)) throw new Error("Volumes: use um número entre 1 e 99.");
  const weightRaw = typeof input.weightKg === "string" ? input.weightKg.replace(",", ".") : input.weightKg;
  const weightKg = weightRaw === null || weightRaw === undefined || weightRaw === "" ? null : Number(weightRaw);
  if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 5000)) throw new Error("Peso inválido.");
  const taxDigits = String(input.recipientTaxId ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (taxDigits && taxDigits.length !== 11 && taxDigits.length !== 14) throw new Error("CPF ou CNPJ do cliente inválido.");
  return {
    recipientName,
    recipientTaxId: taxDigits || null,
    recipientEmail,
    recipientPhone: optional(input.recipientPhone, 30),
    postalCode,
    street,
    number,
    complement: optional(input.complement, 80),
    district: optional(input.district, 80),
    city,
    state,
    carrier,
    trackingCode,
    trackingUrl: rawUrl,
    volumes,
    weightKg,
    notifyEndCustomer,
  };
}

/** Link público de rastreio: o informado pelo parceiro, Correios pelo formato do código, senão Melhor Rastreio. */
export function directShipmentTrackingUrl(trackingCode: string, customUrl?: string | null) {
  if (customUrl) return customUrl;
  const code = encodeURIComponent(trackingCode);
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(trackingCode)) {
    return `https://rastreamento.correios.com.br/app/index.php?objetos=${code}`;
  }
  return `https://melhorrastreio.com.br/rastreio/${code}`;
}

export function directShipmentDocumentKind(value: unknown): DirectShipmentDocumentKind {
  const kind = String(value ?? "").toUpperCase();
  if (!(DIRECT_SHIPMENT_DOCUMENT_KINDS as readonly string[]).includes(kind)) {
    throw new Error("Escolha o tipo do documento: etiqueta, nota fiscal, romaneio ou outro.");
  }
  return kind as DirectShipmentDocumentKind;
}

export function assertDirectShipmentFile(file: { mimetype?: string; size?: number; buffer?: Buffer } | undefined) {
  if (!file?.buffer?.length) throw new Error("Selecione o arquivo.");
  if (!DIRECT_SHIPMENT_MIME_TYPES.includes(String(file.mimetype))) throw new Error("Envie um PDF, PNG ou JPG.");
  if (file.buffer.length > DIRECT_SHIPMENT_MAX_FILE_BYTES) throw new Error("O arquivo passa de 8 MB.");
  if (file.mimetype === "application/pdf" && file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new Error("O arquivo não parece ser um PDF válido.");
  }
}

export function safeFileName(name: string) {
  const cleaned = String(name || "documento")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
  return cleaned || "documento";
}

/** Remetente com o nome do parceiro, mantendo o endereço verificado da Bispo. */
export function partnerFromAddress(partnerName: string, configuredFrom: string) {
  const address = configuredFrom.match(/<([^>]+)>/)?.[1] ?? configuredFrom.trim();
  const name = partnerName.replace(/["<>\r\n]/g, "").trim() || "Seu fornecedor";
  return `"${name}" <${address}>`;
}

/** Destino do aviso: o cliente final só em produção; em teste, quem clicou em Postado. */
export function directShipmentEmailTarget(input: {
  live: boolean;
  recipientEmail: string | null;
  testEmail: string | null;
}) {
  if (input.live) return input.recipientEmail ? { to: input.recipientEmail, test: false } : null;
  return input.testEmail ? { to: input.testEmail, test: true } : null;
}

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type DirectShipmentEmailPayload = {
  partnerName: string;
  recipientName: string;
  carrier: string;
  trackingCode: string;
  trackingUrl: string;
  volumes: number | null;
  city: string;
  state: string;
  postedAt: string;
  test?: boolean;
  intendedRecipient?: string | null;
};

/** E-mail "pedido a caminho" em nome do parceiro: sem marca nem menção à Bispo. */
export function renderDirectShipmentEmail(payload: DirectShipmentEmailPayload) {
  const partner = escapeHtml(payload.partnerName);
  const firstName = escapeHtml(String(payload.recipientName).split(" ")[0]);
  const posted = new Date(payload.postedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const volumes = payload.volumes ? `${payload.volumes} volume${payload.volumes > 1 ? "s" : ""}` : "";
  const testBanner = payload.test
    ? `<p style="margin:0 0 16px;padding:10px 12px;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:13px">TESTE: este aviso iria para ${escapeHtml(payload.intendedRecipient || "o cliente final")}. Ele só vai ao cliente quando o modo produção for ligado.</p>`
    : "";
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#ffffff;border-radius:14px;padding:28px">
${testBanner}
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#78716c">${partner}</p>
<h1 style="margin:0 0 16px;font-size:22px">Seu pedido está a caminho</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Olá, ${firstName}! Seu pedido foi postado em ${escapeHtml(posted)} e já está com a transportadora.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 20px">
<tr><td style="padding:6px 0;color:#78716c">Transportadora</td><td style="padding:6px 0;text-align:right"><strong>${escapeHtml(payload.carrier)}</strong></td></tr>
<tr><td style="padding:6px 0;color:#78716c">Código de rastreio</td><td style="padding:6px 0;text-align:right"><strong>${escapeHtml(payload.trackingCode)}</strong></td></tr>
${volumes ? `<tr><td style="padding:6px 0;color:#78716c">Volumes</td><td style="padding:6px 0;text-align:right">${escapeHtml(volumes)}</td></tr>` : ""}
<tr><td style="padding:6px 0;color:#78716c">Destino</td><td style="padding:6px 0;text-align:right">${escapeHtml(payload.city)}/${escapeHtml(payload.state)}</td></tr>
</table>
<a href="${escapeHtml(payload.trackingUrl)}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold;font-size:14px">Acompanhar entrega</a>
<p style="margin:20px 0 0;font-size:13px;color:#78716c;line-height:1.5">Qualquer dúvida, é só responder este e-mail.<br>Equipe ${partner}</p>
</div></div></body></html>`;
  return {
    subject: `${payload.test ? "[TESTE] " : ""}Seu pedido ${payload.partnerName} está a caminho`,
    html,
  };
}
