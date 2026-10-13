import type { PartnerOrderConfirmedEmailPayload } from "./customer-email-template";

type PdfPage = string[];

const pageWidth = 595;
const pageHeight = 842;
const left = 48;
const right = pageWidth - 48;
const companyTaxId = "13.008.726/0001-12";
const companyPixKey = companyTaxId;
const firstPageItemLimit = 4;

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
    : new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
      }).format(parsed);
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

const statusDescription = (value: unknown) => {
  const labels: Record<string, string> = {
    DRAFT: "PROVISÓRIO",
    CONFIRMED: "CONFIRMADO",
    RESERVED: "RESERVADO",
    PICKING: "EM SEPARAÇÃO",
    READY_TO_SHIP: "PRONTO PARA EXPEDIÇÃO",
    INVOICED: "FATURADO",
    SHIPPED: "EXPEDIDO",
    DELIVERED: "ENTREGUE",
    CANCELLED: "CANCELADO",
  };
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  return labels[normalized] || normalized || "PEDIDO";
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
  page.push(`${rgb(color)} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
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
  text(page, "BISPO", left, 785, 30, { bold: true, color: "#0E191D" });
  text(page, "True Coffee", left + 3, 770, 7, { color: "#52605D" });
  rightText(page, "BISPO COFFEES LTDA", right, 792, 10, { bold: true });
  rightText(page, `CNPJ ${companyTaxId}`, right, 776, 8, {
    color: "#52605D",
  });
  rightText(page, "Av. Theodoro Victorelli, 800 - Helena", right, 761, 8, {
    color: "#52605D",
  });
  rightText(page, "Londrina - PR | CEP 86027-750", right, 746, 8, {
    color: "#52605D",
  });
  line(page, left, 730, right, 730, "#D8DFDC", 0.8);
}

function firstPage(
  payload: PartnerOrderConfirmedEmailPayload,
  items: NonNullable<PartnerOrderConfirmedEmailPayload["items"]>,
) {
  const page: PdfPage = [];
  pageHeader(page, payload);
  const orderCode = textValue(payload.orderCode, "Pedido Bispo");
  const customerName = textValue(payload.customerName, "Cliente");

  text(
    page,
    payload.orderType === "SAMPLE"
      ? "PEDIDO DE AMOSTRA"
      : "CONFIRMAÇÃO DE PEDIDO",
    left,
    696,
    24,
    { bold: true },
  );
  rightText(page, `Emissão: ${date(payload.orderDate)}`, right, 699, 9, {
    color: "#52605D",
  });
  text(page, `Cliente: ${customerName}`, left, 674, 11, { bold: true });
  rightText(page, orderCode, right, 674, 12, { bold: true, color: "#087568" });
  text(page, "Documento comercial para conferência do cliente", left, 657, 8, {
    color: "#626B69",
  });

  rect(page, left, 580, right - left, 60, "#E7EFED");
  text(page, "CLIENTE / FATURAMENTO", left + 12, 625, 7, {
    bold: true,
    color: "#087568",
  });
  text(
    page,
    textValue(payload.customerLegalName || payload.customerName),
    left + 12,
    608,
    10,
    { bold: true },
  );
  text(
    page,
    `CNPJ/CPF ${textValue(payload.customerTaxId)}`,
    left + 12,
    596,
    7,
    {
      color: "#52605D",
    },
  );
  text(page, "CONTATO / ENTREGA", 332, 625, 7, {
    bold: true,
    color: "#087568",
  });
  const contact = [payload.customerPhone, payload.customerEmail]
    .filter(Boolean)
    .join(" | ");
  text(page, textValue(contact), 332, 610, 8, { bold: true });
  const addressLines = wrap(payload.customerAddress, 48).slice(0, 2);
  text(page, addressLines[0], 332, 597, 7, { color: "#52605D" });
  if (addressLines[1])
    text(page, addressLines[1], 332, 587, 7, { color: "#52605D" });

  text(page, "CONDIÇÕES COMERCIAIS", left, 566, 7, {
    bold: true,
    color: "#087568",
  });
  text(page, "Pagamento", left, 548, 7, { color: "#626B69" });
  text(
    page,
    textValue(payload.paymentTerms || payload.paymentType),
    left,
    535,
    9,
    { bold: true },
  );
  text(page, "Frete", 218, 548, 7, { color: "#626B69" });
  text(page, freightDescription(payload), 218, 535, 9, { bold: true });
  text(page, "Entrega prevista", 418, 548, 7, { color: "#626B69" });
  text(page, date(payload.expectedDeliveryDate), 418, 535, 9, { bold: true });
  if (payload.customerReference) {
    text(page, `Referência / PO: ${payload.customerReference}`, left, 518, 8, {
      color: "#52605D",
    });
  }

  rect(page, left, 475, right - left, 25, "#0E191D");
  text(page, "PRODUTO / APRESENTAÇÃO", left + 10, 483, 7, {
    bold: true,
    color: "#FFFFFF",
  });
  rightText(page, "QTD.", 350, 483, 7, { bold: true, color: "#FFFFFF" });
  rightText(page, "PREÇO UNIT.", 442, 483, 7, {
    bold: true,
    color: "#FFFFFF",
  });
  rightText(page, "TOTAL", right - 8, 483, 7, {
    bold: true,
    color: "#FFFFFF",
  });

  let y = 450;
  for (const item of items.slice(0, firstPageItemLimit)) {
    const nameLines = wrap(item.name || "Produto Bispo", 39).slice(0, 2);
    text(page, nameLines[0], left + 10, y, 9, { bold: true });
    if (nameLines[1]) text(page, nameLines[1], left + 10, y - 11, 8);
    if (item.sku)
      text(page, item.sku, left + 10, y - (nameLines[1] ? 22 : 13), 7, {
        color: "#626B69",
      });
    rightText(page, Number(item.quantity || 0), 350, y, 9);
    rightText(page, money(item.unitPriceCents), 442, y, 9);
    rightText(page, money(item.totalCents), right - 8, y, 9, { bold: true });
    line(page, left, y - 27, right, y - 27);
    y -= 40;
  }

  const summaryTop = Math.max(220, y - 4);
  rect(page, left, summaryTop - 35, right - left, 35, "#EEF2F0");
  text(page, "SUBTOTAL DOS PRODUTOS", left + 12, summaryTop - 14, 8, {
    bold: true,
  });
  rightText(
    page,
    money(payload.subtotalCents),
    right - 12,
    summaryTop - 17,
    14,
    { bold: true },
  );
  text(
    page,
    `Desconto: ${money(payload.discountCents)}  |  Frete: ${money(payload.freightCents)}`,
    left + 12,
    summaryTop - 51,
    8,
    { color: "#52605D" },
  );

  rect(page, left, summaryTop - 113, right - left, 50, "#0E191D");
  text(page, "TOTAL DO PEDIDO", left + 14, summaryTop - 84, 10, {
    bold: true,
    color: "#FFFFFF",
  });
  text(
    page,
    `${items.reduce((total, item) => total + Number(item.quantity || 0), 0)} pacotes`,
    left + 14,
    summaryTop - 99,
    7,
    { color: "#D8DFDC" },
  );
  rightText(page, money(payload.totalCents), right - 14, summaryTop - 96, 23, {
    bold: true,
    color: "#FFFFFF",
  });

  const statusY = summaryTop - 137;
  text(
    page,
    `Status: ${statusDescription(payload.orderStatus)}`,
    left,
    statusY,
    8,
    { bold: true, color: "#087568" },
  );
  if (payload.acceptedByName && payload.acceptedAt) {
    text(
      page,
      `Confirmado por ${payload.acceptedByName} em ${date(payload.acceptedAt)}`,
      left,
      statusY - 16,
      8,
      { color: "#52605D" },
    );
  } else {
    text(
      page,
      "Conferência: produtos, quantidades, valores e condições comerciais.",
      left,
      statusY - 16,
      8,
      { color: "#52605D" },
    );
  }

  if (payload.notes) {
    const noteLines = wrap(payload.notes, 95).slice(0, 2);
    text(page, `Observações: ${noteLines[0]}`, left, statusY - 34, 7, {
      color: "#52605D",
    });
    if (noteLines[1])
      text(page, noteLines[1], left + 57, statusY - 45, 7, {
        color: "#52605D",
      });
  }

  const pixY = Math.max(70, statusY - (payload.notes ? 88 : 58));
  rect(page, left, pixY, right - left, 40, "#E7EFED");
  text(page, "PAGAMENTO VIA PIX", left + 12, pixY + 26, 7, {
    bold: true,
    color: "#087568",
  });
  text(page, `Chave PIX (CNPJ): ${companyPixKey}`, left + 12, pixY + 11, 10, {
    bold: true,
  });
  rightText(
    page,
    `Identifique o pagamento com o pedido ${orderCode}`,
    right - 12,
    pixY + 11,
    7,
    { color: "#52605D" },
  );

  text(
    page,
    "Bispo Coffees | True Coffee | www.bispocoffees.com.br",
    left,
    42,
    7,
    {
      color: "#626B69",
    },
  );
  rightText(
    page,
    `Documento comercial | ${orderCode} | 1 / ${items.length > firstPageItemLimit ? Math.ceil((items.length - firstPageItemLimit) / 15) + 1 : 1}`,
    right,
    42,
    7,
    {
      color: "#626B69",
    },
  );
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
    text(page, textValue(item.name, "Produto Bispo"), left, y, 9, {
      bold: true,
    });
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
        .join(
          "\n",
        )}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`,
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
  for (let index = firstPageItemLimit; index < items.length; index += 15) {
    pages.push(
      continuationPage(
        payload,
        items.slice(index, index + 15),
        pages.length + 1,
      ),
    );
  }
  return assemblePdf(pages);
}
