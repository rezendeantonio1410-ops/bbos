import type { Period, SalesMapLevel, SalesMapNode } from "@bbos/shared";

type NumericValue = number | string | null | undefined | { toString(): string };

export type SalesMapOrder = {
  id: string;
  code: string;
  totalAmount: NumericValue;
  quantity: number;
  customer: {
    id: string;
    name: string;
    countryCode?: string | null;
    countryName?: string | null;
    state?: string | null;
    city?: string | null;
  };
  finishedProduct?: {
    id: string;
    name: string;
    packageWeightG: number;
  } | null;
  items: Array<{
    productVariantId: string;
    productName: string;
    quantity: number;
    totalAmount: NumericValue;
    productVariant: {
      netWeightGrams: number;
      unitCost: NumericValue;
      product?: { id: string; name: string } | null;
    };
  }>;
};

type BrazilState = { name: string; region: string };

const brazilStates: Record<string, BrazilState> = {
  AC: { name: "Acre", region: "Norte" },
  AL: { name: "Alagoas", region: "Nordeste" },
  AP: { name: "Amapá", region: "Norte" },
  AM: { name: "Amazonas", region: "Norte" },
  BA: { name: "Bahia", region: "Nordeste" },
  CE: { name: "Ceará", region: "Nordeste" },
  DF: { name: "Distrito Federal", region: "Centro-Oeste" },
  ES: { name: "Espírito Santo", region: "Sudeste" },
  GO: { name: "Goiás", region: "Centro-Oeste" },
  MA: { name: "Maranhão", region: "Nordeste" },
  MT: { name: "Mato Grosso", region: "Centro-Oeste" },
  MS: { name: "Mato Grosso do Sul", region: "Centro-Oeste" },
  MG: { name: "Minas Gerais", region: "Sudeste" },
  PA: { name: "Pará", region: "Norte" },
  PB: { name: "Paraíba", region: "Nordeste" },
  PR: { name: "Paraná", region: "Sul" },
  PE: { name: "Pernambuco", region: "Nordeste" },
  PI: { name: "Piauí", region: "Nordeste" },
  RJ: { name: "Rio de Janeiro", region: "Sudeste" },
  RN: { name: "Rio Grande do Norte", region: "Nordeste" },
  RS: { name: "Rio Grande do Sul", region: "Sul" },
  RO: { name: "Rondônia", region: "Norte" },
  RR: { name: "Roraima", region: "Norte" },
  SC: { name: "Santa Catarina", region: "Sul" },
  SP: { name: "São Paulo", region: "Sudeste" },
  SE: { name: "Sergipe", region: "Nordeste" },
  TO: { name: "Tocantins", region: "Norte" },
};

const toNumber = (value: NumericValue) => Number(value ?? 0);
const normalizedKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const stateCodeByName = Object.fromEntries(
  Object.entries(brazilStates).map(([code, state]) => [
    normalizedKey(state.name),
    code,
  ]),
);

const resolveBrazilStateCode = (value?: string | null) => {
  const normalized = normalizedKey(value ?? "");
  if (brazilStates[normalized]) return normalized;
  return stateCodeByName[normalized] ?? "NI";
};

const resolveCountry = (customer: SalesMapOrder["customer"]) => {
  const suppliedCode = normalizedKey(customer.countryCode ?? "");
  const suppliedName = customer.countryName?.trim() ?? "";
  const normalizedName = normalizedKey(suppliedName);
  const code =
    suppliedCode ||
    (normalizedName === "BRASIL" || normalizedName === "BRAZIL" ? "BR" : "NI");
  const name =
    code === "BR"
      ? "Brasil"
      : suppliedName || (code === "NI" ? "País não informado" : code);
  return { code, name };
};

type NodeMetrics = {
  revenue: number;
  volumeKg: number;
  cost: number;
  unknownCostRevenue: number;
  orderIds: Set<string>;
  customerIds: Set<string>;
};

type NodeBuilder = {
  id: string;
  level: SalesMapLevel;
  code?: string;
  name: string;
  metrics: NodeMetrics;
  children: Map<string, NodeBuilder>;
};

const emptyMetrics = (): NodeMetrics => ({
  revenue: 0,
  volumeKg: 0,
  cost: 0,
  unknownCostRevenue: 0,
  orderIds: new Set<string>(),
  customerIds: new Set<string>(),
});

