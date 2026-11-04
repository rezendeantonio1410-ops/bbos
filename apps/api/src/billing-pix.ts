// BR Code estático conforme Manual de Padrões para Iniciação do Pix (BCB).
// https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf
import { createHash } from "node:crypto";
export const BISPO_PIX_KEY = "13008726000112";
export function pixCrc16(value: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(value, "utf8")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
const field = (id: string, value: string) => {
  const length = Buffer.byteLength(value, "utf8");
  if (length > 99) throw new Error("Campo Pix excede o limite permitido.");
  return `${id}${String(length).padStart(2, "0")}${value}`;
};
export function buildBillingPix(
  amountCents: number,
  receivableId: string,
): string {
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > 99999999999
  )
    throw new Error("Saldo inválido para Pix.");
  // Unique stable reference without exposing database identifiers.
  const txid = createHash("sha256")
    .update(receivableId)
    .digest("hex")
    .slice(0, 25);
  const payload =
    field("00", "01") +
    field("26", field("00", "br.gov.bcb.pix") + field("01", BISPO_PIX_KEY)) +
    field("52", "0000") +
    field("53", "986") +
    field("54", (amountCents / 100).toFixed(2)) +
    field("58", "BR") +
    field("59", "BISPO COFFEES LTDA") +
    field("60", "LONDRINA") +
    field("62", field("05", txid)) +
    "6304";
  return payload + pixCrc16(payload);
}
