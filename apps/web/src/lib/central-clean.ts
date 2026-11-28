/** Regras da Central limpa: cada número aparece uma vez e todos batem entre si. */

export type ShipState = "TO_SHIP" | "SHIPPED" | "DELIVERED";

/** Foto frontal da embalagem pelo nome do produto (fotos da loja); sem foto quando não reconhece. */
const PHOTOS = ["caramelo", "singular", "essencial", "intenso", "sublime"] as const;
export function productPhoto(item: string | null | undefined): string | null {
  const text = (item ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const hit = PHOTOS.find((name) => text.includes(name));
  return hit ? `/brand/products/frontal/${hit}.jpg` : null;
}

export const SHIP_LABEL: Record<ShipState, { text: string; tone: "amber" | "gray" | "green" }> = {
  TO_SHIP: { text: "a despachar", tone: "amber" },
  SHIPPED: { text: "despachado", tone: "gray" },
  DELIVERED: { text: "entregue", tone: "green" },
};

export type StationTone = "ok" | "warn" | "bad";
export type Station = { key: "green" | "roast" | "ship" | "client"; label: string; status: string; tone: StationTone; href: string };

/**
 * A jornada do café em quatro paradas. Só diz o estado; o número de cada
 * decisão fica no cartão da fila (não se repete aqui).
 */
export function journeyStations(input: { greenDays: number | null | undefined; roastBehindKg: number; toShip: number; late: number }): Station[] {
  const g = input.greenDays;
  const green: Station = g === null || g === undefined
    ? { key: "green", label: "Café verde", status: "sem leitura", tone: "ok", href: "/estoque" }
    : g < 15
      ? { key: "green", label: "Café verde", status: "acabando", tone: "bad", href: "/compras" }
      : g < 45
        ? { key: "green", label: "Café verde", status: "comprar logo", tone: "warn", href: "/compras" }
        : { key: "green", label: "Café verde", status: "em dia", tone: "ok", href: "/estoque" };
  const roast: Station = input.roastBehindKg >= 10
    ? { key: "roast", label: "Torra", status: "atrasada", tone: "warn", href: "/producao" }
    : { key: "roast", label: "Torra", status: "em dia", tone: "ok", href: "/producao" };
  const ship: Station = input.toShip > 0
    ? { key: "ship", label: "Expedição", status: `${input.toShip} ${input.toShip === 1 ? "pedido para sair" : "pedidos para sair"}`, tone: input.late > 0 ? "bad" : "warn", href: "/pedidos" }
    : { key: "ship", label: "Expedição", status: "nada parado", tone: "ok", href: "/pedidos" };
  const client: Station = input.late > 0
    ? { key: "client", label: "Cliente", status: `${input.late} ${input.late === 1 ? "entrega atrasada" : "entregas atrasadas"}`, tone: "bad", href: "/pedidos" }
    : { key: "client", label: "Cliente", status: "entregas em dia", tone: "ok", href: "/pedidos" };
  return [green, roast, ship, client];
}

/** Onde o café parou: a primeira parada vermelha; senão a primeira amarela. */
export function stuckStation(stations: Station[]) {
  return stations.findIndex((s) => s.tone === "bad") >= 0 ? stations.findIndex((s) => s.tone === "bad") : stations.findIndex((s) => s.tone === "warn");
}

/** Meta do mês: % feito, onde deveria estar hoje e quanto falta. */
export function goalProgress(revenue: number, goal: number | null, dayOfMonth: number, daysInMonth: number) {
  if (!goal || goal <= 0) return null;
  const percent = Math.round((revenue / goal) * 100);
  const expected = Math.round((dayOfMonth / daysInMonth) * 100);
  return { percent, expected, onTrack: percent >= expected, missing: Math.max(0, Math.round(goal - revenue)), daysLeft: Math.max(0, daysInMonth - dayOfMonth) };
}

export const GROUP_ORDER = ["Signa · parceira B2B", "White Label (Bispo)", "Distribuidores", "Pontos de consumo", "Mercado Livre", "Loja online", "Outros / sem segmento"] as const;
/** Cores validadas (daltonismo e visão normal) na ordem em que se empilham. */
export const GROUP_COLOR: Record<string, string> = {
  "Signa · parceira B2B": "#1f8a5c",
  "White Label (Bispo)": "#7a5bd0",
  Distribuidores: "#b7793f",
  "Pontos de consumo": "#3b6fb6",
  "Mercado Livre": "#d9a91a",
  "Loja online": "#e0567a",
  "Outros / sem segmento": "#9aa09d",
};
export const GROUP_SHORT: Record<string, string> = {
  "Signa · parceira B2B": "Signa (parceira B2B)",
  "White Label (Bispo)": "White Label",
  "Outros / sem segmento": "Outros",
};

export type DayGroups = { day: string; groups: Record<string, number> };
export type Bar = { label: string; title: string; values: Record<string, number>; total: number };

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** 8 semanas (segunda a domingo, a partir de `since`) ou os últimos 14 dias até `today`. */
export function groupBars(days: DayGroups[], mode: "weeks" | "days", since: string, today: string): Bar[] {
  const byDay = new Map(days.map((d) => [d.day, d.groups]));
  const sum = (isoDays: string[]) => {
    const values: Record<string, number> = {};
    for (const d of isoDays) for (const [g, v] of Object.entries(byDay.get(d) ?? {})) values[g] = (values[g] ?? 0) + v;
    return { values, total: Object.values(values).reduce((a, b) => a + b, 0) };
  };
  if (mode === "weeks") {
    return Array.from({ length: 8 }, (_, w) => {
      const start = addDays(since, w * 7);
      const { values, total } = sum(Array.from({ length: 7 }, (_, k) => addDays(start, k)).filter((d) => d <= today));
      return { label: ddmm(start), title: `semana de ${ddmm(start)}${w === 7 ? " (até hoje)" : ""}`, values, total };
    });
  }
  return Array.from({ length: 14 }, (_, k) => {
    const d = addDays(today, k - 13);
    const { values, total } = sum([d]);
    return { label: ddmm(d), title: ddmm(d), values, total };
  });
}

/** Uma frase sobre o mês por grupo: quem sustenta e quanto vem dos pontos de consumo. */
export function monthReading(groups: Array<{ name: string; revenue: number }>) {
  const total = groups.reduce((s, g) => s + g.revenue, 0);
  if (total <= 0) return null;
  const sorted = [...groups].sort((a, b) => b.revenue - a.revenue);
  const [a, b] = sorted;
  const top = b ? `${short(a!.name)} e ${short(b.name)} somam ${Math.round(((a!.revenue + b.revenue) / total) * 100)}% do mês.` : `${short(a!.name)} é ${Math.round((a!.revenue / total) * 100)}% do mês.`;
  const consumo = groups.find((g) => g.name === "Pontos de consumo");
  const tail = consumo && consumo.revenue > 0 ? ` Cafeterias, restaurantes e outros pontos de consumo já são ${compact(consumo.revenue)}.` : "";
  return top + tail;
}
const short = (name: string) => (GROUP_SHORT[name] ?? name).replace(" (parceira B2B)", "");

export function compact(value: number) {
  if (value >= 1000) return `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(value).toLocaleString("pt-BR")}`;
}

/** Foto de quem está logado e de quem divide o dia (José e Suzi). */
export function founderPhotos(firstName: string) {
  const name = firstName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const jose = { name: "José", src: "/brand/founders/jose-rezende.jpg" };
  const suzi = { name: "Suzi", src: "/brand/founders/suzi-ninov.jpg" };
  if (name.startsWith("jose")) return { me: jose, partner: suzi };
  if (name.startsWith("suzi")) return { me: suzi, partner: jose };
  return { me: null, partner: null };
}
