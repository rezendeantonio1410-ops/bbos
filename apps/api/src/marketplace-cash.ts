// Dinheiro de marketplace a liberar (ex.: Mercado Livre → Mercado Pago), para o
// fluxo de caixa. Valor líquido (venda − tarifa), previsto para a data da venda
// + prazo de liberação, agrupado por dia. Só o que ainda vai ser liberado: o
// que já foi liberado está no saldo (Mercado Pago ou Itaú) e não conta de novo.

export const MARKETPLACE_RELEASE_DAYS = 15;

const DAY = 86_400_000;

/** Data (AAAA-MM-DD) em São Paulo. */
function saoPauloDate(value: Date) {
  return new Date(value.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export type MarketplaceSale = { orderedAt: Date | string; gross: number; fee: number; channel: string };

export function marketplaceReleases(sales: MarketplaceSale[], now = new Date(), releaseDays = MARKETPLACE_RELEASE_DAYS) {
  const today = saoPauloDate(now);
  const byDay = new Map<string, { channel: string; date: string; amount: number; count: number }>();
  for (const sale of sales) {
    const net = Math.max(0, (Number(sale.gross) || 0) - (Number(sale.fee) || 0));
    if (!net) continue;
    const release = saoPauloDate(new Date(new Date(sale.orderedAt).getTime() + releaseDays * DAY));
    if (release < today) continue;
    const key = `${sale.channel}|${release}`;
    const entry = byDay.get(key) ?? { channel: sale.channel, date: release, amount: 0, count: 0 };
    entry.amount += net;
    entry.count += 1;
    byDay.set(key, entry);
  }
  return [...byDay.values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.channel.localeCompare(b.channel))
    .map((entry) => ({
      id: `${entry.channel}-${entry.date}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      document: `${entry.count} ${entry.count === 1 ? "venda" : "vendas"}`,
      counterparty: `${entry.channel} · a liberar`,
      description: `Valor líquido (venda − tarifa), ~${releaseDays} dias após a venda`,
      category: "Marketplace",
      dueDate: entry.date,
      amount: Math.round(entry.amount * 100) / 100,
      status: "OPEN",
    }));
}
