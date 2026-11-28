/** "Como foi?" em 1 toque: vira o registro de visita aceito por POST /customers/:id/visits. */

export const NO_ORDER_REASONS = ["Ainda tem estoque", "Preço", "Responsável ausente", "Fechado", "Outro motivo"] as const;
export const RETURN_IN_DAYS = [3, 7, 15] as const;

export type VisitChoice =
  | { kind: "ORDER" }
  | { kind: "NO_ORDER"; reason: string }
  | { kind: "LATER"; days: number };

export type VisitBody = { visitAt: string; purpose: string; outcome: string; facts: string; nextAction?: string; nextActionAt?: string; latitude?: number; longitude?: number };

export function visitPayload(choice: VisitChoice, now: Date, place: { lat: number; lng: number } | null): VisitBody {
  const base = { visitAt: now.toISOString(), purpose: "POS_VENDA", ...(place ? { latitude: place.lat, longitude: place.lng } : {}) };
  if (choice.kind === "ORDER") {
    return { ...base, outcome: "PEDIDO", facts: "Visita pelo app BBOS Campo: cliente fez pedido." };
  }
  if (choice.kind === "NO_ORDER") {
    return { ...base, outcome: "ACOMPANHAR", facts: `Visita pelo app BBOS Campo: sem pedido. Motivo: ${choice.reason}.` };
  }
  const at = new Date(now.getTime() + choice.days * 86_400_000);
  return {
    ...base,
    outcome: "ACOMPANHAR",
    facts: `Visita pelo app BBOS Campo: combinado voltar em ${choice.days} dias.`,
    nextAction: "Voltar a visitar o cliente",
    nextActionAt: at.toISOString(),
  };
}
