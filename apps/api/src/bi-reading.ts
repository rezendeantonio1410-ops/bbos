/**
 * Leitura (BI): árvore do resultado, ponte do lucro, olhar para frente,
 * plano de ação 5W2H, matriz de produtos, curva ABC e FOFA.
 * Funções puras: recebem números já agregados e devolvem a leitura.
 * Compara os últimos 30 dias com os 30 anteriores (vale em qualquer dia).
 */

export type Window = {
  revenue: number; // vendas diretas (pedidos do BBOS)
  orders: number;
  clients: number;
  newClients: number;
  newClientsRevenue: number;
  kg: number;
  units: number;
  cost: number; // custo do café e embalagem dos itens com custo
  costedRevenue: number;
  marketplaceRevenue: number;
  marketplaceOrders: number;
  greenInputKg: number; // torra do período
  roastedKg: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const div = (a: number, b: number) => (b > 0 ? a / b : 0);
const change = (cur: number, prev: number) => (prev > 0 ? r1(((cur - prev) / prev) * 100) : null);

export function windowMetrics(w: Window) {
  const pricePerKg = div(w.revenue, w.kg);
  const costPerKg = w.kg > 0 && w.costedRevenue > 0 ? div(w.cost, w.kg * div(w.costedRevenue, w.revenue)) : 0;
  const marginPerKg = pricePerKg - costPerKg;
  const profit = w.costedRevenue > 0 ? w.kg * marginPerKg : 0;
  return {
    revenue: Math.round(w.revenue),
    totalRevenue: Math.round(w.revenue + w.marketplaceRevenue),
    clients: w.clients,
    ordersPerClient: r2(div(w.orders, w.clients)),
    ticket: Math.round(div(w.revenue, w.orders)),
    kg: r1(w.kg),
    pricePerKg: r2(pricePerKg),
    costPerKg: r2(costPerKg),
    marginPerKg: r2(marginPerKg),
    profit: Math.round(profit),
    marginPercent: pricePerKg > 0 && costPerKg > 0 ? r1((marginPerKg / pricePerKg) * 100) : null,
    lossPercent: w.greenInputKg > 0 ? r1((1 - w.roastedKg / w.greenInputKg) * 100) : null,
    packagesPerKg: r2(div(w.units, w.kg)),
    newClients: w.newClients,
    newClientsRevenue: Math.round(w.newClientsRevenue),
    marketplaceRevenue: Math.round(w.marketplaceRevenue),
    marketplaceOrders: w.marketplaceOrders,
    orders: w.orders,
  };
}

export type Metrics = ReturnType<typeof windowMetrics>;

/** Árvore: cada nó com atual, anterior, variação e se melhorou. */
export function resultTree(cur: Metrics, prev: Metrics) {
  const node = (current: number | null, previous: number | null, higherIsBetter = true) => {
    const delta = current !== null && previous !== null ? change(current, previous) : null;
    return { current, previous, change: delta, better: delta === null || Math.abs(delta) < 1 ? null : (delta > 0) === higherIsBetter };
  };
  return {
    revenue: node(cur.revenue, prev.revenue),
    clients: node(cur.clients, prev.clients),
    ordersPerClient: node(cur.ordersPerClient, prev.ordersPerClient),
    ticket: node(cur.ticket, prev.ticket),
    profit: node(cur.profit, prev.profit),
    kg: node(cur.kg, prev.kg),
    pricePerKg: node(cur.pricePerKg, prev.pricePerKg),
    costPerKg: node(cur.costPerKg, prev.costPerKg, false),
    lossPercent: node(cur.lossPercent, prev.lossPercent, false),
    marginPercent: node(cur.marginPercent, prev.marginPercent),
  };
}

/** Ponte do lucro: anterior + volume + preço − custo = atual. */
export function profitBridge(cur: Metrics, prev: Metrics) {
  const volume = Math.round((cur.kg - prev.kg) * prev.marginPerKg);
  const price = Math.round(cur.kg * (cur.pricePerKg - prev.pricePerKg));
  const cost = Math.round(-cur.kg * (cur.costPerKg - prev.costPerKg));
  return { start: prev.profit, volume, price, cost, end: prev.profit + volume + price + cost };
}

/** Em 3 frases: o que puxou, o que segurou, o que vigiar. */
export function threeSentences(cur: Metrics, prev: Metrics, watch: string[]) {
  const t = resultTree(cur, prev);
  const brl = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
  const ups: string[] = [];
  const downs: string[] = [];
  if (t.clients.better) ups.push(`${cur.clients} clientes compraram (eram ${prev.clients})${cur.newClients ? `, ${cur.newClients} novos` : ""}`);
  if (t.ordersPerClient.better) ups.push(`cada cliente comprou mais vezes (${num(prev.ordersPerClient)} → ${num(cur.ordersPerClient)} pedidos)`);
  if (t.ticket.better) ups.push(`o pedido médio subiu para ${brl(cur.ticket)}`);
  if (t.kg.better) ups.push(`o volume foi de ${num(prev.kg)} para ${num(cur.kg)} kg`);
  if (t.clients.better === false) downs.push(`menos clientes compraram (${prev.clients} → ${cur.clients})`);
  if (t.ordersPerClient.better === false) downs.push(`os clientes compraram menos vezes`);
  if (t.ticket.better === false) downs.push(`o pedido médio caiu para ${brl(cur.ticket)}`);
  if (t.pricePerKg.better === false) downs.push(`o preço médio caiu de ${brl(prev.pricePerKg)} para ${brl(cur.pricePerKg)} por kg`);
  if (t.lossPercent.better === false && cur.lossPercent !== null) downs.push(`a perda na torra subiu para ${num(cur.lossPercent)}%`);
  if (t.costPerKg.better === false) downs.push(`o custo por kg subiu para ${brl(cur.costPerKg)}`);
  return {
    pulled: ups.length ? cap(ups.slice(0, 2).join(" e ")) + "." : "Nenhum número cresceu contra os 30 dias anteriores.",
    held: downs.length ? cap(downs.slice(0, 2).join(" e ")) + "." : "Nada piorou contra os 30 dias anteriores.",
    watch: watch.length ? cap(watch.slice(0, 2).join(" e ")) + "." : "Nenhum risco à frente nos próximos 30 dias.",
  };
}

function num(n: number) { return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }); }
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