const nodeId = (level: SalesMapLevel, parts: string[]) =>
  ["sales-map", level, ...parts.map((part) => encodeURIComponent(part))].join(
    ":",
  );

const createNode = (
  level: SalesMapLevel,
  code: string | undefined,
  name: string,
  parts: string[],
): NodeBuilder => ({
  id: nodeId(level, parts),
  level,
  code,
  name,
  metrics: emptyMetrics(),
  children: new Map<string, NodeBuilder>(),
});

const ensureChild = (
  parent: NodeBuilder,
  level: SalesMapLevel,
  code: string | undefined,
  name: string,
  parts: string[],
) => {
  const id = nodeId(level, parts);
  const existing = parent.children.get(id);
  if (existing) return existing;
  const child = createNode(level, code, name, parts);
  parent.children.set(id, child);
  return child;
};

const addMetrics = (
  nodes: NodeBuilder[],
  metric: {
    revenue: number;
    volumeKg: number;
    cost: number;
    hasCost: boolean;
  },
  orderId: string,
  customerId: string,
) => {
  for (const node of nodes) {
    node.metrics.revenue += metric.revenue;
    node.metrics.volumeKg += metric.volumeKg;
    node.metrics.cost += metric.cost;
    if (!metric.hasCost) node.metrics.unknownCostRevenue += metric.revenue;
    node.metrics.orderIds.add(orderId);
    node.metrics.customerIds.add(customerId);
  }
};

const buildTree = (orders: SalesMapOrder[]) => {
  const root = createNode("world", "WORLD", "Mundo", ["WORLD"]);

  for (const order of orders) {
    const country = resolveCountry(order.customer);
    const countryParts = [country.code];
    const countryNode = ensureChild(
      root,
      "country",
      country.code,
      country.name,
      countryParts,
    );
    const geographicNodes = [root, countryNode];
    const geographicParts = [...countryParts];

    if (country.code === "BR") {
      const stateCode = resolveBrazilStateCode(order.customer.state);
      const state = brazilStates[stateCode];
      const regionName = state?.region ?? "Região não informada";
      geographicParts.push(regionName);
      geographicNodes.push(
        ensureChild(
          geographicNodes[geographicNodes.length - 1]!,
          "region",
          normalizedKey(regionName),
          regionName,
          geographicParts,
        ),
      );
      geographicParts.push(stateCode);
      geographicNodes.push(
        ensureChild(
          geographicNodes[geographicNodes.length - 1]!,
          "state",
          stateCode,
          state?.name ?? order.customer.state?.trim() ?? "Estado não informado",
          geographicParts,
        ),
      );
    } else {
      const stateName = order.customer.state?.trim() || "Estado não informado";
      geographicParts.push(normalizedKey(stateName) || "NI");
      geographicNodes.push(
        ensureChild(
          geographicNodes[geographicNodes.length - 1]!,
          "state",
          normalizedKey(stateName) || "NI",
          stateName,
          geographicParts,
        ),
      );
    }

    const cityName = order.customer.city?.trim() || "Cidade não informada";
    geographicParts.push(normalizedKey(cityName) || "NI");
    geographicNodes.push(
      ensureChild(
        geographicNodes[geographicNodes.length - 1]!,
        "city",
        undefined,
        cityName,
        geographicParts,
      ),
    );
    geographicParts.push(order.customer.id);
    const customerNode = ensureChild(
      geographicNodes[geographicNodes.length - 1]!,
      "customer",
      order.customer.id,
      order.customer.name,
      geographicParts,
    );
    geographicNodes.push(customerNode);

    const orderRevenue = Math.max(0, toNumber(order.totalAmount));
    const sourceLines = order.items.length
      ? order.items.map((item) => ({
          productId: item.productVariant.product?.id ?? item.productVariantId,
          productName: item.productVariant.product?.name ?? item.productName,
          quantity: item.quantity,
          lineAmount: Math.max(0, toNumber(item.totalAmount)),
          netWeightGrams: item.productVariant.netWeightGrams,
          unitCost: Math.max(0, toNumber(item.productVariant.unitCost)),
        }))
      : [
          {
            productId: order.finishedProduct?.id ?? "produto-nao-informado",
            productName: order.finishedProduct?.name ?? "Produto não informado",
            quantity: order.quantity,
            lineAmount: orderRevenue,
            netWeightGrams: order.finishedProduct?.packageWeightG ?? 0,
            unitCost: 0,
          },
        ];
    const lineTotal = sourceLines.reduce(
      (sum, line) => sum + line.lineAmount,
      0,
    );

    for (const line of sourceLines) {
      const revenue =
        lineTotal > 0
          ? orderRevenue * (line.lineAmount / lineTotal)
          : orderRevenue / sourceLines.length;
      const volumeKg = (line.quantity * line.netWeightGrams) / 1000;
      const hasCost = line.unitCost > 0;
      const productParts = [...geographicParts, line.productId];
      const productNode = ensureChild(
        customerNode,
        "product",
        line.productId,
        line.productName,
        productParts,
      );
      const orderNode = ensureChild(
        productNode,
        "order",
        order.code,
        order.code,
        [...productParts, order.id],
      );
      addMetrics(
        [...geographicNodes, productNode, orderNode],
        {
          revenue,
          volumeKg,
          cost: line.quantity * line.unitCost,
          hasCost,
        },
        order.id,
        order.customer.id,
      );
    }
  }

  return root;
};

