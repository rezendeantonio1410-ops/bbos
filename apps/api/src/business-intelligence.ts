/**
 * Inteligência (BI): margem e clientes a partir dos dados oficiais do BBOS.
 * Regra única de custo da matéria-prima por café-base, nesta ordem:
 *   1. ajuste manual (José ou Suzi): custo do café verde/kg e perda de torra;
 *   2. torras reais: custo dos lotes de café verde usados ÷ kg torrado;
 *   3. média dos lotes de café verde marcados para a linha do café
 *      (Raros, Épicos, Clássicos, Gourmet), com a perda média de torra;
 *   4. média da empresa (todas as torras com custo).
 * Embalagem: custo médio por pacote registrado na Produção.
 */

export type CostSource = "MANUAL" | "ROASTS" | "LINE" | "AVERAGE" | "NONE";

export const ROASTED_LINES = ["RAROS", "EPICOS", "CLASSICOS", "GOURMET"] as const;
export type RoastedLine = (typeof ROASTED_LINES)[number];
export const LINE_LABEL: Record<RoastedLine, string> = { RAROS: "Raros", EPICOS: "Épicos", CLASSICOS: "Clássicos", GOURMET: "Gourmet" };

/** Linhas de uso do lote de café verde: até 3, sem repetir. */
export function parseIntendedLines(value: unknown): RoastedLine[] {
  if (!Array.isArray(value)) throw new Error("Escolha as linhas em que o café será usado.");
  const lines = [...new Set(value.map((item) => String(item).trim().toUpperCase()))];
  if (lines.some((line) => !(ROASTED_LINES as readonly string[]).includes(line))) throw new Error("Linha inválida. Use Raros, Épicos, Clássicos ou Gourmet.");
  if (lines.length > 3) throw new Error("Escolha no máximo 3 linhas para o lote.");
  return lines as RoastedLine[];
}

export type LineLotRow = { line: string; greenCost: number; greenKg: number };

