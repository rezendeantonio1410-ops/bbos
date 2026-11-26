import { productionAvailableWeight } from "./inventory-availability";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { prisma, type Prisma } from "@bbos/database";
import type {
  ExecutiveDashboard,
  IndustrialDashboard,
  Period,
} from "@bbos/shared";
import { buildSalesMap, previousPeriodWindow } from "./sales-map";
import { buildSalesSummary } from "./sales-summary";
import {
  customerPortfolioWhere,
  salesOrderPortfolioWhere,
} from "./sales-portfolio";

const toNumber = (value: unknown) => Number(value ?? 0);
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
const INSTALLED_MONTHLY_CAPACITY_KG = 5580;
const periodCapacityKg = (period: Period) => {
  if (period === "day") return INSTALLED_MONTHLY_CAPACITY_KG / 22;
  if (period === "week") return (INSTALLED_MONTHLY_CAPACITY_KG / 22) * 5;
  if (period === "year") return INSTALLED_MONTHLY_CAPACITY_KG * 12;
  return INSTALLED_MONTHLY_CAPACITY_KG;
};
const periodStart = (period: Period) => {
  const now = new Date();
  const start = new Date(now);
  if (period === "day") start.setHours(0, 0, 0, 0);
  else if (period === "week") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (period === "year") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return start;
};
const salesMapOrderSelect = {
  id: true,
  code: true,
  orderedAt: true,
  totalAmount: true,
  quantity: true,
  customer: {
    select: {
      id: true,
      name: true,
      countryCode: true,
      countryName: true,
      state: true,
      city: true,
    },
  },
  finishedProduct: {
    select: { id: true, name: true, packageWeightG: true },
  },
  items: {
    select: {
      productVariantId: true,
      productName: true,
      quantity: true,
      totalAmount: true,
      productVariant: {
        select: {
          netWeightGrams: true,
          unitCost: true,
          product: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class DashboardService implements OnModuleDestroy {
  private readonly db = prisma;
  async onModuleDestroy() {
    await this.db.$disconnect();
  }

  async home(
    companyId: string,
    excludePlatformOrders = false,
    portfolioPartnerId: string | null = null,
  ) {
    const now = new Date();
    const day = periodStart("day");
    const month = periodStart("month");
    const visibilityRules: Prisma.SalesOrderWhereInput[] = [];
    if (excludePlatformOrders) {
      visibilityRules.push({
        externalOrderId: null,
        importedAt: null,
        OR: [
          { salesChannelId: null },
          {
            salesChannel: {
              is: { type: { not: "ECOMMERCE" }, platformCode: null },
            },
          },
        ],
      });
    }
    if (portfolioPartnerId) {
      visibilityRules.push(salesOrderPortfolioWhere(portfolioPartnerId));
    }
    const orderVisibility: Prisma.SalesOrderWhereInput = visibilityRules.length
      ? { AND: visibilityRules }
      : {};
    const [
      orders,
      salesDay,
      salesMonth,
      production,
      pendingLab,
      lots,
      products,
      roastedStock,
      openPurchases,
      overdueReceivables,
      deliveryExceptions,
    ] = await Promise.all([
      this.db.salesOrder.findMany({
        where: { companyId, ...orderVisibility },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          expectedDeliveryDate: true,
        },
      }),
      this.db.salesOrder.aggregate({
        where: {
          companyId,
          orderType: "COMMERCIAL",
          orderedAt: { gte: day },
          status: { not: "CANCELLED" },
          ...orderVisibility,
        },
        _sum: { totalAmount: true },
      }),
      this.db.salesOrder.aggregate({
        where: {
          companyId,
          orderType: "COMMERCIAL",
          orderedAt: { gte: month },
          status: { not: "CANCELLED" },
          ...orderVisibility,
        },
        _sum: { totalAmount: true },
      }),
      // Roasted this month = roast batches finished this month. Orders in the
      // bulk flow stay "roasted" and never get an output on the order itself.
      Promise.all([
        this.db.productionOrder.aggregate({
          where: { companyId, plannedAt: { gte: month } },
          _sum: { plannedWeightKg: true },
        }),
        this.db.productionBatch.aggregate({
          where: { companyId, completedAt: { gte: month } },
          _sum: { roastedOutputKg: true },
        }),
      ]).then(([orders, batches]) => ({
        _sum: {
          plannedWeightKg: orders._sum.plannedWeightKg,
          actualOutputKg: batches._sum.roastedOutputKg,
        },
      })),
      this.db.greenCoffeeLabSample.count({
        where: { receipt: { companyId }, status: "PENDING" },
      }),
      this.db.coffeeLot.findMany({
        where: { companyId },
        select: {
          id: true,
          code: true,
          origin: true,
          variety: true,
          currentWeightKg: true,
          reservedWeightKg: true,
          status: true,
        },
      }),
      this.db.finishedProduct.aggregate({
        where: { companyId },
        _sum: { quantityOnHand: true, reservedQuantity: true },
      }),
      this.db
        .$queryRawUnsafe<
          Array<{
            physicalKg: number;
            reservedKg: number;
            availableKg: number;
          }>
        >(
          `SELECT COALESCE(SUM("availableKg"),0)::float AS "physicalKg",
                  COALESCE(SUM("reservedKg"),0)::float AS "reservedKg",
                  COALESCE(SUM(GREATEST("availableKg"-"reservedKg",0)),0)::float AS "availableKg"
             FROM "RoastedWipLot"
            WHERE "companyId"=$1`,
          companyId,
        )
        .catch(() => [{ physicalKg: 0, reservedKg: 0, availableKg: 0 }]),
      this.db.greenCoffeePurchase.count({
        where: {
          companyId,
          approvalStatus: "APPROVED",
          externalAcceptanceStatus: "ACCEPTED",
          operationalStatus: "AWAITING_DELIVERY",
        },
      }),
      this.db.accountsReceivable.aggregate({
        where: {
          companyId,
          ...(portfolioPartnerId
            ? { customer: customerPortfolioWhere(portfolioPartnerId) }
            : {}),
          status: { notIn: ["PAID", "CANCELLED"] },
          dueDate: { lt: now },
          openAmount: { gt: 0 },
        },
        _sum: { openAmount: true },
        _count: { _all: true },
      }),
      this.db.$queryRawUnsafe<
        Array<{
          orderNumber: string | null;
          customerName: string | null;
          title: string | null;
          detail: string | null;
        }>
      >(
        `WITH effective_shipments AS (
           SELECT DISTINCT ON (shipment."salesOrderId") shipment.*
             FROM "Shipment" shipment
             LEFT JOIN LATERAL (
               SELECT "replacementShipmentId"
                 FROM "SalesOrderReexpedition"
                WHERE "salesOrderId"=shipment."salesOrderId"
                ORDER BY "attemptNumber" DESC LIMIT 1
             ) reexpedition ON TRUE
            WHERE shipment."companyId"=$1
            ORDER BY shipment."salesOrderId",
                     CASE WHEN shipment.id=reexpedition."replacementShipmentId" THEN 0 ELSE 1 END,
                     shipment."createdAt" DESC,shipment."updatedAt" DESC
         )
         SELECT COALESCE(so."orderNumber",so.code) AS "orderNumber",
                customer.name AS "customerName",
                event.title,
                event.detail
           FROM effective_shipments shipment
           LEFT JOIN "SalesOrder" so ON so.id=shipment."salesOrderId"
           LEFT JOIN "Customer" customer ON customer.id=so."customerId"
           LEFT JOIN LATERAL (
             SELECT title,detail
               FROM "SalesOrderCustomerEvent"
              WHERE "salesOrderId"=so.id AND source='CARRIER'
              ORDER BY "occurredAt" DESC LIMIT 1
           ) event ON TRUE
          WHERE shipment.status='EXCEPTION'
            AND so.status NOT IN ('DELIVERED','CANCELLED')
            AND NOT EXISTS (
              SELECT 1
                FROM "Shipment" resolved
               WHERE resolved."companyId"=shipment."companyId"
                 AND resolved."salesOrderId"=shipment."salesOrderId"
                 AND resolved.status='DELIVERED'
                 AND resolved."updatedAt">=shipment."updatedAt"
            )
            AND (
              $2::boolean = FALSE
              OR (
                so."externalOrderId" IS NULL
                AND so."importedAt" IS NULL
                AND (
                  so."salesChannelId" IS NULL
                  OR EXISTS (
                    SELECT 1
                      FROM "SalesChannel" channel
                     WHERE channel.id=so."salesChannelId"
                       AND channel.type <> 'ECOMMERCE'
                       AND channel."platformCode" IS NULL
                  )
                )
              )
            )
            AND (
              $3::text IS NULL
              OR so."createdByStorefrontPartnerId"=$3
              OR EXISTS (
                SELECT 1
                  FROM "StorefrontPartnerCustomer" portfolio
                 WHERE portfolio."partnerId"=$3
                   AND portfolio."customerId"=so."customerId"
              )
            )
          ORDER BY shipment."updatedAt" DESC
          LIMIT 20`,
        companyId,
        excludePlatformOrders,
        portfolioPartnerId,
      ),
    ]);
    const open = orders.filter(
      (o) => !["SHIPPED", "DELIVERED", "CANCELLED"].includes(o.status),
    ).length;
    const overdue = orders.filter(
      (o) =>
        o.expectedDeliveryDate &&
        o.expectedDeliveryDate < now &&
        !["SHIPPED", "DELIVERED", "CANCELLED"].includes(o.status),
    ).length;
    const orderFlow = {
      order: orders.filter((order) =>
        ["DRAFT", "CONFIRMED"].includes(order.status),
      ).length,
      preparation: orders.filter((order) =>
        ["RESERVED", "PICKING", "IN_PRODUCTION"].includes(order.status),
      ).length,
      fiscal: orders.filter((order) => order.status === "READY_TO_SHIP").length,
      shipping: orders.filter((order) =>
        ["INVOICED", "SHIPPED"].includes(order.status),
      ).length,
    };
    // currentWeightKg is already net of reservations (physical = current + reserved).
    const greenAvailableKg = lots.reduce(
      (sum, lot) => sum + productionAvailableWeight(lot.status, toNumber(lot.currentWeightKg)),
      0,
    );
    const finishedAvailableUnits = Math.max(
      0,
      toNumber(products._sum.quantityOnHand) -
        toNumber(products._sum.reservedQuantity),
    );
    const hasConfirmedDemand = orders.some(
      (order) =>
        order.status === "CONFIRMED" || order.status === "IN_PRODUCTION",
    );
    const productionBlocked =
      hasConfirmedDemand &&
      finishedAvailableUnits <= 0 &&
      greenAvailableKg <= 0;
    const alerts = [
      ...(deliveryExceptions.length
        ? [
            {
              tone: "CRÍTICO",
              title: `${deliveryExceptions.length} entrega(s) com problema`,
              impact: deliveryExceptions[0]?.orderNumber
                ? `${deliveryExceptions[0].orderNumber}${deliveryExceptions[0].customerName ? ` · ${deliveryExceptions[0].customerName}` : ""}: ${deliveryExceptions[0].title ?? "a transportadora informou uma ocorrência"}.`
                : "Há remessa com falha, suspensão ou devolução que exige ação.",
              href: "/pedidos",
              action: "Resolver entrega",
            },
          ]
        : []),
      ...(!excludePlatformOrders && productionBlocked
        ? [
            {
              tone: "CRÍTICO",
              title: "Produção bloqueada por falta de matéria-prima",
              impact:
                "Há pedido confirmado sem produto acabado disponível e sem café verde livre para suportar a produção.",
              href: "/recebimento",
              action: "Resolver abastecimento",
            },
          ]
        : []),
      ...(overdue
        ? [
            {
              tone: "CRÍTICO",
              title: `${overdue} pedido(s) atrasado(s)`,
              impact:
                "Existem pedidos com prazo vencido. Abra a fila já filtrada e registre a expedição, retirada ou entrega.",
              href: "/pedidos?filtro=atrasados",
              action: "Resolver atrasos",
            },
          ]
        : []),
      ...(overdueReceivables._count._all
        ? [
            {
              tone: "CRÍTICO",
              title: `${overdueReceivables._count._all} recebimento(s) vencido(s)`,
              impact: `${money(toNumber(overdueReceivables._sum.openAmount))} aguardam regularização financeira.`,
              href: excludePlatformOrders ? "/clientes" : "/financeiro/receber",
              action: excludePlatformOrders
                ? "Revisar clientes"
                : "Revisar recebimentos",
            },
          ]
        : []),
      ...(!excludePlatformOrders && pendingLab
        ? [
            {
              tone: "ATENÇÃO",
              title: `${pendingLab} lote(s) aguardam análise`,
              impact: "O laboratório precisa concluir a análise.",
              href: "/recebimento",
              action: "Ver recebimento",
            },
          ]
        : []),
    ];
    return {
      salesToday: toNumber(salesDay._sum.totalAmount),
      salesMonth: toNumber(salesMonth._sum.totalAmount),
      openOrders: open,
      overdueOrders: overdue,
      orderFlow,
      productionActualKg: excludePlatformOrders
        ? 0
        : toNumber(production._sum.actualOutputKg),
      productionPlannedKg: excludePlatformOrders
        ? 0
        : toNumber(production._sum.plannedWeightKg),
      pendingLab: excludePlatformOrders ? 0 : pendingLab,
      openPurchases: excludePlatformOrders ? 0 : openPurchases,
      // Green coffee bought and approved, not yet received (SAP "in transit").
      greenInboundKg: excludePlatformOrders
        ? 0
        : await this.db.greenCoffeePurchase
            .aggregate({
              where: { companyId, approvalStatus: "APPROVED", operationalStatus: "AWAITING_DELIVERY" },
              _sum: { contractedWeightKg: true },
            })
            .then((row) => toNumber(row._sum.contractedWeightKg))
            .catch(() => 0),
      finishedGoodsUnits: portfolioPartnerId
        ? 0
        : toNumber(products._sum.quantityOnHand),
      finishedGoodsReserved: portfolioPartnerId
        ? 0
        : toNumber(products._sum.reservedQuantity),
      roastedStock: excludePlatformOrders
        ? { physicalKg: 0, reservedKg: 0, availableKg: 0 }
        : {
            physicalKg: toNumber(roastedStock[0]?.physicalKg),
            reservedKg: toNumber(roastedStock[0]?.reservedKg),
            availableKg: toNumber(roastedStock[0]?.availableKg),
          },
      greenLots: excludePlatformOrders
        ? []
        : lots.map((lot) => ({
            origin: lot.origin,
            code: lot.code,
            variety: lot.variety ?? "—",
            currentKg: toNumber(lot.currentWeightKg),
            reservedKg: toNumber(lot.reservedWeightKg),
            status: lot.status,
          })),
      alerts,
    };
  }

  async industrial(
    companyId: string,
    period: Period,
  ): Promise<IndustrialDashboard> {
    const start = periodStart(period);
    const [orders, batches, lots, pendingLab, products] = await Promise.all([
      this.db.productionOrder.findMany({
        where: { companyId, plannedAt: { gte: start } },
        orderBy: { plannedAt: "desc" },
        take: 100,
      }),
      this.db.productionBatch.findMany({
        where: { companyId, completedAt: { gte: start } },
        orderBy: { completedAt: "desc" },
        take: 100,
      }),
      this.db.coffeeLot.findMany({
        where: { companyId },
        orderBy: { receivedAt: "desc" },
        take: 100,
      }),
      this.db.greenCoffeeLabSample.count({
        where: { receipt: { companyId }, status: "PENDING" },
      }),
      this.db.finishedProduct.aggregate({
        where: { companyId },
        _sum: { quantityOnHand: true },
      }),
    ]);
    const availableLots = lots.filter((lot) =>
      ["RECEIVED", "QUALITY_REVIEW", "APPROVED"].includes(lot.status),
    );
    // currentWeightKg is already net of reservations (physical = current + reserved).
    const greenAvailableKg = availableLots.reduce(
      (sum, lot) => sum + Math.max(0, toNumber(lot.currentWeightKg)),
      0,
    );
    const greenReservedKg = availableLots.reduce(
      (sum, lot) => sum + toNumber(lot.reservedWeightKg),
      0,
    );
    const greenStockValue = availableLots.reduce(
      (sum, lot) => sum + toNumber(lot.landedCost),
      0,
    );
    const planned = orders.reduce(
      (sum, o) => sum + toNumber(o.plannedWeightKg),
      0,
    );
    const actual = orders.reduce(
      (sum, o) => sum + toNumber(o.actualOutputKg),
      0,
    );
    const installedCapacity = periodCapacityKg(period);
    const green = batches.reduce((sum, b) => sum + toNumber(b.greenInputKg), 0);
    const roasted = batches.reduce(
      (sum, b) => sum + toNumber(b.roastedOutputKg),
      0,
    );
    const loss = green ? ((green - roasted) / green) * 100 : 0;
    const completed = orders.filter((o) => o.status === "COMPLETED").length;
    const inProgress = orders.filter((o) =>
      ["IN_PROGRESS", "ROASTED", "PACKAGING"].includes(o.status),
    ).length;
    const status = (
      value: number,
      target: number,
    ): "on-track" | "attention" | "off-track" =>
      target === 0
        ? "attention"
        : value >= target
          ? "on-track"
          : value >= target * 0.8
            ? "attention"
            : "off-track";
    return {
      updatedAt: new Date().toISOString(),
      inventory: {
        greenAvailableKg,
        greenReservedKg,
        greenStockValue,
        finishedGoodsUnits: toNumber(products._sum.quantityOnHand),
      },
      metrics: [
        {
          id: "efficiency",
          label: "Eficiência da produção",
          value: planned
            ? `${((actual / planned) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
            : "Sem dados",
          supportingText: planned
            ? "realizado / planejado"
            : "sem produção planejada",
          status: status(actual, planned),
          change: undefined,
        },
        {
          id: "yield",
          label: "Rendimento industrial",
          value: green
            ? `${((roasted / green) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
            : "Sem dados",
          supportingText: green
            ? "saída torrada / entrada verde"
            : "sem lotes processados",
          status: green ? "on-track" : "attention",
        },
        {
          id: "losses",
          label: "Perdas de produção",
          value: green
            ? `${loss.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
            : "Sem dados",
          supportingText: green
            ? "perdas calculadas nos lotes"
            : "sem lotes processados",
          status: loss <= 3 ? "on-track" : "attention",
        },
        {
          id: "green-consumed",
          label: "Café verde consumido",
          value: `${green.toLocaleString("pt-BR")} kg`,
          supportingText: "período selecionado",
          status: "on-track",
        },
        {
          id: "roasted-produced",
          label: "Café torrado produzido",
          value: `${roasted.toLocaleString("pt-BR")} kg`,
          supportingText: "período selecionado",
          status: "on-track",
        },
        {
          id: "packed-produced",
          label: "Café embalado produzido",
          value: `${toNumber(products._sum.quantityOnHand).toLocaleString("pt-BR")} un. em estoque`,
          supportingText: "saldo atual",
          status: "on-track",
        },
        {
          id: "average-cost",
          label: "Custo médio produzido",
          value: "Sem dados",
          supportingText: "custos industriais ainda não vinculados",
          status: "attention",
        },
      ],
      goals: [
        {
          period,
          targetKg: planned,
          actualKg: actual,
          attainment: planned ? (actual / planned) * 100 : 0,
          differenceKg: actual - planned,
          status: status(actual, planned),
        },
      ],
      capacity: {
        usedKg: actual,
        totalKg: installedCapacity,
        utilization: installedCapacity ? (actual / installedCapacity) * 100 : 0,
        status: actual <= installedCapacity ? "on-track" : "off-track",
      },
      orders: { open: orders.length - completed, inProgress, completed },
      productionChart: orders
        .slice(0, 12)
        .reverse()
        .map((o) => ({
          label: o.plannedAt.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
          }),
          plannedKg: toNumber(o.plannedWeightKg),
          actualKg: toNumber(o.actualOutputKg),
        })),
      history: orders.slice(0, 20).map((o) => ({
        id: o.id,
        code: o.code,
        blend: o.productName,
        plannedKg: toNumber(o.plannedWeightKg),
        producedKg: toNumber(o.actualOutputKg),
        yieldPercent: o.actualInputKg
          ? (toNumber(o.actualOutputKg) / toNumber(o.actualInputKg)) * 100
          : 0,
        costPerKg: 0,
        status:
          o.status === "COMPLETED"
            ? "completed"
            : o.status === "IN_PROGRESS"
              ? "in-progress"
              : "open",
        completedAt: o.completedAt?.toLocaleString("pt-BR"),
      })),
      numbers: {
        plannedKg: planned,
        actualKg: actual,
        greenInputKg: green,
        roastedOutputKg: roasted,
        lossPercent: green ? Math.round(loss * 10) / 10 : null,
        yieldPercent: green ? Math.round((roasted / green) * 1000) / 10 : null,
      },
      weekly: (() => {
        // Planned × actual grouped by week of the planned date (oldest first).
        const weeks = new Map<string, { label: string; plannedKg: number; actualKg: number; at: number }>();
        for (const o of orders) {
          const monday = new Date(o.plannedAt);
          monday.setHours(0, 0, 0, 0);
          monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
          const key = monday.toISOString().slice(0, 10);
          const week = weeks.get(key) ?? {
            label: monday.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
            plannedKg: 0,
            actualKg: 0,
            at: monday.getTime(),
          };
          week.plannedKg += toNumber(o.plannedWeightKg);
          week.actualKg += toNumber(o.actualOutputKg);
          weeks.set(key, week);
        }
        return [...weeks.values()]
          .sort((a, b) => a.at - b.at)
          .slice(-8)
          .map((week) => ({ label: week.label, plannedKg: week.plannedKg, actualKg: week.actualKg }));
      })(),
      batchLosses: batches
        .filter((b) => toNumber(b.greenInputKg) > 0)
        .slice(0, 20)
        .map((b) => ({
          id: b.id,
          code: b.code,
          completedAt: b.completedAt.toISOString(),
          lossPercent:
            Math.round(((toNumber(b.greenInputKg) - toNumber(b.roastedOutputKg)) / toNumber(b.greenInputKg)) * 1000) / 10,
        }))
        .reverse(),
      alerts: pendingLab
        ? [
            {
              id: "lab-pending",
              category: "raw-material",
              item: `${pendingLab} lote(s)`,
              currentStock: "—",
              coverage: "—",
              message: "Lotes aguardam análise laboratorial.",
              status: "attention",
            },
          ]
        : [],
    };
  }

  async executive(
    companyId: string,
    period: Period,
  ): Promise<ExecutiveDashboard> {
    const start = periodStart(period);
    const now = new Date();
    const previousWindow = previousPeriodWindow(period, start, now);
    const [
      salesOrders,
      previousSalesOrders,
      green,
      finished,
      purchases,
      receivables,
      overdueReceivables,
      payables,
    ] = await Promise.all([
      this.db.salesOrder.findMany({
        where: {
          companyId,
          orderType: "COMMERCIAL",
          orderedAt: { gte: start },
          status: { not: "CANCELLED" },
        },
        select: salesMapOrderSelect,
      }),
      this.db.salesOrder.findMany({
        where: {
          companyId,
          orderType: "COMMERCIAL",
          orderedAt: { gte: previousWindow.start, lt: previousWindow.end },
          status: { not: "CANCELLED" },
        },
        select: salesMapOrderSelect,
      }),
      this.db.coffeeLot.aggregate({
        where: {
          companyId,
          status: { in: ["RECEIVED", "APPROVED", "QUALITY_REVIEW"] },
        },
        _sum: { currentWeightKg: true, landedCost: true },
      }),
      this.db.finishedProduct.aggregate({
        where: { companyId },
        _sum: { quantityOnHand: true },
      }),
      this.db.greenCoffeePurchase.aggregate({
        where: { companyId, approvalStatus: "APPROVED" },
        _sum: { totalValue: true },
      }),
      this.db.accountsReceivable.aggregate({
        where: {
          companyId,
          status: { notIn: ["PAID", "CANCELLED"] },
          openAmount: { gt: 0 },
        },
        _sum: { openAmount: true },
      }),
      this.db.accountsReceivable.aggregate({
        where: {
          companyId,
          status: { notIn: ["PAID", "CANCELLED"] },
          dueDate: { lt: now },
          openAmount: { gt: 0 },
        },
        _sum: { openAmount: true },
        _count: { _all: true },
      }),
      this.db.accountsPayable.aggregate({
        where: {
          companyId,
          status: { notIn: ["PAID", "CANCELLED"] },
          openAmount: { gt: 0 },
        },
        _sum: { openAmount: true },
      }),
    ]);
    void finished;
    const revenue = salesOrders.reduce(
      (sum, order) => sum + toNumber(order.totalAmount),
      0,
    );
    const openReceivables = toNumber(receivables._sum.openAmount);
    const openPayables = toNumber(payables._sum.openAmount);
    const overdueAmount = toNumber(overdueReceivables._sum.openAmount);
    const salesMap = buildSalesMap(salesOrders, previousSalesOrders);
    const metrics = [
      {
        label: "Receita",
        value: money(revenue),
        change: salesMap.hasPreviousPeriod ? salesMap.growthPercent : 0,
        supportingText: "dados reais do período",
      },
      {
        label: "Lucro operacional",
        value: "Sem dados",
        change: 0,
        supportingText: "custos/margem não disponíveis",
      },
      {
        label: "Margem",
        value: salesMap.hasMargin
          ? `${salesMap.marginPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
          : "Sem dados",
        change: 0,
        supportingText: salesMap.hasMargin
          ? "custos dos itens vendidos"
          : "custos/margem não disponíveis",
      },
      {
        label: "Contas a receber",
        value: money(openReceivables),
        change: 0,
        supportingText:
          overdueAmount > 0
            ? `${money(overdueAmount)} vencidos`
            : "nenhum valor vencido",
      },
      {
        label: "Produção",
        value: "Sem dados",
        change: 0,
        supportingText: "consulte o dashboard industrial",
      },
      {
        label: "Café verde",
        value: `${toNumber(green._sum.currentWeightKg).toLocaleString("pt-BR")} kg`,
        change: 0,
        supportingText: "saldo atual",
      },
      {
        label: "Pedidos",
        value: String(salesOrders.length),
        change: 0,
        supportingText: "pedidos no período",
      },
      {
        label: "Compras aprovadas",
        value: money(toNumber(purchases._sum.totalValue)),
        change: 0,
        supportingText: "compras aprovadas",
      },
    ];
    const byPeriod = {
      day: period === "day" ? metrics : [],
      week: period === "week" ? metrics : [],
      month: period === "month" ? metrics : [],
      year: period === "year" ? metrics : [],
    };
    const alerts = [
      ...(overdueReceivables._count._all
        ? [
            {
              id: "finance-overdue",
              severity: "critical" as const,
              title: `${overdueReceivables._count._all} recebimento(s) vencido(s)`,
              description: `${money(overdueAmount)} aguardam regularização.`,
              area: "Financeiro",
            },
          ]
        : []),
      ...(openPayables > 0
        ? [
            {
              id: "finance-payables",
              severity: "warning" as const,
              title: "Contas a pagar em aberto",
              description: `${money(openPayables)} em compromissos pendentes.`,
              area: "Financeiro",
            },
          ]
        : []),
    ];
    return {
      updatedAt: new Date().toISOString(),
      metricsByPeriod: byPeriod,
      roi: {
        current: 0,
        target: 0,
        difference: 0,
        trend: 0,
        status: "attention",
      },
      goals: [],
      projections: [],
      diagnostics: [],
      salesMap,
      alerts,
      // Raw numbers for the executive panel (the metrics above are display text).
      numbers: {
        openReceivables,
        overdueReceivables: overdueAmount,
        overdueReceivablesCount: overdueReceivables._count._all,
        openPayables,
        greenCoffeeKg: toNumber(green._sum.currentWeightKg),
        finishedUnits: toNumber(finished._sum.quantityOnHand),
        approvedPurchases: toNumber(purchases._sum.totalValue),
      },
      summary: buildSalesSummary(salesOrders, previousSalesOrders, {
        start,
        now,
        previousStart: previousWindow.start,
      }),
    };
  }

  /** Sales by state and city for the sales map, scoped like the home panel. */
  async salesGeography(
    companyId: string,
    period: Period,
    excludePlatformOrders = false,
    portfolioPartnerId: string | null = null,
  ) {
    const start = periodStart(period);
    const now = new Date();
    const previousWindow = previousPeriodWindow(period, start, now);
    const visibility: Prisma.SalesOrderWhereInput[] = [];
    if (excludePlatformOrders) {
      visibility.push({
        externalOrderId: null,
        importedAt: null,
        OR: [
          { salesChannelId: null },
          { salesChannel: { is: { type: { not: "ECOMMERCE" }, platformCode: null } } },
        ],
      });
    }
    if (portfolioPartnerId) visibility.push(salesOrderPortfolioWhere(portfolioPartnerId));
    const base = { companyId, orderType: "COMMERCIAL" as const, status: { not: "CANCELLED" as const }, ...(visibility.length ? { AND: visibility } : {}) };
    const [orders, previous] = await Promise.all([
      this.db.salesOrder.findMany({ where: { ...base, orderedAt: { gte: start } }, select: salesMapOrderSelect }),
      this.db.salesOrder.findMany({
        where: { ...base, orderedAt: { gte: previousWindow.start, lt: previousWindow.end } },
        select: salesMapOrderSelect,
      }),
    ]);
    return buildSalesSummary(orders, previous, { start, now, previousStart: previousWindow.start });
  }
}
