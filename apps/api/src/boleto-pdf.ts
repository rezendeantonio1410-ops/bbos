import * as QRCode from "qrcode";
import { billingPdfDrawing as draw } from "./customer-order-pdf";
import { formatDigitableLine } from "./boleto-itau";

/**
 * PDF do boleto (ficha de compensação simplificada) anexado aos e-mails de
 * cobrança. Os dados vêm do boleto registrado no Itaú; o PDF não cria nada.
 */
export type BoletoPdfData = {
  digitableLine: string;
  barcode: string;
  ourNumber: string;
  wallet: string;
  agency: string;
  account: string;
  amountCents: number;
  dueDate: Date | string;
  issueDate: Date | string;
  yourNumber: string;
  payer: { name: string; taxId: string; address: string };
  pixCopyPaste?: string | null;
};

const PATTERNS = ["nnwwn", "wnnnw", "nwnnw", "wwnnn", "nnwnw", "wnwnn", "nwwnn", "nnnww", "wnnwn", "nwnwn"];

/** Barras pretas do código Intercalado 2 de 5, em módulos (fino = 1, largo = 3). */
export function itfModules(digits: string) {
  if (!/^\d+$/.test(digits) || digits.length % 2) throw new Error("Código ITF inválido.");
  const bars: Array<[number, number]> = [];
  let x = 0;
  const put = (black: boolean, wide: boolean) => {
    const w = wide ? 3 : 1;
    if (black) bars.push([x, w]);
    x += w;
  };
  put(true, false); put(false, false); put(true, false); put(false, false);
  for (let i = 0; i < digits.length; i += 2) {
    const b = PATTERNS[Number(digits[i])]!;
    const s = PATTERNS[Number(digits[i + 1])]!;
    for (let k = 0; k < 5; k++) { put(true, b[k] === "w"); put(false, s[k] === "w"); }
  }
  put(true, true); put(false, false); put(true, false);
  return { bars, width: x };
}

export function buildBoletoPdf(data: BoletoPdfData): Buffer {
  const page: string[] = [];
  const L = 40;
  const R = 555;
  const box = (label: string, value: string, x: number, y: number, w: number, opts: { bold?: boolean; right?: boolean } = {}) => {
    draw.line(page, x, y, x + w, y, "#9AA5A2");
    draw.text(page, label, x + 3, y - 9, 6.5, { color: "#52605D" });
    if (opts.right) draw.rightText(page, value, x + w - 4, y - 21, 9.5, { bold: opts.bold });
    else draw.text(page, value, x + 3, y - 21, 9.5, { bold: opts.bold });
  };
  const ficha = (top: number, title: string) => {
    draw.text(page, "Itaú", L, top, 15, { bold: true });
    draw.line(page, L + 52, top - 4, L + 52, top + 14, "#0E191D", 1.2);
    draw.text(page, "341-7", L + 60, top, 13, { bold: true });
    draw.line(page, L + 110, top - 4, L + 110, top + 14, "#0E191D", 1.2);
    draw.text(page, formatDigitableLine(data.digitableLine), R - 268, top, 9.5, { bold: true });
    draw.text(page, title, L, top - 14, 7, { color: "#52605D" });
    let y = top - 20;
    box("Local de pagamento", "Pague pelo app do seu banco, internet banking, lotéricas ou com o Pix do QR Code", L, y, 380);
    box("Vencimento", draw.date(data.dueDate), L + 380, y, R - L - 380, { bold: true, right: true });
    y -= 28;
    box("Beneficiário", "BISPO COFFEES LTDA · CNPJ 13.008.726/0001-12", L, y, 380);
    box("Agência / Código beneficiário", `${data.agency} / ${data.account}`, L + 380, y, R - L - 380, { right: true });
    y -= 28;
    box("Data do documento", draw.date(data.issueDate), L, y, 95);
    box("Nº documento (NF)", data.yourNumber, L + 95, y, 110);
    box("Espécie doc.", "DM", L + 205, y, 60);
    box("Carteira", data.wallet, L + 265, y, 115);
    box("Nosso número", `${data.wallet}/${data.ourNumber}`, L + 380, y, R - L - 380, { right: true });
    y -= 28;
    box("Instruções", "Não receber após 60 dias do vencimento.", L, y, 380);
    box("(=) Valor do documento", draw.money(data.amountCents), L + 380, y, R - L - 380, { bold: true, right: true });
    y -= 28;
    draw.line(page, L, y, R, y, "#9AA5A2");
    draw.text(page, "Pagador", L + 3, y - 9, 6.5, { color: "#52605D" });
    draw.text(page, `${data.payer.name} · ${data.payer.taxId}`, L + 3, y - 21, 9.5, { bold: true });
    draw.wrap(data.payer.address, 105).slice(0, 1).forEach((t) => draw.text(page, t, L + 3, y - 33, 8.5));
    return y - 42;
  };

  // Recibo do pagador
  ficha(800, "RECIBO DO PAGADOR");
  if (data.pixCopyPaste) {
    draw.text(page, "PIX COPIA E COLA", L, 618, 7, { bold: true });
    draw.wrap(data.pixCopyPaste, 95).slice(0, 3).forEach((t, i) => draw.text(page, t, L, 606 - i * 9, 6.5));
    const matrix = QRCode.create(data.pixCopyPaste, { errorCorrectionLevel: "M" }).modules;
    const size = 76;
    const unit = size / (matrix.size + 4);
    draw.rect(page, R - size, 586, size, size, "#FFFFFF");
    for (let row = 0; row < matrix.size; row++)
      for (let col = 0; col < matrix.size; col++)
        if (matrix.get(row, col))
          draw.rect(page, R - size + (col + 2) * unit, 586 + (matrix.size + 1 - row) * unit, unit, unit, "#0A0A0A");
  }
  // Linha de corte
  for (let x = L; x < R; x += 8) draw.line(page, x, 572, x + 4, 572, "#9AA5A2");
  draw.text(page, "Corte na linha pontilhada", L, 576, 6.5, { color: "#52605D" });

  // Ficha de compensação com código de barras (padrão FEBRABAN: ~103 x 13 mm)
  const bottom = ficha(548, "FICHA DE COMPENSAÇÃO");
  const { bars, width } = itfModules(data.barcode);
  const scale = 292 / width;
  for (const [x, w] of bars) draw.rect(page, L + x * scale, bottom - 44, w * scale, 37, "#000000");
  draw.rightText(page, "Autenticação mecânica", R, bottom - 20, 6.5, { color: "#52605D" });
  return draw.assemblePdf([page]);
}
