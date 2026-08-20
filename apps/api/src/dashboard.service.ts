import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import type { ExecutiveDashboard, IndustrialDashboard, Period } from "@bbos/shared";

const toNumber = (value: unknown) => Number(value ?? 0);
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
const periodStart = (period: Period) => {
  const now = new Date();
  const start = new Date(now);
  if (period === "day") start.setHours(0, 0, 0, 0);
  else if (period === "week") { start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); }
  else if (period === "year") { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
  else { start.setDate(1); start.setHours(0, 0, 0, 0); }
  return start;
};

@Injectable()
export class DashboardService implements OnModuleDestroy {
  private readonly db = new PrismaClient();
  async onModuleDestroy() { await this.db.$disconnect(); }

  async home(companyId: string) {
    const now = new Date();
    const day = periodStart("day");
    const month = periodStart("month");
    const [orders, salesDay, salesMonth, production, pendingLab, lots, products, openPurchases] = await Promise.all([
      this.db.salesOrder.findMany({ where: { companyId }, select: { id: true, status: true, totalAmount: true, expectedDeliveryDate: true } }),
      this.db.salesOrder.aggregate({ where: { companyId, orderedAt: { gte: day }, status: { not: "CANCELLED" } }, _sum: { totalAmount: true } }),
      this.db.salesOrder.aggregate({ where: { companyId, orderedAt: { gte: month }, status: { not: "CANCELLED" } }, _sum: { totalAmount: true } }),
      this.db.productionOrder.aggregate({ where: { companyId, plannedAt: { gte: month } }, _sum: { actualOutputKg: true, plannedWeightKg: true } }),
      this.db.greenCoffeeLabSample.count({ where: { receipt: { companyId }, status: "PENDING" } }),
      this.db.coffeeLot.findMany({ where: { companyId }, select: { id: true, code: true, origin: true, variety: true, currentWeightKg: true, reservedWeightKg: true, status: true } }),
      this.db.finishedProduct.aggregate({ where: { companyId }, _sum: { quantityOnHand: true, reservedQuantity: true } }),
      this.db.greenCoffeePurchase.count({ where: { companyId, approvalStatus: "APPROVED", externalAcceptanceStatus: "ACCEPTED", operationalStatus: "AWAITING_DELIVERY" } }),
    ]);
    const open = orders.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status)).length;
    const overdue = orders.filter((o) => o.expectedDeliveryDate && o.expectedDeliveryDate < now && !["DELIVERED", "CANCELLED"].includes(o.status)).length;
    const alerts = [
      ...(overdue ? [{ tone: "CRÍTICO", title: `${overdue} pedido(s) atrasado(s)`, impact: "Existem pedidos com prazo vencido.", href: "/pedidos", action: "Ver pedidos" }] : []),
      ...(pendingLab ? [{ tone: "ATENÇÃO", title: `${pendingLab} lote(s) aguardam análise`, impact: "O laboratório precisa concluir a análise.", href: "/recebimento", action: "Ver recebimento" }] : []),
    ];
    return {
      salesToday: toNumber(salesDay._sum.totalAmount), salesMonth: toNumber(salesMonth._sum.totalAmount), openOrders: open, overdueOrders: overdue,
      productionActualKg: toNumber(production._sum.actualOutputKg), productionPlannedKg: toNumber(production._sum.plannedWeightKg), pendingLab, openPurchases,
      finishedGoodsUnits: toNumber(products._sum.quantityOnHand), finishedGoodsReserved: toNumber(products._sum.reservedQuantity),
      greenLots: lots.map((lot) => ({ origin: lot.origin, code: lot.code, variety: lot.variety ?? "—", currentKg: toNumber(lot.currentWeightKg), reservedKg: toNumber(lot.reservedWeightKg), status: lot.status })), alerts,
    };
  }

  async industrial(companyId: string, period: Period): Promise<IndustrialDashboard> {
    const start = periodStart(period);
    const [orders, batches, lots, pendingLab, products] = await Promise.all([
      this.db.productionOrder.findMany({ where: { companyId, plannedAt: { gte: start } }, orderBy: { plannedAt: "desc" }, take: 100 }),
      this.db.productionBatch.findMany({ where: { companyId, completedAt: { gte: start } }, orderBy: { completedAt: "desc" }, take: 100 }),
      this.db.coffeeLot.findMany({ where: { companyId }, orderBy: { receivedAt: "desc" }, take: 100 }),
      this.db.greenCoffeeLabSample.count({ where: { receipt: { companyId }, status: "PENDING" } }),
      this.db.finishedProduct.aggregate({ where: { companyId }, _sum: { quantityOnHand: true } }),
    ]);
    void lots;
    const planned = orders.reduce((sum, o) => sum + toNumber(o.plannedWeightKg), 0);
    const actual = orders.reduce((sum, o) => sum + toNumber(o.actualOutputKg), 0);
    const green = batches.reduce((sum, b) => sum + toNumber(b.greenInputKg), 0);
    const roasted = batches.reduce((sum, b) => sum + toNumber(b.roastedOutputKg), 0);
    const loss = green ? ((green - roasted) / green) * 100 : 0;
    const completed = orders.filter((o) => o.status === "COMPLETED").length;
    const inProgress = orders.filter((o) => ["IN_PROGRESS", "ROASTED", "PACKAGING"].includes(o.status)).length;
    const status = (value: number, target: number): "on-track" | "attention" | "off-track" => target === 0 ? "attention" : value >= target ? "on-track" : value >= target * 0.8 ? "attention" : "off-track";
    return {
      updatedAt: new Date().toISOString(),
      metrics: [
        { id: "efficiency", label: "Eficiência da produção", value: planned ? `${((actual / planned) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "Sem dados", supportingText: planned ? "realizado / planejado" : "sem produção planejada", status: status(actual, planned), change: undefined },
        { id: "yield", label: "Rendimento industrial", value: green ? `${((roasted / green) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "Sem dados", supportingText: green ? "saída torrada / entrada verde" : "sem lotes processados", status: green ? "on-track" : "attention" },
        { id: "losses", label: "Perdas de produção", value: green ? `${loss.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "Sem dados", supportingText: green ? "perdas calculadas nos lotes" : "sem lotes processados", status: loss <= 3 ? "on-track" : "attention" },
        { id: "green-consumed", label: "Café verde consumido", value: `${green.toLocaleString("pt-BR")} kg`, supportingText: "período selecionado", status: "on-track" },
        { id: "roasted-produced", label: "Café torrado produzido", value: `${roasted.toLocaleString("pt-BR")} kg`, supportingText: "período selecionado", status: "on-track" },
        { id: "packed-produced", label: "Café embalado produzido", value: `${toNumber(products._sum.quantityOnHand).toLocaleString("pt-BR")} un. em estoque`, supportingText: "saldo atual", status: "on-track" },
        { id: "average-cost", label: "Custo médio produzido", value: "Sem dados", supportingText: "custos industriais ainda não vinculados", status: "attention" },
      ],
      goals: [{ period, targetKg: planned, actualKg: actual, attainment: planned ? (actual / planned) * 100 : 0, differenceKg: actual - planned, status: status(actual, planned) }],
      capacity: { usedKg: actual, totalKg: planned, utilization: planned ? (actual / planned) * 100 : 0, status: status(actual, planned) },
      orders: { open: orders.length - completed, inProgress, completed },
      productionChart: orders.slice(0, 12).reverse().map((o) => ({ label: o.plannedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }), plannedKg: toNumber(o.plannedWeightKg), actualKg: toNumber(o.actualOutputKg) })),
      history: orders.slice(0, 20).map((o) => ({ id: o.id, code: o.code, blend: o.productName, plannedKg: toNumber(o.plannedWeightKg), producedKg: toNumber(o.actualOutputKg), yieldPercent: o.actualInputKg ? (toNumber(o.actualOutputKg) / toNumber(o.actualInputKg)) * 100 : 0, costPerKg: 0, status: o.status === "COMPLETED" ? "completed" : o.status === "IN_PROGRESS" ? "in-progress" : "open", completedAt: o.completedAt?.toLocaleString("pt-BR") })),
      alerts: pendingLab ? [{ id: "lab-pending", category: "raw-material", item: `${pendingLab} lote(s)`, currentStock: "—", coverage: "—", message: "Lotes aguardam análise laboratorial.", status: "attention" }] : [],
    };
  }

  async executive(companyId: string, period: Period): Promise<ExecutiveDashboard> {
    const start = periodStart(period);
    const [orders, transactions, green, finished, purchases] = await Promise.all([
      this.db.salesOrder.aggregate({ where: { companyId, orderedAt: { gte: start }, status: { not: "CANCELLED" } }, _sum: { totalAmount: true }, _count: { _all: true } }),
      this.db.financialTransaction.aggregate({ where: { companyId, occurredAt: { gte: start } }, _sum: { amount: true } }),
      this.db.coffeeLot.aggregate({ where: { companyId, status: { in: ["RECEIVED", "APPROVED", "QUALITY_REVIEW"] } }, _sum: { currentWeightKg: true, landedCost: true } }),
      this.db.finishedProduct.aggregate({ where: { companyId }, _sum: { quantityOnHand: true } }),
      this.db.greenCoffeePurchase.aggregate({ where: { companyId, approvalStatus: "APPROVED" }, _sum: { totalValue: true } }),
    ]);
    void finished;
    const revenue = toNumber(orders._sum.totalAmount);
    const finance = toNumber(transactions._sum.amount);
    const metrics = [{ label: "Receita", value: money(revenue), change: 0, supportingText: "dados reais do período" }, { label: "Lucro operacional", value: "Sem dados", change: 0, supportingText: "custos/margem não disponíveis" }, { label: "Margem", value: "Sem dados", change: 0, supportingText: "custos/margem não disponíveis" }, { label: "Caixa", value: money(finance), change: 0, supportingText: "movimentações financeiras do período" }, { label: "Produção", value: "Sem dados", change: 0, supportingText: "consulte o dashboard industrial" }, { label: "Café verde", value: `${toNumber(green._sum.currentWeightKg).toLocaleString("pt-BR")} kg`, change: 0, supportingText: "saldo atual" }, { label: "Pedidos", value: String(orders._count._all), change: 0, supportingText: "pedidos no período" }, { label: "Compras aprovadas", value: money(toNumber(purchases._sum.totalValue)), change: 0, supportingText: "compras aprovadas" }];
    const byPeriod = { day: period === "day" ? metrics : [], week: period === "week" ? metrics : [], month: period === "month" ? metrics : [], year: period === "year" ? metrics : [] };
    return { updatedAt: new Date().toISOString(), metricsByPeriod: byPeriod, roi: { current: 0, target: 0, difference: 0, trend: 0, status: "attention" }, goals: [], projections: [], diagnostics: [], salesMap: { id: "company", level: "country", name: "Empresa", revenue, volumeKg: 0, marginPercent: 0, growthPercent: 0, target: 0, attainment: 0, salesShare: 100, status: "attention" }, alerts: [] };
  }
}
