import * as QRCode from "qrcode";
import { BISPO_PIX_KEY } from "./billing-pix";

export type PartnerPixData = {
  order: { orderNumber?: string | null; code?: string | null };
  receivable: { dueDate: Date | string };
  amountCents: number;
  openCents: number;
  pix: string;
};

export function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 14
    ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : digits;
}

/**
 * Read-only view of the static Bispo Coffees Pix for one open receivable.
 * It never records a payment: settlement stays with Bispo's finance team.
 */
export async function buildPartnerPixView(data: PartnerPixData) {
  const qrSvg = await QRCode.toString(data.pix, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 240,
  });
  return {
    orderCode: String(data.order.orderNumber ?? data.order.code ?? ""),
    beneficiary: "Bispo Coffees Ltda",
    pixKey: formatCnpj(BISPO_PIX_KEY),
    amountCents: data.amountCents,
    openCents: data.openCents,
    dueDate: new Date(data.receivable.dueDate).toISOString().slice(0, 10),
    copyPaste: data.pix,
    qrSvg,
    notice:
      "Pagamento por Pix estático da Bispo Coffees. A baixa depende da confirmação do recebimento pelo financeiro da Bispo; envie o comprovante após pagar.",
  };
}
