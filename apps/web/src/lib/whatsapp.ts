/**
 * WhatsApp em 1 toque: monta a mensagem já escrita (com os dados reais) e abre
 * o WhatsApp do aparelho direto na conversa do cliente.
 */

export type WhatsKind = "DUE_SOON" | "DUE_OVERDUE" | "DELIVERY_SOON" | "DELIVERY_LATE" | "RESTOCK" | "VISIT" | "THANKS" | "FREE";

export type WhatsContext = {
  seller: string;
  customer?: string;
  orderNumber?: string | null;
  amount?: number | null;
  date?: string | null; // AAAA-MM-DD
};

const WEEKDAY = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");

/** "segunda, 30/11" (ou "hoje" / "amanhã"). */
export function friendlyDate(iso: string, today = new Date()) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const local = new Date(today.getTime() - 3 * 3_600_000);
  const base = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const diff = Math.round((date - base) / 86_400_000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  return `${WEEKDAY[new Date(date).getUTCDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** Texto da mensagem, sempre em nome do vendedor e da Bispo Coffees. */
export function whatsMessage(kind: WhatsKind, ctx: WhatsContext, today = new Date()) {
  const hi = `Olá! Aqui é o ${ctx.seller || "time"}, da Bispo Coffees.`;
  const order = ctx.orderNumber ? `do pedido ${ctx.orderNumber}` : "do seu pedido";
  const value = ctx.amount ? `, de ${money(ctx.amount)},` : "";
  const when = ctx.date ? friendlyDate(ctx.date, today) : "";
  switch (kind) {
    case "DUE_SOON":
      return `${hi} Passando para lembrar que o pagamento ${order}${value} vence ${when === "hoje" || when === "amanhã" ? when : `na ${when}`}. Qualquer dúvida, estou à disposição!`;
    case "DUE_OVERDUE":
      return `${hi} Notei que o pagamento ${order}${value} venceu ${when === "ontem" ? "ontem" : `na ${when}`}. Consegue me confirmar a data do pagamento? Se já pagou, pode desconsiderar. Obrigado!`;
    case "DELIVERY_SOON":
      return `${hi} Seu pedido ${ctx.orderNumber ?? ""} está sendo preparado e a entrega está prevista para ${when === "hoje" || when === "amanhã" ? when : when ? `a ${when}` : "os próximos dias"}.`.replace("pedido  ", "pedido ");
    case "DELIVERY_LATE":
      return `${hi} Seu pedido ${ctx.orderNumber ?? ""} já está pronto e sai para entrega. Desculpe a demora, te aviso assim que estiver a caminho!`.replace("pedido  ", "pedido ");
    case "RESTOCK":
      return `${hi} Quer que eu já separe a reposição do seu café desta semana?`;
    case "VISIT":
      return `${hi} Estou passando pela sua região. Posso fazer uma visita rápida hoje?`;
    case "THANKS":
      return `${hi} Obrigado pela visita e pelo pedido! Qualquer coisa, é só me chamar por aqui.`;
    default:
      return "";
  }
}

export const WHATS_LABEL: Record<WhatsKind, string> = {
  DUE_SOON: "Lembrete de vencimento",
  DUE_OVERDUE: "Pagamento em atraso",
  DELIVERY_SOON: "Avisar a entrega",
  DELIVERY_LATE: "Avisar que está a caminho",
  RESTOCK: "Oferecer reposição",
  VISIT: "Combinar uma visita",
  THANKS: "Agradecer o pedido",
  FREE: "Escrever outra mensagem",
};

/** Só dígitos, com 55; vazio quando o telefone não serve para o WhatsApp. */
export function whatsNumber(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return "";
}

export function whatsUrl(phone: string, text: string) {
  const number = whatsNumber(phone);
  if (!number) return "";
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/**
 * Abre o WhatsApp. No app (Bispo Campo), a navegação para wa.me é entregue ao
 * Android, que abre o WhatsApp instalado; no navegador, abre em outra aba.
 */
export function openWhats(url: string) {
  if (!url || typeof window === "undefined") return;
  const native = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  if (native) window.location.href = url;
  else window.open(url, "_blank", "noopener");
}