/** Projeção dos próximos 30 dias pela árvore. */
export function forecast(cur: Metrics, recurringActiveClients: number) {
  const perClient = cur.ordersPerClient * cur.ticket;
  const likely = Math.round(cur.clients * perClient + cur.marketplaceRevenue);
  const conservative = Math.round(Math.min(cur.clients, recurringActiveClients) * perClient + cur.marketplaceRevenue);
  const growth = Math.round(likely + Math.ceil(cur.newClients / 2) * cur.ticket);
  return { conservative, likely, growth, recurringActiveClients, newClientsAssumed: Math.ceil(cur.newClients / 2) };
}

/** Quando o café verde acaba e até quando comprar. */
export function greenCoverage(availableKg: number, consumed30Kg: number, now: Date, leadDays = 15) {
  if (consumed30Kg <= 0) return { days: null as number | null, runOutAt: null as string | null, buyBy: null as string | null, availableKg: r1(availableKg) };
  const perDay = consumed30Kg / 30;
  const days = Math.floor(availableKg / perDay);
  const runOut = new Date(now.getTime() + days * 86_400_000);
  const buyBy = new Date(runOut.getTime() - leadDays * 86_400_000);
  return { days, runOutAt: runOut.toISOString().slice(0, 10), buyBy: buyBy.toISOString().slice(0, 10), availableKg: r1(availableKg) };
}

/** Quanto a margem sobe se o preço subir R$ 5/kg e a perda cair 3 pontos. */
export function marginWhatIf(cur: Metrics, greenCostPerKg: number) {
  if (!cur.pricePerKg || !cur.costPerKg || cur.lossPercent === null || !greenCostPerKg) return null;
  const loss = cur.lossPercent / 100;
  const target = Math.max(0, loss - 0.03);
  const costSaving = greenCostPerKg / (1 - loss) - greenCostPerKg / (1 - target);
  const price = cur.pricePerKg + 5;
  const cost = cur.costPerKg - costSaving;
  return { priceIncrease: 5, lossTarget: r1(target * 100), marginPercent: r1(((price - cost) / price) * 100) };
}

export type MatrixCoffee = { name: string; kg: number; marginPercent: number | null; revenue: number };