export type CoffeeRoastRow = { coffeeId: string; coffeeName: string; roasts: number; greenKg: number; greenCost: number; roastedKg: number };
export type CoffeeSettingRow = { coffeeId: string; greenCostPerKg: number; roastLossPercent: number; updatedByName: string | null; updatedAt: string | Date | null };
export type CoffeeCost = {
  coffeeId: string;
  coffeeName: string;
  source: CostSource;
  line: string | null;
  costPerRoastedKg: number | null;
  roasts: number;
  realCostPerRoastedKg: number | null;
  manual: { greenCostPerKg: number; roastLossPercent: number; updatedByName: string | null; updatedAt: string | null } | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function costFromSetting(setting: { greenCostPerKg: number; roastLossPercent: number }) {
  const loss = Math.min(Math.max(setting.roastLossPercent, 0), 40) / 100;
  return round2(setting.greenCostPerKg / (1 - loss));
}

export function companyAverage(roasts: CoffeeRoastRow[]) {
  const green = roasts.reduce((s, r) => s + r.greenCost, 0);
  const roasted = roasts.reduce((s, r) => s + (r.greenCost > 0 ? r.roastedKg : 0), 0);
  return roasted > 0 ? round2(green / roasted) : null;
}

/** Perda média de torra (%) nas torras registradas; 16% (dentro da faixa normal 15–18%) se ainda não houver. */
export function averageRoastLoss(roasts: CoffeeRoastRow[]) {
  const green = roasts.reduce((s, r) => s + r.greenKg, 0);
  const roasted = roasts.reduce((s, r) => s + r.roastedKg, 0);
  return green > 0 && roasted > 0 && roasted < green ? Math.round((1 - roasted / green) * 1000) / 10 : 16;
}

/** Custo por kg torrado de cada linha, pelos lotes marcados para ela. */
export function lineCosts(lots: LineLotRow[], roastLossPercent: number) {
  const result = new Map<string, number>();
  const sums = new Map<string, { cost: number; kg: number }>();
  for (const lot of lots) {
    if (lot.greenCost <= 0 || lot.greenKg <= 0) continue;
    const entry = sums.get(lot.line) ?? { cost: 0, kg: 0 };
    entry.cost += lot.greenCost;
    entry.kg += lot.greenKg;
    sums.set(lot.line, entry);
  }
  for (const [line, sum] of sums) result.set(line, costFromSetting({ greenCostPerKg: sum.cost / sum.kg, roastLossPercent }));
  return result;
}

/** Custo por kg torrado de cada café, com a fonte de onde veio. */
export function coffeeCosts(coffees: Array<{ coffeeId: string; coffeeName: string; line?: string | null }>, roasts: CoffeeRoastRow[], settings: CoffeeSettingRow[], byLine: Map<string, number> = new Map()): { average: number | null; costs: Map<string, CoffeeCost> } {
  const average = companyAverage(roasts);
  const costs = new Map<string, CoffeeCost>();
  for (const coffee of coffees) {
    const roast = roasts.find((r) => r.coffeeId === coffee.coffeeId);
    const real = roast && roast.greenCost > 0 && roast.roastedKg > 0 ? round2(roast.greenCost / roast.roastedKg) : null;
    const setting = settings.find((s) => s.coffeeId === coffee.coffeeId);
    const manual = setting && setting.greenCostPerKg > 0
      ? { greenCostPerKg: setting.greenCostPerKg, roastLossPercent: setting.roastLossPercent, updatedByName: setting.updatedByName, updatedAt: setting.updatedAt ? new Date(setting.updatedAt).toISOString() : null }
      : null;
    const line = coffee.line ? byLine.get(coffee.line) ?? null : null;
    const source: CostSource = manual ? "MANUAL" : real !== null ? "ROASTS" : line !== null ? "LINE" : average !== null ? "AVERAGE" : "NONE";
    costs.set(coffee.coffeeId, {
      coffeeId: coffee.coffeeId,
      coffeeName: coffee.coffeeName,
      source,
      line: coffee.line ?? null,
      costPerRoastedKg: manual ? costFromSetting(manual) : real ?? line ?? average,
      roasts: roast?.roasts ?? 0,
      realCostPerRoastedKg: real,
      manual,
    });
  }
  return { average, costs };
}

export type SaleItemRow = { orderId: string; channel: string; coffeeId: string | null; coffeeName: string | null; units: number; kg: number; revenue: number };

type Bucket = { name: string; revenue: number; kg: number; cost: number; orders: Set<string>; estimatedRevenue: number; uncostedRevenue: number };
const bucket = (name: string): Bucket => ({ name, revenue: 0, kg: 0, cost: 0, orders: new Set(), estimatedRevenue: 0, uncostedRevenue: 0 });

function closeBucket(b: Bucket) {
  const costedRevenue = b.revenue - b.uncostedRevenue;
  const marginPercent = costedRevenue > 0 ? Math.round(((costedRevenue - b.cost) / costedRevenue) * 1000) / 10 : null;
  return {
    name: b.name,
    revenue: Math.round(b.revenue),
    kg: Math.round(b.kg * 10) / 10,
    orders: b.orders.size,
    cost: Math.round(b.cost),
    margin: marginPercent === null ? null : Math.round(costedRevenue - b.cost),
    marginPercent,
    pricePerKg: b.kg > 0 ? Math.round((b.revenue / b.kg) * 100) / 100 : null,
    estimatedShare: b.revenue > 0 ? Math.round((b.estimatedRevenue / b.revenue) * 100) : 0,
  };
}

/** Margem bruta: receita − (kg × custo do café torrado + pacotes × embalagem). */
export function marginBreakdown(items: SaleItemRow[], costs: Map<string, CoffeeCost>, packagingPerUnit: number) {
  const total = bucket("Total");
  const byCoffee = new Map<string, Bucket>();
  const byChannel = new Map<string, Bucket>();
  for (const item of items) {
    const cost = item.coffeeId ? costs.get(item.coffeeId) : undefined;
    const perKg = cost?.costPerRoastedKg ?? null;
    const itemCost = perKg === null || item.kg <= 0 ? null : item.kg * perKg + item.units * packagingPerUnit;
    const coffeeKey = item.coffeeName ?? "Sem café definido";
    for (const b of [total, byCoffee.get(coffeeKey) ?? byCoffee.set(coffeeKey, bucket(coffeeKey)).get(coffeeKey)!, byChannel.get(item.channel) ?? byChannel.set(item.channel, bucket(item.channel)).get(item.channel)!]) {
      b.revenue += item.revenue;
      b.kg += item.kg;
      b.orders.add(item.orderId);
      if (itemCost === null) b.uncostedRevenue += item.revenue;
      else {
        b.cost += itemCost;
        if (cost?.source === "AVERAGE" || cost?.source === "LINE") b.estimatedRevenue += item.revenue;
      }
    }
  }
  const sort = (list: Bucket[]) => list.map(closeBucket).sort((a, b) => b.revenue - a.revenue);
  return { total: closeBucket(total), byCoffee: sort([...byCoffee.values()]), byChannel: sort([...byChannel.values()]) };
}

export type CustomerOrderRow = { customerId: string; name: string; phone: string | null; orderedAt: string | Date; amount: number };
export type CustomerSegment = "NO_RITMO" | "ATRASADO" | "GRANDE_PARADO" | "UMA_VEZ" | "PARADO";

const DAY = 86_400_000;

/** Segmenta clientes pelo ritmo de compra de cada um. */
export function customerInsights(rows: CustomerOrderRow[], now = new Date()) {
  const byCustomer = new Map<string, { name: string; phone: string | null; dates: number[]; total: number }>();
  for (const row of rows) {
    const entry = byCustomer.get(row.customerId) ?? { name: row.name, phone: row.phone, dates: [], total: 0 };
    entry.dates.push(new Date(row.orderedAt).getTime());
    entry.total += Math.max(0, row.amount);
    byCustomer.set(row.customerId, entry);
  }
  const orders = rows.length;
  const revenue = rows.reduce((s, r) => s + Math.max(0, r.amount), 0);
  const ticket = orders ? revenue / orders : 0;
  const customers = [...byCustomer.entries()].map(([id, c]) => {
    const dates = c.dates.sort((a, b) => a - b);
    const last = dates[dates.length - 1]!;
    const daysSince = Math.max(0, Math.floor((now.getTime() - last) / DAY));
    const rhythm = dates.length >= 2 ? Math.max(3, Math.round((last - dates[0]!) / DAY / (dates.length - 1))) : null;
    const avgTicket = c.total / dates.length;
    let segment: CustomerSegment;
    if (rhythm === null) segment = daysSince >= 30 && avgTicket >= Math.max(1000, ticket * 2) ? "GRANDE_PARADO" : "UMA_VEZ";
    else if (daysSince > Math.max(60, rhythm * 4)) segment = "PARADO";
    else if (daysSince > rhythm * 1.5 + 1) segment = "ATRASADO";
    else segment = "NO_RITMO";
    const overdueFactor = rhythm ? Math.min(3, daysSince / rhythm) : Math.min(3, daysSince / 30);
    return { id, name: c.name, phone: c.phone, orders: dates.length, total: Math.round(c.total), avgTicket: Math.round(avgTicket), rhythm, daysSince, segment, riskValue: Math.round(avgTicket), priority: avgTicket * overdueFactor };
  });
  const segments = (["NO_RITMO", "ATRASADO", "GRANDE_PARADO", "UMA_VEZ", "PARADO"] as const).map((key) => {
    const list = customers.filter((c) => c.segment === key).sort((a, b) => b.total - a.total);
    return { key, count: list.length, names: list.slice(0, 6).map((c) => c.name) };
  });
  const callList = customers
    .filter((c) => c.segment === "ATRASADO" || c.segment === "GRANDE_PARADO" || c.segment === "PARADO" || (c.segment === "UMA_VEZ" && c.daysSince >= 7))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8)
    .map(({ priority: _priority, ...rest }) => rest);
  const ranked = [...customers].sort((a, b) => b.total - a.total);
  const top = ranked.slice(0, 3).map((c) => ({ name: c.name, share: revenue > 0 ? Math.round((c.total / revenue) * 100) : 0 }));
  return {
    customers: customers.length,
    orders,
    revenue: Math.round(revenue),
    ticket: Math.round(ticket),
    repeatRate: customers.length ? Math.round((customers.filter((c) => c.orders >= 2).length / customers.length) * 100) : 0,
    repeatCustomers: customers.filter((c) => c.orders >= 2).length,
    segments,
    callList,
    concentration: { top, topShare: top.reduce((s, t) => s + t.share, 0), others: Math.max(0, customers.length - top.length) },
  };
}

export function parseCoffeeCostSetting(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Ajuste de custo inválido.");
  const value = body as Record<string, unknown>;
  const num = (v: unknown) => Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
  const coffeeId = String(value.coffeeId ?? "").trim();
  if (!coffeeId) throw new Error("Escolha o café.");
  if (value.greenCostPerKg === null || value.greenCostPerKg === "") return { coffeeId, greenCostPerKg: null, roastLossPercent: null };
  const greenCostPerKg = typeof value.greenCostPerKg === "number" ? value.greenCostPerKg : num(value.greenCostPerKg);
  const roastLossPercent = typeof value.roastLossPercent === "number" ? value.roastLossPercent : num(value.roastLossPercent ?? 16);
  if (!Number.isFinite(greenCostPerKg) || greenCostPerKg <= 0 || greenCostPerKg > 1000) throw new Error("Informe o custo do café verde por kg (R$).");
  if (!Number.isFinite(roastLossPercent) || roastLossPercent < 0 || roastLossPercent > 40) throw new Error("A perda de torra deve ficar entre 0% e 40%.");
  return { coffeeId, greenCostPerKg: round2(greenCostPerKg), roastLossPercent: Math.round(roastLossPercent * 10) / 10 };
}
