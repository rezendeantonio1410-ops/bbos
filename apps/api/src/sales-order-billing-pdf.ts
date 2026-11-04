import * as QRCode from "qrcode";
import { billingPdfDrawing as draw } from "./customer-order-pdf";
import { BISPO_PIX_KEY } from "./billing-pix";
import type { SalesOrderBillingData } from "./sales-order-billing-data";

export function buildSalesOrderBillingPdf(data: SalesOrderBillingData): Buffer {
  const { order, receivable, invoice, openCents, amountCents, pix } = data;
  const pages: string[][] = [];
  const code = String(order.orderNumber ?? order.code);
  const customer = order.customer ?? {};
  const header = (page: string[], title: string) => {
    page.push("q 138 0 0 38.51 48 754 cm /Logo Do Q");
    draw.text(page, "BISPO COFFEES LTDA", 325, 792, 10, { bold: true });
    draw.text(page, "CNPJ 13.008.726/0001-12", 325, 776, 9);
    draw.text(page, "Rua Thedoro Victorelli, 800", 325, 761, 9);
    draw.text(page, "Londrina - PR | CEP 86.035-000", 325, 746, 9);
    draw.line(page, 48, 730, 547, 730);
    draw.text(page, title, 48, 704, 15, { bold: true });
    draw.text(page, `Pedido ${code}`, 48, 684, 10);
  };
  const footer = (page: string[], number: number) => {
    draw.line(page, 48, 57, 547, 57);
    draw.text(
      page,
      "Documento de cobrança. Não substitui a NF-e nem comprova pagamento.",
      48,
      43,
      8,
    );
    draw.rightText(page, `${number} / ${pages.length}`, 547, 28, 8);
  };
  const page: string[] = [];
  pages.push(page);
  header(page, "DOCUMENTO DE COBRANÇA");
  const nameLines = draw
    .wrap(customer.legalName || customer.name, 70)
    .slice(0, 2);
  nameLines.forEach((line, i) =>
    draw.text(page, line, 48, 658 - i * 13, 11, { bold: true }),
  );
  draw.text(page, `CPF/CNPJ: ${customer.taxId || "Não informado"}`, 48, 624, 9);
  const address = [
    customer.address,
    customer.addressNumber,
    customer.addressComplement,
    customer.district,
    customer.city,
    customer.state,
    customer.postalCode,
  ]
    .filter(Boolean)
    .join(" - ");
  draw
    .wrap(address, 95)
    .slice(0, 2)
    .forEach((line, i) => draw.text(page, line, 48, 609 - i * 12, 9));
  draw.rect(page, 48, 535, 499, 46, "#E0EAE9");
  draw.text(page, "SALDO A PAGAR", 60, 563, 8, { bold: true });
  draw.text(page, draw.money(openCents), 60, 545, 16, { bold: true });
  draw.text(page, "VENCIMENTO", 278, 563, 8, { bold: true });
  draw.text(page, draw.date(receivable.dueDate), 278, 545, 13, { bold: true });
  draw.text(page, `Título: ${draw.money(amountCents)}`, 420, 561, 8);
  draw.text(
    page,
    `Abatido: ${draw.money(amountCents - openCents)}`,
    420,
    546,
    8,
  );
  draw.text(
    page,
    `NF-e ${invoice.number} | Série ${invoice.series || "Não informada"} | Autorizada`,
    48,
    517,
    10,
    { bold: true },
  );
  draw.text(page, `Chave: ${invoice.accessKey}`, 48, 501, 9);
  draw.rightText(page, `Emissão: ${draw.date(new Date())}`, 547, 684, 9);
  const items = Array.isArray(order.items) ? order.items : [];
  const itemTable = (target: string[], chunk: any[], y: number) => {
    draw.rect(target, 48, y - 6, 499, 22, "#0E191D");
    draw.text(target, "ITENS DA COMPRA", 56, y + 1, 8, {
      bold: true,
      color: "#FFFFFF",
    });
    draw.text(target, "QTD.", 355, y + 1, 8, { color: "#FFFFFF" });
    draw.text(target, "UNIT. (R$)", 403, y + 1, 8, { color: "#FFFFFF" });
    draw.text(target, "TOTAL (R$)", 482, y + 1, 8, { color: "#FFFFFF" });
    y -= 27;
    for (const item of chunk) {
      const name = draw
        .wrap(item.productName || item.sku || "Produto", 48)
        .slice(0, 2);
      name.forEach((line, i) => draw.text(target, line, 56, y - i * 12, 9));
      draw.rightText(
        target,
        Number(item.quantity).toLocaleString("pt-BR"),
        385,
        y,
        9,
      );
      draw.rightText(
        target,
        draw.money(Math.round(Number(item.unitPrice) * 100)),
        465,
        y,
        9,
      );
      draw.rightText(
        target,
        draw.money(Math.round(Number(item.totalAmount) * 100)),
        540,
        y,
        9,
      );
      draw.line(target, 48, y - 23, 547, y - 23);
      y -= 36;
    }
  };
  itemTable(page, items.slice(0, 4), 475);
  draw.text(
    page,
    `Subtotal: ${draw.money(Math.round(Number(order.subtotal ?? order.totalAmount) * 100))} | Desconto: ${draw.money(Math.round(Number(order.discount ?? 0) * 100))} | Frete: ${draw.money(Math.round(Number(order.freight ?? 0) * 100))}`,
    48,
    310,
    8,
  );
  draw.text(
    page,
    `Total do pedido: ${draw.money(Math.round(Number(order.totalAmount) * 100))} | Condição: ${String(order.paymentTermsSnapshot || "A prazo").slice(0, 60)}`,
    48,
    295,
    9,
  );
  draw.text(page, "PAGAMENTO VIA PIX", 48, 269, 11, { bold: true });
  draw.text(page, `Chave CNPJ: ${BISPO_PIX_KEY}`, 48, 249, 10, { bold: true });
  draw.text(page, "Favorecido: Bispo Coffees Ltda", 48, 231, 10);
  draw.text(
    page,
    `Valor deste documento: ${draw.money(openCents)}`,
    48,
    213,
    10,
  );
  draw
    .wrap(
      "Confira o favorecido e o valor no aplicativo do seu banco. Após pagar, envie o comprovante à Bispo.",
      58,
    )
    .forEach((line, i) => draw.text(page, line, 48, 191 - i * 13, 9));
  draw
    .wrap(
      "A baixa no BBOS depende da confirmação do recebimento. O QR Code não expira automaticamente no vencimento.",
      58,
    )
    .forEach((line, i) => draw.text(page, line, 48, 145 - i * 12, 8));
  const matrix = QRCode.create(pix, { errorCorrectionLevel: "M" }).modules;
  const moduleSize = 146 / (matrix.size + 8);
  draw.rect(page, 394, 117, 146, 146, "#FFFFFF");
  for (let row = 0; row < matrix.size; row++)
    for (let col = 0; col < matrix.size; col++)
      if (matrix.get(row, col)) {
        draw.rect(
          page,
          394 + (col + 4) * moduleSize,
          117 + (matrix.size + 3 - row) * moduleSize,
          moduleSize,
          moduleSize,
          "#0A0A0A",
        );
      }
  draw.text(page, "PIX COPIA E COLA", 48, 98, 8, { bold: true });
  // One selectable line, scaled horizontally to keep the full payload copyable.
  page.push(`q 0.64 0 0 1 0 0 cm`);
  draw.text(page, pix, 48 / 0.64, 82, 7);
  page.push("Q");
  for (let i = 4; i < items.length; i += 15) {
    const next: string[] = [];
    pages.push(next);
    header(next, "ITENS DA COBRANÇA");
    itemTable(next, items.slice(i, i + 15), 651);
  }
  pages.forEach((p, i) => footer(p, i + 1));
  return draw.assemblePdf(pages);
}