/** Matriz de produtos: volume (acima da mediana) × margem (acima da média). */
export function productMatrix(coffees: MatrixCoffee[], averageMargin: number | null) {
  const priced = coffees.filter((c) => c.marginPercent !== null && c.kg > 0);
  const sorted = [...priced].map((c) => c.kg).sort((a, b) => a - b);
  const medianKg = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0;
  const cut = averageMargin ?? 60;
  const quadrant = (c: MatrixCoffee) => {
    const high = c.kg >= medianKg;
    const good = (c.marginPercent ?? 0) >= cut;
    return high && good ? "PROTEGER" : high ? "AJUSTAR_PRECO" : good ? "EMPURRAR" : "REVER";
  };
  const groups: Record<string, Array<{ name: string; kg: number; marginPercent: number }>> = { PROTEGER: [], AJUSTAR_PRECO: [], EMPURRAR: [], REVER: [] };
  for (const c of priced) groups[quadrant(c)]!.push({ name: c.name, kg: c.kg, marginPercent: c.marginPercent! });
  for (const list of Object.values(groups)) list.sort((a, b) => b.kg - a.kg);
  return { medianKg: r1(medianKg), marginCut: r1(cut), groups };
}

/** Curva ABC: A até 80% da receita, B até 95%, C o resto. */
export function abcCurve(customers: Array<{ name: string; total: number }>) {
  const total = customers.reduce((s, c) => s + c.total, 0);
  const sorted = [...customers].sort((a, b) => b.total - a.total);
  const out = { A: [] as string[], B: [] as string[], C: [] as string[], share: { A: 0, B: 0, C: 0 } };
  let acc = 0;
  for (const c of sorted) {
    acc += c.total;
    const upTo = total ? acc / total : 1;
    const cls = out.A.length === 0 || upTo <= 0.8 + 1e-9 ? "A" : upTo <= 0.95 + 1e-9 ? "B" : "C";
    out[cls].push(c.name);
    out.share[cls] += total ? (c.total / total) * 100 : 0;
  }
  out.share = { A: Math.round(out.share.A), B: Math.round(out.share.B), C: Math.round(out.share.C) };
  return out;
}

export type ActionInput = {
  cur: Metrics;
  prev: Metrics;
  green: ReturnType<typeof greenCoverage>;
  greenCostPerKg: number;
  reactivate: { id: string; name: string; value: number; daysSince: number } | null;
  newClients: number;
  topShare: number;
  latePayer: { id: string; name: string; days: number } | null;
  batchConfirmShare: number; // % de entregas confirmadas em lote
  pushCoffees: string[];
  adjustCoffees: string[];
};

export type Action = { key: string; title: string; why: string; how: string; who: string; when: string; impact: number | null; impactLabel: string; link: string };

