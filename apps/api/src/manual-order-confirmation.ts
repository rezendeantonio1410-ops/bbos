// Confirmação do pedido pelo vendedor, quando o cliente aprovou fora do link.

export const MANUAL_CHANNELS = ["WHATSAPP", "PHONE", "IN_PERSON", "EMAIL"] as const;
export type ManualChannel = (typeof MANUAL_CHANNELS)[number];
export const MANUAL_CHANNEL_LABEL: Record<ManualChannel, string> = {
  WHATSAPP: "WhatsApp",
  PHONE: "telefone",
  IN_PERSON: "pessoalmente",
  EMAIL: "e-mail",
};

export function validateManualConfirmation(body: { channel?: unknown; customerContact?: unknown; note?: unknown }) {
  const channel = String(body.channel ?? "").toUpperCase() as ManualChannel;
  if (!MANUAL_CHANNELS.includes(channel)) throw new Error("Escolha como o cliente aprovou: WhatsApp, telefone, pessoalmente ou e-mail.");
  const customerContact = String(body.customerContact ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (customerContact.length < 2) throw new Error("Informe o nome de quem aprovou pelo cliente.");
  const note = String(body.note ?? "").trim().slice(0, 500) || null;
  return { channel, customerContact, note };
}