const collectRevenue = (
  node: NodeBuilder,
  result = new Map<string, number>(),
) => {
  result.set(node.id, node.metrics.revenue);
  for (const child of node.children.values()) collectRevenue(child, result);
  return result;
};

const finalizeNode = (
  node: NodeBuilder,
  previousRevenue: Map<string, number>,
  parentRevenue?: number,
): SalesMapNode => {
  const revenue = node.metrics.revenue;
  const previous = previousRevenue.get(node.id) ?? 0;
  const hasPreviousPeriod = previous > 0;
  const hasMargin =
    revenue > 0 &&
    node.metrics.unknownCostRevenue <= Math.max(0.01, revenue * 0.00001);
  const children = [...node.children.values()]
    .sort(
      (left, right) =>
        right.metrics.revenue - left.metrics.revenue ||
        left.name.localeCompare(right.name, "pt-BR"),
    )
    .map((child) => finalizeNode(child, previousRevenue, revenue));
  return {
    id: node.id,
    level: node.level,
    code: node.code,
    name: node.name,
    revenue,
    volumeKg: node.metrics.volumeKg,
    marginPercent: hasMargin
      ? ((revenue - node.metrics.cost) / revenue) * 100
      : 0,
    growthPercent: hasPreviousPeriod
      ? ((revenue - previous) / previous) * 100
      : 0,
    target: 0,
    attainment: 0,
    salesShare: parentRevenue
      ? (revenue / parentRevenue) * 100
      : revenue
        ? 100
        : 0,
    status: revenue > 0 ? "on-track" : "attention",
    orderCount: node.metrics.orderIds.size,
    customerCount: node.metrics.customerIds.size,
    hasMargin,
    hasTarget: false,
    hasPreviousPeriod,
    ...(children.length ? { children } : {}),
  };
};

export const buildSalesMap = (
  currentOrders: SalesMapOrder[],
  previousOrders: SalesMapOrder[],
): SalesMapNode => {
  const current = buildTree(currentOrders);
  const previous = collectRevenue(buildTree(previousOrders));
  return finalizeNode(current, previous);
};

const shiftMonth = (date: Date, months: number) => {
  const shifted = new Date(date);
  const day = shifted.getDate();
  shifted.setDate(1);
  shifted.setMonth(shifted.getMonth() + months);
  const lastDay = new Date(
    shifted.getFullYear(),
    shifted.getMonth() + 1,
    0,
  ).getDate();
  shifted.setDate(Math.min(day, lastDay));
  return shifted;
};

const shiftYear = (date: Date, years: number) => {
  const shifted = new Date(date);
  const month = shifted.getMonth();
  shifted.setFullYear(shifted.getFullYear() + years, month, 1);
  const lastDay = new Date(shifted.getFullYear(), month + 1, 0).getDate();
  shifted.setDate(Math.min(date.getDate(), lastDay));
  return shifted;
};

export const previousPeriodWindow = (
  period: Period,
  currentStart: Date,
  currentEnd: Date,
) => {
  if (period === "month") {
    return {
      start: shiftMonth(currentStart, -1),
      end: shiftMonth(currentEnd, -1),
    };
  }
  if (period === "year") {
    return {
      start: shiftYear(currentStart, -1),
      end: shiftYear(currentEnd, -1),
    };
  }
  const days = period === "week" ? 7 : 1;
  const start = new Date(currentStart);
  const end = new Date(currentEnd);
  start.setDate(start.getDate() - days);
  end.setDate(end.getDate() - days);
  return { start, end };
};