/** Plano de ação 5W2H: cada ação vem de um ramo que piorou ou de um risco à frente. */
export function buildActions(input: ActionInput): Action[] {
  const { cur, prev } = input;
  const brl = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
  const actions: Action[] = [];
  const priceDrop = change(cur.pricePerKg, prev.pricePerKg);
  if (priceDrop !== null && priceDrop <= -8) {
    const impact = Math.round(5 * cur.kg);
    actions.push({ key: "PRICE", title: "Segurar o preço por kg", why: `O preço médio caiu ${Math.round(Math.abs(priceDrop))}% (${brl(prev.pricePerKg)} → ${brl(cur.pricePerKg)}/kg).`, how: `Tabela por volume e revisão de ${input.adjustCoffees.slice(0, 3).join(", ") || "os cafés de maior volume"}.`, who: "José ou Suzi", when: "próximos 7 dias", impact, impactLabel: `+${brl(impact)}/mês com R$ 5/kg`, link: "/bi?aba=margem" });
  } else if (input.adjustCoffees.length) {
    const impact = Math.round(5 * cur.kg * 0.5);
    actions.push({ key: "PRICE", title: "Rever preço dos cafés de margem baixa", why: `${input.adjustCoffees.slice(0, 3).join(", ")} vendem muito com margem abaixo da média.`, how: "Ajustar a tabela desses cafés ou do canal com menor preço por kg.", who: "José ou Suzi", when: "próximos 15 dias", impact, impactLabel: `+${brl(impact)}/mês com R$ 5/kg`, link: "/bi?aba=margem" });
  }
  if (input.green.days !== null && input.green.days < 45) {
    actions.push({ key: "GREEN", title: "Comprar café verde", why: `O estoque (${num(input.green.availableKg)} kg) dá para ~${input.green.days} dias no ritmo atual.`, how: "Pedido ao fornecedor dos lotes em uso, considerando 15 dias de entrega.", who: "Compras", when: `até ${fmtDate(input.green.buyBy)}`, impact: input.green.days < 20 ? 999_999 : 500_000, impactLabel: "evita parar a torra", link: "/compras-cafe-verde" });
  }
  if (input.reactivate) {
    actions.push({ key: `REACTIVATE:${input.reactivate.id}`, title: `Reativar ${input.reactivate.name}`, why: `Pedido médio de ${brl(input.reactivate.value)} e ${input.reactivate.daysSince} dias sem comprar.`, how: "Ligação e amostra do café mais vendido para ele.", who: "Vendas", when: "esta semana", impact: input.reactivate.value, impactLabel: brl(input.reactivate.value), link: "/bi?aba=clientes" });
  }
  if (cur.lossPercent !== null && cur.lossPercent >= 13 && input.greenCostPerKg > 0 && cur.kg > 0) {
    const loss = cur.lossPercent / 100;
    const target = Math.max(0.1, loss - 0.03);
    const extraGreen = cur.kg / (1 - loss) - cur.kg / (1 - target);
    const impact = Math.round(extraGreen * input.greenCostPerKg);
    const rose = prev.lossPercent !== null && cur.lossPercent - prev.lossPercent >= 2;
    actions.push({ key: "LOSS", title: `Baixar a perda de torra para ${num(target * 100)}%`, why: rose ? `Subiu de ${num(prev.lossPercent!)}% para ${num(cur.lossPercent)}%.` : `Está em ${num(cur.lossPercent)}%.`, how: "Revisar curva, temperatura e ponto de descarga das últimas torras.", who: "Torra", when: "próximas 5 torras", impact, impactLabel: `+${brl(impact)}/mês`, link: "/producao" });
  }
  if (input.newClients >= 2) {
    const impact = Math.round(Math.ceil(input.newClients / 2) * cur.ticket);
    actions.push({ key: "SECOND", title: "Segunda compra dos clientes novos", why: `${input.newClients} clientes novos nos últimos 30 dias; a recompra sustenta o próximo mês.`, how: "WhatsApp no ritmo de cada um, pela lista Quem chamar.", who: "Vendas", when: "contínuo", impact, impactLabel: `${brl(impact)} se metade voltar`, link: "/bi?aba=clientes" });
  }
  if (input.pushCoffees.length) {
    actions.push({ key: "PUSH", title: `Oferecer ${input.pushCoffees.slice(0, 2).join(" e ")}`, why: "Margem acima da média, mas pouco volume.", how: "Amostra para distribuidores e clientes A.", who: "Vendas", when: "próximos 30 dias", impact: null, impactLabel: "mais margem por kg", link: "/bi?aba=margem" });
  }
  if (input.topShare >= 50) {
    actions.push({ key: "CONCENTRATION", title: "Diminuir a dependência dos maiores clientes", why: `3 clientes fazem ${input.topShare}% da receita.`, how: "Prospectar nas cidades com maior pedido médio.", who: "Vendas", when: "próximos 60 dias", impact: null, impactLabel: "menos risco", link: "/prospeccao" });
  }
  if (input.latePayer) {
    actions.push({ key: `LATE:${input.latePayer.id}`, title: `Lembrar ${input.latePayer.name} antes do vencimento`, why: `Paga em média ${num(input.latePayer.days)} dias depois do vencimento.`, how: "Lembrete 2 dias antes, com Pix e boleto.", who: "Financeiro", when: "no próximo título", impact: null, impactLabel: "caixa mais cedo", link: "/financeiro" });
  }
  if (input.batchConfirmShare >= 30) {
    actions.push({ key: "DELIVERY_DATA", title: "Confirmar entregas no dia", why: `${Math.round(input.batchConfirmShare)}% das entregas foram confirmadas em lote, dias depois.`, how: "Confirmar no pedido assim que o cliente receber.", who: "Operação", when: "a partir de hoje", impact: null, impactLabel: "prazo medido de verdade", link: "/pedidos" });
  }
  return actions.sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0));
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export type SwotInput = {
  cur: Metrics;
  prev: Metrics;
  repeatRate: number;
  bestChannel: { name: string; marginPercent: number | null } | null;
  overdueAmount: number;
  avgDaysToCash: number | null;
  topShare: number;
  topName: string | null;
  green: ReturnType<typeof greenCoverage>;
  stalledBig: { name: string; value: number } | null;
  latePayer: { name: string; days: number } | null;
  pushCoffees: string[];
  bestCity: { name: string; revenue: number; clients: number } | null;
  marketplaceGrowth: number | null;
  weakDay: string | null;
  exactCostShare: number;
  batchConfirmShare: number;
  adjustCoffees: string[];
};

