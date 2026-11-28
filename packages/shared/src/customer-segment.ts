/**
 * Tipo de cliente (segmento) e família de venda. Fonte única da regra:
 * o cadastro grava o nome canônico; relatórios agrupam por família.
 *
 *  - REVENDA: compra para revender (Distribuidor, White Label, Exportação).
 *  - CONSUMO: pontos de consumo — cafeterias, conveniências, padarias,
 *    restaurantes/hotéis, empórios, escritórios e varejo físico.
 *  - CONSUMIDOR: pessoa física (loja online, Mercado Livre, consumidor final).
 */
export const CUSTOMER_SEGMENTS = [
  "Distribuidor",
  "White Label",
  "Exportação",
  "Cafeteria",
  "Conveniência",
  "Padaria / confeitaria",
  "Restaurante / Hotel",
  "Empório / mercado",
  "Escritório",
  "Varejo",
  "E-commerce",
  "Consumidor final",
  "Outro",
] as const;
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

export type SegmentFamily = "REVENDA" | "CONSUMO" | "CONSUMIDOR" | "OUTRO";
export const SEGMENT_FAMILY_LABEL: Record<SegmentFamily, string> = {
  REVENDA: "Revenda",
  CONSUMO: "Pontos de consumo",
  CONSUMIDOR: "Consumidor final",
  OUTRO: "Sem segmento",
};

const FAMILY: Record<CustomerSegment, SegmentFamily> = {
  Distribuidor: "REVENDA",
  "White Label": "REVENDA",
  Exportação: "REVENDA",
  Cafeteria: "CONSUMO",
  Conveniência: "CONSUMO",
  "Padaria / confeitaria": "CONSUMO",
  "Restaurante / Hotel": "CONSUMO",
  "Empório / mercado": "CONSUMO",
  Escritório: "CONSUMO",
  Varejo: "CONSUMO",
  "E-commerce": "CONSUMIDOR",
  "Consumidor final": "CONSUMIDOR",
  Outro: "OUTRO",
};

const strip = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Variações já vistas no BBOS (códigos de prospect, maiúsculas, sinônimos). */
const ALIASES: Record<string, CustomerSegment> = {
  distribuidor: "Distribuidor",
  distribuidora: "Distribuidor",
  "white label": "White Label",
  "marca propria": "White Label",
  exportacao: "Exportação",
  export: "Exportação",
  cafeteria: "Cafeteria",
  cafe: "Cafeteria",
  conveniencia: "Conveniência",
  "posto conveniencia": "Conveniência",
  "posto de conveniencia": "Conveniência",
  posto: "Conveniência",
  padaria: "Padaria / confeitaria",
  "padaria confeitaria": "Padaria / confeitaria",
  confeitaria: "Padaria / confeitaria",
  "restaurante hotel": "Restaurante / Hotel",
  restaurante: "Restaurante / Hotel",
  hotel: "Restaurante / Hotel",
  "hotel pousada": "Restaurante / Hotel",
  "emporio mercado": "Empório / mercado",
  emporio: "Empório / mercado",
  mercado: "Empório / mercado",
  escritorio: "Escritório",
  empresa: "Escritório",
  "empresa escritorio": "Escritório",
  b2b: "Escritório",
  varejo: "Varejo",
  "e commerce": "E-commerce",
  ecommerce: "E-commerce",
  "consumidor final": "Consumidor final",
  outro: "Outro",
};

/** Nome canônico do segmento, ou null quando vazio ou desconhecido. */
export function normalizeCustomerSegment(raw: string | null | undefined): CustomerSegment | null {
  const key = strip(String(raw ?? "").replace(/_/g, " "));
  if (!key) return null;
  return ALIASES[key] ?? null;
}

export function segmentFamily(raw: string | null | undefined): SegmentFamily {
  const segment = normalizeCustomerSegment(raw);
  return segment ? FAMILY[segment] : "OUTRO";
}
