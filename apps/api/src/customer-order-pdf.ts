import type { PartnerOrderConfirmedEmailPayload } from "./customer-email-template";

type PdfPage = string[];

const pageWidth = 595;
const pageHeight = 842;
const left = 48;
const right = pageWidth - 48;

const money = (cents: unknown) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents || 0) / 100);

const date = (value: unknown) => {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
        parsed,
      );
};

const textValue = (value: unknown, fallback = "—") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const freightDescription = (payload: PartnerOrderConfirmedEmailPayload) => {
  if (payload.freightResponsibility === "PICKUP") {
    return "Retirada na Bispo Coffees";
  }
  if (payload.freightResponsibility === "CUSTOMER_CARRIER") {
    return payload.carrierName
      ? `Transportadora do cliente: ${payload.carrierName}`
      : "Transportadora por conta do cliente";
  }
  return payload.shippingServiceName || payload.carrierName || "Entrega Bispo";
};

const pdfEscape = (value: unknown) =>
  String(value ?? "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/[()]/g, "\\$&");

const rgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const channels = [0, 2, 4].map(
    (offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255,
  );
  return channels.map((channel) => channel.toFixed(3)).join(" ");
};

const rect = (
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) => {
  page.push(`${rgb(color)} rg ${x} ${y} ${width} ${height} re f`);
};

const line = (
  page: PdfPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = "#D8DFDC",
  width = 0.7,
) => {
  page.push(
    `${rgb(color)} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`,
  );
};

const text = (
  page: PdfPage,
  value: unknown,
  x: number,
  y: number,
  size = 10,
  options: { bold?: boolean; color?: string } = {},
) => {
  const font = options.bold ? "/F2" : "/F1";
  page.push(
    `BT ${font} ${size} Tf ${rgb(options.color || "#0E191D")} rg 1 0 0 1 ${x} ${y} Tm (${pdfEscape(value)}) Tj ET`,
  );
};

const rightText = (
  page: PdfPage,
  value: unknown,
  x: number,
  y: number,
  size = 10,
  options: { bold?: boolean; color?: string } = {},
) => {
  const normalized = String(value ?? "");
  const estimatedWidth = normalized.length * size * 0.49;
  text(page, normalized, x - estimatedWidth, y, size, options);
};

const wrap = (value: unknown, maxCharacters: number) => {
  const words = textValue(value, "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1);
    if (!current || `${current} ${word}`.length > maxCharacters) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }
  return lines.length ? lines : ["—"];
};

function pageHeader(page: PdfPage, payload: PartnerOrderConfirmedEmailPayload) {
  rect(page, 0, pageHeight - 8, pageWidth, 8, "#0E191D");
  text(page, "BISPO", left, 785, 24, { bold: true, color: "#0E191D" });
  text(page, "TRUE COFFEE", left + 2, 770, 7, { color: "#52605D" });
  rightText(page, "PEDIDO CONFIRMADO", right, 784, 8, {
    bold: true,
    color: "#087568",
  });
  rightText(page, textValue(payload.orderCode), right, 768, 11, {
    bold: true,
  });
  line(page, left, 752, right, 752, "#0E191D", 1);
}

function firstPage(
  payload: PartnerOrderConfirmedEmailPayload,
  items: NonNullable<PartnerOrderConfirmedEmailPayload["items"]>,
) {
  const page: PdfPage = [];
  pageHeader(page, payload);

  text(page, "CÓPIA DO PEDIDO DO CLIENTE", left, 724, 8, {
    bold: true,
    color: "#087568",
  });
  text(page, "Resumo comercial", left, 700, 23, { bold: true });
  text(page, "Documento gerado pelo BBOS após a confirmação do pedido.", left, 681, 9, {
    color: "#626B69",
  });

  rect(page, left, 601, right - left, 58, "#E7F3EF");
  text(page, "CLIENTE", left + 16, 638, 7, { bold: true, color: "#087568" });
  text(page, textValue(payload.customerName), left + 16, 620, 12, { bold: true });
  if (payload.customerTaxId) {
    text(page, `CNPJ/CPF ${payload.customerTaxId}`, left + 16, 607, 8, {
      color: "#52605D",
    });
  }
  text(page, "DATA DO PEDIDO", 360, 638, 7, { bold: true, color: "#087568" });
  text(page, date(payload.orderDate), 360, 620, 10, { bold: true });

  text(page, "DADOS COMERCIAIS", left, 572, 8, {
    bold: true,
    color: "#087568",
  });
  text(page, "Pagamento", left, 550, 8, { color: "#626B69" });
  text(
    page,
    textValue(payload.paymentTerms || payload.paymentType),
    left,
    534,
    10,
    { bold: true },
  );
  text(page, "Entrega", 230, 550, 8, { color: "#626B69" });
  text(page, freightDescription(payload), 230, 534, 10, { bold: true });
  text(page, "Previsão", 430, 550, 8, { color: "#626B69" });
  text(page, date(payload.expectedDeliveryDate), 430, 534, 10, { bold: true });
  if (payload.customerReference) {
    text(page, "Referência do cliente", left, 511, 8, { color: "#626B69" });
    text(page, payload.customerReference, left, 495, 10, { bold: true });
  }

  text(page, "ITENS DO PEDIDO", left, 461, 8, {
    bold: true,
    color: "#087568",
  });
  rect(page, left, 426, right - left, 24, "#0E191D");
  text(page, "PRODUTO / APRESENTAÇÃO", left + 10, 434, 7, {
    bold: true,
    color: "#FFFFFF",
  });
  rightText(page, "QTD.", 350, 434, 7, { bold: true, color: "#FFFFFF" });
  rightText(page, "PREÇO UNIT.", 442, 434, 7, {
    bold: true,
    color: "#FFFFFF",
  });
  rightText(page, "SUBTOTAL", right - 8, 434, 7, {
    bold: true,
    color: "#FFFFFF",
  });

  let y = 400;
  for (const item of items.slice(0, 6)) {
    const nameLines = wrap(item.name || "Produto Bispo", 39).slice(0, 2);
    text(page, nameLines[0], left + 10, y, 9, { bold: true });
    if (nameLines[1]) text(page, nameLines[1], left + 10, y - 11, 8);
    if (item.sku) text(page, item.sku, left + 10, y - (nameLines[1] ? 22 : 13), 7, { color: "#626B69" });
    rightText(page, Number(item.quantity || 0), 350, y, 9);
    rightText(page, money(item.unitPriceCents), 442, y, 9);
    rightText(page, money(item.totalCents), right - 8, y, 9, { bold: true });
    line(page, left, y - 27, right, y - 27);
    y -= 43;
  }

  const totalsY = Math.min(120, y - 10);
  text(page, "Subtotal", 350, totalsY + 72, 9, { color: "#626B69" });
  rightText(page, money(payload.subtotalCents), right, totalsY + 72, 9);
  text(page, "Desconto", 350, totalsY + 53, 9, { color: "#626B69" });
  rightText(page, `- ${money(payload.discountCents)}`, right, totalsY + 53, 9);
  text(page, "Frete", 350, totalsY + 34, 9, { color: "#626B69" });
  rightText(page, money(payload.freightCents), right, totalsY + 34, 9);
  line(page, 350, totalsY + 23, right, totalsY + 23, "#0E191D", 1);
  text(page, "TOTAL", 350, totalsY, 11, { bold: true });
  rightText(page, money(payload.totalCents), right, totalsY, 13, { bold: true });

  text(page, "Bispo Coffees · True Coffee · Londrina, Paraná", left, 42, 7, {
    color: "#626B69",
  });
  rightText(page, "Documento eletrônico gerado pelo BBOS", right, 42, 7, {
    color: "#626B69",
  });
  return page;
}

function continuationPage(
  payload: PartnerOrderConfirmedEmailPayload,
  items: NonNullable<PartnerOrderConfirmedEmailPayload["items"]>,
  pageNumber: number,
) {
  const page: PdfPage = [];
  pageHeader(page, payload);
  text(page, "ITENS DO PEDIDO · CONTINUAÇÃO", left, 720, 8, {
    bold: true,
    color: "#087568",
  });
  let y = 685;
  for (const item of items) {
    text(page, textValue(item.name, "Produto Bispo"), left, y, 9, { bold: true });
    text(
      page,
      `${Number(item.quantity || 0)} × ${money(item.unitPriceCents)}`,
      left,
      y - 14,
      8,
      { color: "#626B69" },
    );
    rightText(page, money(item.totalCents), right, y, 9, { bold: true });
    line(page, left, y - 28, right, y - 28);
    y -= 43;
  }
  rightText(page, `Página ${pageNumber}`, right, 42, 7, { color: "#626B69" });
  return page;
}

function assemblePdf(pages: PdfPage[]) {
  const pageObjectStart = 3;
  const contentObjectStart = pageObjectStart + pages.length;
  const fontRegularObject = contentObjectStart + pages.length;
  const fontBoldObject = fontRegularObject + 1;
  const objects: Buffer[] = [];
  const pageReferences = pages
    .map((_, index) => `${pageObjectStart + index} 0 R`)
    .join(" ");

  objects.push(Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"));
  objects.push(
    Buffer.from(
      `<< /Type /Pages /Kids [${pageReferences}] /Count ${pages.length} >>`,
      "latin1",
    ),
  );
  for (let index = 0; index < pages.length; index += 1) {
    objects.push(
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularObject} 0 R /F2 ${fontBoldObject} 0 R >> >> /Contents ${contentObjectStart + index} 0 R >>`,
        "latin1",
      ),
    );
  }
  for (const commands of pages) {
    const content = Buffer.from(commands.join("\n"), "latin1");
    objects.push(
      Buffer.concat([
        Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "latin1"),
        content,
        Buffer.from("\nendstream", "latin1"),
      ]),
    );
  }
  objects.push(
    Buffer.from(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "latin1",
    ),
  );
  objects.push(
    Buffer.from(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
      "latin1",
    ),
  );

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%âãÏÓ\n", "latin1")];
  const offsets: number[] = [0];
  let length = chunks[0]!.length;
  for (let index = 0; index < objects.length; index += 1) {
    offsets[index + 1] = length;
    const prefix = Buffer.from(`${index + 1} 0 obj\n`, "latin1");
    const suffix = Buffer.from("\nendobj\n", "latin1");
    chunks.push(prefix, objects[index]!, suffix);
    length += prefix.length + objects[index]!.length + suffix.length;
  }
  const xref = length;
  chunks.push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
        .join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`,
      "latin1",
    ),
  );
  return Buffer.concat(chunks);
}

export function buildCustomerOrderPdf(
  payload: PartnerOrderConfirmedEmailPayload,
) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const pages: PdfPage[] = [firstPage(payload, items)];
  for (let index = 6; index < items.length; index += 15) {
    pages.push(continuationPage(payload, items.slice(index, index + 15), pages.length + 1));
  }
  return assemblePdf(pages);
}