/** FOFA gerada pelos números: cada item traz o número que o gerou. */
export function swot(i: SwotInput) {
  const brl = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
  const g = change(i.cur.totalRevenue, i.prev.totalRevenue);
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const opportunities: string[] = [];
  const threats: string[] = [];
  if (g !== null && g >= 20) strengths.push(`Vendas ${g >= 100 ? `${num(1 + g / 100)}×` : `+${num(g)}%`} contra os 30 dias anteriores.`);
  if (i.overdueAmount <= 0) strengths.push(`Ninguém em atraso${i.avgDaysToCash !== null ? `; o dinheiro entra em ${num(i.avgDaysToCash)} dias` : ""}.`);
  if (i.bestChannel?.marginPercent) strengths.push(`${i.bestChannel.name} com margem de ${num(i.bestChannel.marginPercent)}%.`);
  if (i.repeatRate >= 50) strengths.push(`${i.repeatRate}% dos clientes voltam a comprar.`);
  if (i.cur.lossPercent !== null && i.prev.lossPercent !== null && i.cur.lossPercent - i.prev.lossPercent >= 2) weaknesses.push(`Perda na torra subiu de ${num(i.prev.lossPercent)}% para ${num(i.cur.lossPercent)}%.`);
  const priceDrop = change(i.cur.pricePerKg, i.prev.pricePerKg);
  if (priceDrop !== null && priceDrop <= -8) weaknesses.push(`Preço por kg caiu ${Math.round(Math.abs(priceDrop))}%.`);
  if (i.adjustCoffees.length) weaknesses.push(`${i.adjustCoffees.slice(0, 3).join(", ")} vendem muito com margem abaixo da média.`);
  if (i.batchConfirmShare >= 30) weaknesses.push("Entregas confirmadas em lote: o prazo de entrega não é medido.");
  if (i.exactCostShare < 90) weaknesses.push(`Custo exato em só ${i.exactCostShare}% da receita.`);
  if (i.pushCoffees.length) opportunities.push(`${i.pushCoffees.slice(0, 2).join(" e ")} têm margem acima da média e vendem pouco.`);
  if (i.bestCity) opportunities.push(`${i.bestCity.name}: ${brl(i.bestCity.revenue)} com ${i.bestCity.clients} cliente(s) — pedido grande na região.`);
  if (i.marketplaceGrowth !== null && i.marketplaceGrowth >= 30) opportunities.push(`Mercado Livre cresceu ${num(i.marketplaceGrowth)}%.`);
  if (i.weakDay) opportunities.push(`${i.weakDay} quase sem vendas: dia livre para visitas.`);
  if (i.topShare >= 40) threats.push(`3 clientes fazem ${i.topShare}% da receita${i.topName ? ` (${i.topName} é o maior)` : ""}.`);
  if (i.stalledBig) threats.push(`${i.stalledBig.name}: ${brl(i.stalledBig.value)} parado sem comprar.`);
  if (i.green.days !== null && i.green.days < 45) threats.push(`Café verde para ~${i.green.days} dias.`);
  if (i.latePayer) threats.push(`${i.latePayer.name} paga ${num(i.latePayer.days)} dias depois do vencimento.`);
  return { strengths, weaknesses, opportunities, threats };
}

/** Normaliza o nome da cidade: "LONDRINA" e "Londrina" são a mesma. */
export function cityKey(city: string | null, state: string | null) {
  const clean = (city ?? "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return clean ? `${clean}|${(state ?? "").trim().toUpperCase()}` : "";
}

export function cityLabel(city: string) {
  return city.trim().toLowerCase().replace(/(^|\s)(\p{L})/gu, (_m, s: string, l: string) => s + l.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase());
}
