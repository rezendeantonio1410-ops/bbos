import { BadRequestException, Body, Controller, Get, Header, Put, Query, Req, UnauthorizedException } from "@nestjs/common";
import { prisma } from "@bbos/database";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { customerInsights, marginBreakdown, type CoffeeCost } from "./business-intelligence";
import { loadCostContext, loadCustomerOrders, loadSaleItems, NOT_INTERNAL, type DatedSaleItemRow } from "./bi-data";
import {
  abcCurve,
  buildActions,
  cityKey,
  cityLabel,
  forecast,
  greenCoverage,
  marginWhatIf,
  productMatrix,
  profitBridge,
  resultTree,
  swot,
  threeSentences,
  windowMetrics,
} from "./bi-reading";

const DAY = 86_400_000;
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ACTION_STATUSES = ["TODO", "DOING", "DONE", "DISMISSED"] as const;

function monthKey(date: Date) {
  const local = new Date(date.getTime() - 3 * 3_600_000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

function nextMonthKey(date: Date) {
  const local = new Date(date.getTime() - 3 * 3_600_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  return m === 11 ? `${y + 1}-01` : `${y}-${String(m + 2).padStart(2, "0")}`;
}

function windowOf(items: DatedSaleItemRow[], firstAt: Map<string, number>, from: Date, to: Date, costs: Map<string, CoffeeCost>, packagingPerUnit: number) {
  const inside = items.filter((i) => {
    const t = new Date(i.orderedAt).getTime();
    return t >= from.getTime() && t < to.getTime();
  });
  const margin = marginBreakdown(inside, costs, packagingPerUnit);
  const orders = new Map<string, { customerId: string; revenue: number }>();
  for (const i of inside) {
    const o = orders.get(i.orderId) ?? { customerId: i.customerId, revenue: 0 };
    o.revenue += i.revenue;
    orders.set(i.orderId, o);
  }
  const clients = new Set([...orders.values()].map((o) => o.customerId));
  const isNew = (id: string) => {
    const first = firstAt.get(id);
    return first !== undefined && first >= from.getTime() && first < to.getTime();
  };
  const newClients = [...clients].filter(isNew);
  const newClientsRevenue = [...orders.values()].filter((o) => isNew(o.customerId)).reduce((s, o) => s + o.revenue, 0);
  const costedRevenue = inside.filter((i) => i.coffeeId && costs.get(i.coffeeId)?.costPerRoastedKg && i.kg > 0).reduce((s, i) => s + i.revenue, 0);
  return {
    margin,
    window: {
      revenue: inside.reduce((s, i) => s + i.revenue, 0),
      orders: orders.size,
      clients: clients.size,
      newClients: newClients.length,
      newClientsRevenue,
      kg: inside.reduce((s, i) => s + i.kg, 0),
      units: inside.reduce((s, i) => s + i.units, 0),
      cost: margin.total.cost,
      costedRevenue,
    },
  };
}

/**
 * Leitura (BI) e painéis de Vendas, Caixa e Operação. Só leitura, exceto o
 * status das ações do plano. Compara os últimos 30 dias com os 30 anteriores.
 */
@Controller("bi")
export class BiReadingController {
  private readonly database = prisma;

  constructor(private readonly auth: AuthService) {}

  private async actor(req: Request) {
    const actor = await this.auth.resolve(this.auth.readToken(req));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  @Get("reading")
  @Header("Cache-Control", "private, no-store")
  async reading(@Req() req: Request) {
    const { companyId } = await this.actor(req);
    const db = this.database;
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * DAY);
    const d60 = new Date(now.getTime() - 60 * DAY);
    const d90 = new Date(now.getTime() - 90 * DAY);
    const yearAgo = new Date(now.getTime() - 365 * DAY);
    const tomorrow = new Date(now.getTime() + DAY);
    const [items60, items90, orders365, ctx, firstRows, mpRows, roastRows, greenRows, arRows, payerRows, deliveryRows, cityRows, weekdayRows, goalRows, statusRows] = await Promise.all([
      loadSaleItems(db, companyId, d60, tomorrow),
      loadSaleItems(db, companyId, d90, tomorrow),
      loadCustomerOrders(db, companyId, yearAgo),
      loadCostContext(db, companyId, yearAgo),
      db.$queryRawUnsafe<Array<{ customerId: string; firstAt: Date }>>(
        `SELECT o."customerId",MIN(o."orderedAt") AS "firstAt" FROM "SalesOrder" o
          WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED' GROUP BY o."customerId"`,
        companyId,
      ),
      db.$queryRawUnsafe<Array<{ cur: number; prev: number; curN: number; prevN: number }>>(
        `SELECT COALESCE(SUM(CASE WHEN at>=$2 THEN amt END),0)::float AS cur,COALESCE(SUM(CASE WHEN at<$2 THEN amt END),0)::float AS prev,
                COUNT(*) FILTER (WHERE at>=$2)::int AS "curN",COUNT(*) FILTER (WHERE at<$2)::int AS "prevN"
           FROM (SELECT COALESCE(moi."orderedAt",moi."firstSeenAt") AS at,COALESCE(moi."grossAmount",0) AS amt
                   FROM "MarketplaceOrderInbox" moi
                  WHERE moi."companyId"=$1 AND moi."salesOrderId" IS NULL
                    AND LOWER(COALESCE(moi."externalStatus",'')) NOT IN ('cancelled','canceled','cancelado')
                    AND COALESCE(moi."orderedAt",moi."firstSeenAt")>=$3) x`,
        companyId, d30, d60,
      ).catch(() => [{ cur: 0, prev: 0, curN: 0, prevN: 0 }]),
      db.$queryRawUnsafe<Array<{ curGreen: number; curRoasted: number; prevGreen: number; prevRoasted: number }>>(
        `SELECT COALESCE(SUM(CASE WHEN b."completedAt">=$2 THEN b."greenInputKg" END),0)::float AS "curGreen",
                COALESCE(SUM(CASE WHEN b."completedAt">=$2 THEN b."roastedOutputKg" END),0)::float AS "curRoasted",
                COALESCE(SUM(CASE WHEN b."completedAt"<$2 THEN b."greenInputKg" END),0)::float AS "prevGreen",
                COALESCE(SUM(CASE WHEN b."completedAt"<$2 THEN b."roastedOutputKg" END),0)::float AS "prevRoasted"
           FROM "ProductionBatch" b WHERE b."companyId"=$1 AND b."completedAt">=$3`,
        companyId, d30, d60,
      ),
      db.$queryRawUnsafe<Array<{ available: number; costPerKg: number | null }>>(
        `SELECT COALESCE(SUM(CASE WHEN status::text='APPROVED' THEN "currentWeightKg"-"reservedWeightKg" END),0)::float AS available,
                (SUM("landedCost") FILTER (WHERE "landedCost">0)/NULLIF(SUM("initialWeightKg") FILTER (WHERE "landedCost">0),0))::float AS "costPerKg"
           FROM "CoffeeLot" WHERE "companyId"=$1`,
        companyId,
      ),
      db.$queryRawUnsafe<Array<{ overdue: number; daysToCash: number | null }>>(
        `SELECT COALESCE((SELECT SUM("openAmount") FROM "AccountsReceivable" WHERE "companyId"=$1 AND "openAmount">0
                   AND status::text IN ('OPEN','OVERDUE','PARTIALLY_PAID') AND "dueDate"<date_trunc('day',NOW())),0)::float AS overdue,
                (SELECT AVG(EXTRACT(EPOCH FROM ("paymentDate"-"issueDate"))/86400) FROM "AccountsReceivable"
                  WHERE "companyId"=$1 AND status::text='PAID' AND "paymentDate">=$2)::float AS "daysToCash"`,
        companyId, new Date(now.getTime() - 180 * DAY),
      ),
      db.$queryRawUnsafe<Array<{ id: string; name: string; days: number; n: number }>>(
        `SELECT c.id,c.name,AVG(EXTRACT(EPOCH FROM (ar."paymentDate"-ar."dueDate"))/86400)::float AS days,COUNT(*)::int AS n
           FROM "AccountsReceivable" ar JOIN "Customer" c ON c.id=ar."customerId"
          WHERE ar."companyId"=$1 AND ar.status::text='PAID' AND ar."paymentDate">=$2
          GROUP BY c.id,c.name HAVING COUNT(*)>=2 ORDER BY 3 DESC LIMIT 1`,
        companyId, new Date(now.getTime() - 180 * DAY),
      ),
      db.$queryRawUnsafe<Array<{ total: number; batched: number }>>(
        `WITH d AS (SELECT "deliveredAt"::date AS day FROM "SalesOrder"
                     WHERE "companyId"=$1 AND "deliveredAt">=$2 AND "orderType"='COMMERCIAL')
         SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE (SELECT COUNT(*) FROM d d2 WHERE d2.day=d.day)>=4)::int AS batched FROM d`,
        companyId, d90,
      ),
      db.$queryRawUnsafe<Array<{ city: string | null; state: string | null; customerId: string; amount: number }>>(
        `SELECT c.city,c.state,o."customerId",SUM(o."totalAmount")::float AS amount
           FROM "SalesOrder" o JOIN "Customer" c ON c.id=o."customerId"
          WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED' AND o."orderedAt">=$2 AND ${NOT_INTERNAL}
          GROUP BY c.city,c.state,o."customerId"`,
        companyId, yearAgo,
      ),
      db.$queryRawUnsafe<Array<{ dow: number; amount: number }>>(
        `SELECT EXTRACT(DOW FROM (o."orderedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::int AS dow,SUM(o."totalAmount")::float AS amount
           FROM "SalesOrder" o WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED' AND o."orderedAt">=$2 AND ${NOT_INTERNAL}
          GROUP BY 1`,
        companyId, d90,
      ),
      db.$queryRawUnsafe<Array<{ salesTarget: number | null }>>(
        `SELECT "salesTarget"::float AS "salesTarget" FROM "CommandCenterGoal" WHERE "companyId"=$1 AND month=$2`,
        companyId, nextMonthKey(now),
      ).catch(() => []),
      db.$queryRawUnsafe<Array<{ actionKey: string; status: string; updatedByName: string | null; updatedAt: Date }>>(
        `SELECT "actionKey",status,"updatedByName","updatedAt" FROM "BiActionStatus" WHERE "companyId"=$1 AND month=$2`,
        companyId, monthKey(now),
      ).catch(() => []),
    ]);

    const firstAt = new Map(firstRows.map((r) => [r.customerId, new Date(r.firstAt).getTime()]));
    const curW = windowOf(items60, firstAt, d30, tomorrow, ctx.costs, ctx.packagingPerUnit);
    const prevW = windowOf(items60, firstAt, d60, d30, ctx.costs, ctx.packagingPerUnit);
    const mp = mpRows[0] ?? { cur: 0, prev: 0, curN: 0, prevN: 0 };
    const roast = roastRows[0] ?? { curGreen: 0, curRoasted: 0, prevGreen: 0, prevRoasted: 0 };
    const cur = windowMetrics({ ...curW.window, marketplaceRevenue: mp.cur, marketplaceOrders: mp.curN, greenInputKg: roast.curGreen, roastedKg: roast.curRoasted });
    const prev = windowMetrics({ ...prevW.window, marketplaceRevenue: mp.prev, marketplaceOrders: mp.prevN, greenInputKg: roast.prevGreen, roastedKg: roast.prevRoasted });

    const greenCostPerKg = greenRows[0]?.costPerKg ?? 0;
    const green = greenCoverage(greenRows[0]?.available ?? 0, roast.curGreen, now);
    const customers = customerInsights(orders365, now);
    const perCustomer = new Map<string, { name: string; total: number; orders: number }>();
    for (const o of orders365) {
      const c = perCustomer.get(o.customerId) ?? { name: o.name, total: 0, orders: 0 };
      c.total += o.amount;
      c.orders += 1;
      perCustomer.set(o.customerId, c);
    }
    const activeIds = new Set(items60.filter((i) => new Date(i.orderedAt).getTime() >= d30.getTime()).map((i) => i.customerId));
    const recurringActive = [...activeIds].filter((id) => (perCustomer.get(id)?.orders ?? 0) >= 2).length;
    const stalled = customers.callList.find((c) => c.segment === "GRANDE_PARADO" || c.segment === "PARADO") ?? customers.callList[0] ?? null;

    const margin90 = marginBreakdown(items90, ctx.costs, ctx.packagingPerUnit);
    const matrix = productMatrix(margin90.byCoffee.filter((c) => c.name !== "Café verde (revenda)"), margin90.total.marginPercent);
    const adjustCoffees = matrix.groups.AJUSTAR_PRECO!.map((c) => c.name);
    const pushCoffees = matrix.groups.EMPURRAR!.map((c) => c.name);
    const bestChannel = [...margin90.byChannel].filter((c) => c.marginPercent !== null && c.revenue > 0).sort((a, b) => (b.marginPercent ?? 0) - (a.marginPercent ?? 0))[0] ?? null;

    const cities = new Map<string, { name: string; revenue: number; clients: Set<string> }>();
    for (const row of cityRows) {
      const key = cityKey(row.city, row.state);
      if (!key) continue;
      const entry = cities.get(key) ?? { name: cityLabel(row.city ?? ""), revenue: 0, clients: new Set<string>() };
      entry.revenue += row.amount;
      entry.clients.add(row.customerId);
      cities.set(key, entry);
    }
    const bestCity = [...cities.values()].filter((c) => c.revenue > 0).sort((a, b) => b.revenue / b.clients.size - a.revenue / a.clients.size)[0];
    const maxDow = Math.max(0, ...weekdayRows.map((w) => w.amount));
    const weekdayAmounts = WEEKDAYS.map((_, dow) => weekdayRows.find((w) => w.dow === dow)?.amount ?? 0);
    const weakDow = maxDow > 0 ? weekdayAmounts.map((amount, dow) => ({ dow, amount })).filter((w) => w.dow >= 1 && w.dow <= 5).sort((a, b) => a.amount - b.amount)[0] : undefined;
    const weakDay = weakDow && weakDow.amount < maxDow * 0.3 ? WEEKDAYS[weakDow.dow]! : null;

    const delivery = deliveryRows[0] ?? { total: 0, batched: 0 };
    const batchConfirmShare = delivery.total >= 5 ? (delivery.batched / delivery.total) * 100 : 0;
    const payer = payerRows[0] && payerRows[0].days >= 5 ? { id: payerRows[0].id, name: payerRows[0].name, days: Math.round(payerRows[0].days * 10) / 10 } : null;
    const materialsRevenue = margin90.byCoffee.reduce((s, c) => s + c.revenue, 0);
    const exactRevenue = margin90.byCoffee.reduce((s, c) => s + (c.marginPercent !== null ? c.revenue * (1 - c.estimatedShare / 100) : 0), 0);
    const exactCostShare = materialsRevenue ? Math.round((exactRevenue / materialsRevenue) * 100) : 0;
    const mpGrowth = mp.prev > 0 ? Math.round(((mp.cur - mp.prev) / mp.prev) * 100) : null;

    const watch: string[] = [];
    if (green.days !== null && green.days < 45) watch.push(`o café verde, que acaba por volta de ${green.runOutAt?.slice(8, 10)}/${green.runOutAt?.slice(5, 7)}`);
    if (cur.pricePerKg && prev.pricePerKg && cur.pricePerKg < prev.pricePerKg * 0.92) watch.push("crescer volume sem perder preço");
    if (customers.concentration.topShare >= 50) watch.push(`a dependência de 3 clientes (${customers.concentration.topShare}% da receita)`);
    if (stalled) watch.push(`${stalled.name}, há ${stalled.daysSince} dias sem comprar`);

    const statusMap = new Map(statusRows.map((s) => [s.actionKey, s]));
    const actions = buildActions({
      cur, prev, green, greenCostPerKg,
      reactivate: stalled ? { id: stalled.id, name: stalled.name, value: stalled.avgTicket, daysSince: stalled.daysSince } : null,
      newClients: cur.newClients, topShare: customers.concentration.topShare, latePayer: payer, batchConfirmShare, pushCoffees, adjustCoffees,
    }).slice(0, 6).map((a) => {
      const s = statusMap.get(a.key);
      return { ...a, status: s?.status ?? "TODO", statusBy: s?.updatedByName ?? null, statusAt: s?.updatedAt ?? null };
    });

    const fc = forecast(cur, recurringActive);
    return {
      generatedAt: now.toISOString(),
      window: { from: d30.toISOString(), previousFrom: d60.toISOString(), days: 30 },
      month: monthKey(now),
      current: cur,
      previous: prev,
      tree: resultTree(cur, prev),
      bridge: profitBridge(cur, prev),
      sentences: threeSentences(cur, prev, watch),
      ahead: {
        forecast: fc,
        green,
        overdue: Math.round(arRows[0]?.overdue ?? 0),
        whatIf: marginWhatIf(cur, greenCostPerKg),
        goal: goalRows[0]?.salesTarget ?? null,
        suggestedGoal: Math.round(fc.likely / 1000) * 1000,
      },
      actions,
      matrix,
      abc: abcCurve([...perCustomer.values()]),
      swot: swot({
        cur, prev, repeatRate: customers.repeatRate,
        bestChannel: bestChannel ? { name: bestChannel.name, marginPercent: bestChannel.marginPercent } : null,
        overdueAmount: arRows[0]?.overdue ?? 0, avgDaysToCash: arRows[0]?.daysToCash != null ? Math.round(arRows[0].daysToCash * 10) / 10 : null,
        topShare: customers.concentration.topShare, topName: customers.concentration.top[0]?.name ?? null, green,
        stalledBig: stalled ? { name: stalled.name, value: stalled.avgTicket } : null, latePayer: payer,
        pushCoffees, bestCity: bestCity ? { name: bestCity.name, revenue: Math.round(bestCity.revenue), clients: bestCity.clients.size } : null,
        marketplaceGrowth: mpGrowth, weakDay, exactCostShare, batchConfirmShare, adjustCoffees,
      }),
      quality: { exactCostShare, batchConfirmShare: Math.round(batchConfirmShare) },
    };
  }

  /** Painéis de Vendas, Caixa e Operação. */
  @Get("panels")
  @Header("Cache-Control", "private, no-store")
  async panels(@Req() req: Request, @Query("days") daysParam?: string) {
    const { companyId } = await this.actor(req);
    const days = [30, 90, 365].includes(Number(daysParam)) ? Number(daysParam) : 90;
    const db = this.database;
    const now = new Date();
    const since = new Date(now.getTime() - days * DAY);
    const sixMonths = new Date(now.getTime() - 185 * DAY);
    const [months, mpMonths, channels, cities, weekdays, sellers, ar, aging, weeks, received, payers, roastMonths, green, green30, lead, onTime, open, finished] = await Promise.all([
      db.$queryRawUnsafe<Array<{ month: string; revenue: number; orders: number; clients: number }>>(
        `SELECT to_char((o."orderedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') AS month,SUM(o."totalAmount")::float AS revenue,
                COUNT(*)::int AS orders,COUNT(DISTINCT o."customerId")::int AS clients
           FROM "SalesOrder" o WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED' AND o."orderedAt">=$2 AND ${NOT_INTERNAL}
          GROUP BY 1 ORDER BY 1`,
        companyId, sixMonths,
      ),
      db.$queryRawUnsafe<Array<{ month: string; revenue: number; orders: number }>>(
        `SELECT to_char((COALESCE(moi."orderedAt",moi."firstSeenAt") AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') AS month,
                SUM(COALESCE(moi."grossAmount",0))::float AS revenue,COUNT(*)::int AS orders
           FROM "MarketplaceOrderInbox" moi WHERE moi."companyId"=$1 AND moi."salesOrderId" IS NULL
            AND LOWER(COALESCE(moi."externalStatus",'')) NOT IN ('cancelled','canceled','cancelado')
            AND COALESCE(moi."orderedAt",moi."firstSeenAt")>=$2 GROUP BY 1 ORDER BY 1`,
        companyId, sixMonths,
      ).catch(() => []),
      db.$queryRawUnsafe<Array<{ name: string; revenue: number; orders: number }>>(
        `SELECT COALESCE(ch.name,'Direto') AS name,SUM(o."totalAmount")::float AS revenue,COUNT(*)::int AS orders
           FROM "SalesOrder" o LEFT JOIN "SalesChannel" ch ON ch.id=o."salesChannelId"
          WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED' AND o."orderedAt">=$2 AND ${NOT_INTERNAL}
          GROUP BY 1
         UNION ALL
         SELECT ch.name,SUM(COALESCE(moi."grossAmount",0))::float,COUNT(*)::int
           FROM "MarketplaceOrderInbox" moi JOIN "SalesChannel" ch ON ch.id=moi."salesChannelId"
          WHERE moi."companyId"=$1 AND moi."salesOrderId" IS NULL
            AND LOWER(COALESCE(moi."externalStatus",'')) NOT IN ('cancelled','canceled','cancelado')
            AND COALESCE(moi."orderedAt",moi."firstSeenAt")>=$2 GROUP BY ch.name`,
        companyId, since,
      ),
      db.$queryRawUnsafe<Array<{ city: string | null; state: string | null; customerId: string; amount: number }>>(
        `SELECT c.city,c.state,o."customerId",SUM(o."totalAmount")::float AS amount
           FROM "SalesOrder" o JOIN "Customer" c ON c.id=o."customerId"
          WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED' AND o."orderedAt">=$2 AND ${NOT_INTERNAL}
          GROUP BY c.city,c.state,o."customerId"`,
        companyId, since,
      ),
      db.$queryRawUnsafe<Array<{ dow: number; amount: number; orders: number }>>(
        `SELECT EXTRACT(DOW FROM (o."orderedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::int AS dow,SUM(o."totalAmount")::float AS amount,COUNT(*)::int AS orders
           FROM "SalesOrder" o WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED' AND o."orderedAt">=$2 AND ${NOT_INTERNAL}
          GROUP BY 1`,
        companyId, since,
      ),
      db.$queryRawUnsafe<Array<{ name: string; revenue: number; orders: number }>>(
        `SELECT COALESCE(sp.name,'Equipe Bispo') AS name,SUM(o."totalAmount")::float AS revenue,COUNT(*)::int AS orders
           FROM "SalesOrder" o LEFT JOIN "StorefrontPartner" sp ON sp.id=o."createdByStorefrontPartnerId"
          WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED' AND o."orderedAt">=$2 AND ${NOT_INTERNAL}
          GROUP BY 1 ORDER BY 2 DESC`,
        companyId, since,
      ),
      db.$queryRawUnsafe<Array<{ open: number; titles: number; overdue: number; daysToCash: number | null; onTimeShare: number | null }>>(
        `SELECT COALESCE(SUM("openAmount") FILTER (WHERE status::text IN ('OPEN','OVERDUE','PARTIALLY_PAID') AND "openAmount">0),0)::float AS open,
                COUNT(*) FILTER (WHERE status::text IN ('OPEN','OVERDUE','PARTIALLY_PAID') AND "openAmount">0)::int AS titles,
                COALESCE(SUM("openAmount") FILTER (WHERE status::text IN ('OPEN','OVERDUE','PARTIALLY_PAID') AND "openAmount">0 AND "dueDate"<date_trunc('day',NOW())),0)::float AS overdue,
                AVG(EXTRACT(EPOCH FROM ("paymentDate"-"issueDate"))/86400) FILTER (WHERE status::text='PAID' AND "paymentDate">=$2)::float AS "daysToCash",
                (100.0*COUNT(*) FILTER (WHERE status::text='PAID' AND "paymentDate">=$2 AND "paymentDate"::date<="dueDate"::date)
                  /NULLIF(COUNT(*) FILTER (WHERE status::text='PAID' AND "paymentDate">=$2),0))::float AS "onTimeShare"
           FROM "AccountsReceivable" WHERE "companyId"=$1`,
        companyId, new Date(now.getTime() - 180 * DAY),
      ),
      db.$queryRawUnsafe<Array<{ bucket: string; amount: number; titles: number }>>(
        `SELECT CASE WHEN "dueDate"::date>=CURRENT_DATE THEN 'a vencer' WHEN CURRENT_DATE-"dueDate"::date<=7 THEN '1 a 7 dias'
                     WHEN CURRENT_DATE-"dueDate"::date<=30 THEN '8 a 30 dias' ELSE 'mais de 30 dias' END AS bucket,
                SUM("openAmount")::float AS amount,COUNT(*)::int AS titles
           FROM "AccountsReceivable" WHERE "companyId"=$1 AND status::text IN ('OPEN','OVERDUE','PARTIALLY_PAID') AND "openAmount">0 GROUP BY 1`,
        companyId,
      ),
      db.$queryRawUnsafe<Array<{ week: string; amount: number; titles: number }>>(
        `SELECT to_char(date_trunc('week',"dueDate"),'YYYY-MM-DD') AS week,SUM("openAmount")::float AS amount,COUNT(*)::int AS titles
           FROM "AccountsReceivable" WHERE "companyId"=$1 AND status::text IN ('OPEN','OVERDUE','PARTIALLY_PAID') AND "openAmount">0
            AND "dueDate">=date_trunc('week',NOW()) AND "dueDate"<date_trunc('week',NOW())+interval '6 weeks' GROUP BY 1 ORDER BY 1`,
        companyId,
      ),
      db.$queryRawUnsafe<Array<{ month: string; amount: number }>>(
        `SELECT to_char(("occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') AS month,SUM(amount)::float AS amount
           FROM "FinancialTransaction" WHERE "companyId"=$1 AND type::text='RECEIPT' AND "occurredAt">=$2 GROUP BY 1 ORDER BY 1`,
        companyId, sixMonths,
      ),
      db.$queryRawUnsafe<Array<{ id: string; name: string; days: number; titles: number; total: number }>>(
        `SELECT c.id,c.name,AVG(EXTRACT(EPOCH FROM (ar."paymentDate"-ar."dueDate"))/86400)::float AS days,COUNT(*)::int AS titles,SUM(ar.amount)::float AS total
           FROM "AccountsReceivable" ar JOIN "Customer" c ON c.id=ar."customerId"
          WHERE ar."companyId"=$1 AND ar.status::text='PAID' AND ar."paymentDate">=$2
          GROUP BY c.id,c.name ORDER BY ABS(AVG(EXTRACT(EPOCH FROM (ar."paymentDate"-ar."dueDate"))/86400)) DESC LIMIT 8`,
        companyId, new Date(now.getTime() - 180 * DAY),
      ),
      db.$queryRawUnsafe<Array<{ month: string; batches: number; green: number; roasted: number }>>(
        `SELECT to_char((b."completedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') AS month,COUNT(*)::int AS batches,
                SUM(b."greenInputKg")::float AS green,SUM(b."roastedOutputKg")::float AS roasted
           FROM "ProductionBatch" b WHERE b."companyId"=$1 AND b."completedAt">=$2 GROUP BY 1 ORDER BY 1`,
        companyId, sixMonths,
      ),
      db.$queryRawUnsafe<Array<{ available: number; lots: number }>>(
        `SELECT COALESCE(SUM("currentWeightKg"-"reservedWeightKg"),0)::float AS available,COUNT(*)::int AS lots
           FROM "CoffeeLot" WHERE "companyId"=$1 AND status::text='APPROVED' AND "currentWeightKg">0`,
        companyId,
      ),
      db.$queryRawUnsafe<Array<{ green: number }>>(
        `SELECT COALESCE(SUM("greenInputKg"),0)::float AS green FROM "ProductionBatch" WHERE "companyId"=$1 AND "completedAt">=$2`,
        companyId, new Date(now.getTime() - 30 * DAY),
      ),
      db.$queryRawUnsafe<Array<{ median: number | null; n: number }>>(
        `SELECT (percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("deliveredAt"-"orderedAt"))/86400))::float AS median,COUNT(*)::int AS n
           FROM "SalesOrder" WHERE "companyId"=$1 AND "orderType"='COMMERCIAL' AND "deliveredAt">=$2`,
        companyId, since,
      ),
      db.$queryRawUnsafe<Array<{ total: number; onTime: number; batched: number }>>(
        `WITH d AS (SELECT "deliveredAt","expectedDeliveryDate" FROM "SalesOrder"
                     WHERE "companyId"=$1 AND "orderType"='COMMERCIAL' AND "deliveredAt">=$2 AND "expectedDeliveryDate" IS NOT NULL)
         SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE "deliveredAt"::date<="expectedDeliveryDate"::date)::int AS "onTime",
                COUNT(*) FILTER (WHERE (SELECT COUNT(*) FROM d d2 WHERE d2."deliveredAt"::date=d."deliveredAt"::date)>=4)::int AS batched FROM d`,
        companyId, since,
      ),
      db.$queryRawUnsafe<Array<{ status: string; orders: number; late: number }>>(
        `SELECT status::text AS status,COUNT(*)::int AS orders,COUNT(*) FILTER (WHERE "expectedDeliveryDate"::date<CURRENT_DATE)::int AS late
           FROM "SalesOrder" WHERE "companyId"=$1 AND "orderType"='COMMERCIAL'
            AND status::text IN ('CONFIRMED','RESERVED','IN_PRODUCTION','PICKING','READY_TO_SHIP','INVOICED','SHIPPED') GROUP BY 1`,
        companyId,
      ),
      db.$queryRawUnsafe<Array<{ units: number; reserved: number }>>(
        `SELECT COALESCE(SUM("quantityOnHand"),0)::int AS units,COALESCE(SUM("reservedQuantity"),0)::int AS reserved FROM "FinishedProduct" WHERE "companyId"=$1`,
        companyId,
      ),
    ]);

    const cityMap = new Map<string, { name: string; revenue: number; clients: Set<string> }>();
    for (const row of cities) {
      const key = cityKey(row.city, row.state);
      if (!key) continue;
      const entry = cityMap.get(key) ?? { name: cityLabel(row.city ?? ""), revenue: 0, clients: new Set<string>() };
      entry.revenue += row.amount;
      entry.clients.add(row.customerId);
      cityMap.set(key, entry);
    }
    const monthSet = [...new Set([...months.map((m) => m.month), ...mpMonths.map((m) => m.month)])].sort();
    const greenAvailable = green[0]?.available ?? 0;
    const coverage = greenCoverage(greenAvailable, green30[0]?.green ?? 0, now);
    const statusOrder = ["CONFIRMED", "RESERVED", "IN_PRODUCTION", "PICKING", "READY_TO_SHIP", "INVOICED", "SHIPPED"];
    const ot = onTime[0] ?? { total: 0, onTime: 0, batched: 0 };
    return {
      period: { days, since: since.toISOString() },
      sales: {
        months: monthSet.map((month) => ({
          month,
          direct: Math.round(months.find((m) => m.month === month)?.revenue ?? 0),
          marketplace: Math.round(mpMonths.find((m) => m.month === month)?.revenue ?? 0),
          orders: (months.find((m) => m.month === month)?.orders ?? 0) + (mpMonths.find((m) => m.month === month)?.orders ?? 0),
          clients: months.find((m) => m.month === month)?.clients ?? 0,
        })),
        channels: channels.map((c) => ({ name: c.name, revenue: Math.round(c.revenue), orders: c.orders })).sort((a, b) => b.revenue - a.revenue),
        cities: [...cityMap.values()].map((c) => ({ name: c.name, revenue: Math.round(c.revenue), clients: c.clients.size })).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
        weekdays: WEEKDAYS.map((label, dow) => ({ label, amount: Math.round(weekdays.find((w) => w.dow === dow)?.amount ?? 0), orders: weekdays.find((w) => w.dow === dow)?.orders ?? 0 })),
        sellers: sellers.map((s) => ({ name: s.name, revenue: Math.round(s.revenue), orders: s.orders })),
      },
      cash: {
        open: Math.round(ar[0]?.open ?? 0),
        titles: ar[0]?.titles ?? 0,
        overdue: Math.round(ar[0]?.overdue ?? 0),
        daysToCash: ar[0]?.daysToCash != null ? Math.round(ar[0].daysToCash * 10) / 10 : null,
        onTimeShare: ar[0]?.onTimeShare != null ? Math.round(ar[0].onTimeShare) : null,
        aging: ["a vencer", "1 a 7 dias", "8 a 30 dias", "mais de 30 dias"].map((bucket) => ({ bucket, amount: Math.round(aging.find((a) => a.bucket === bucket)?.amount ?? 0), titles: aging.find((a) => a.bucket === bucket)?.titles ?? 0 })),
        weeks: Array.from({ length: 6 }, (_, i) => {
          const monday = new Date(now);
          monday.setUTCHours(0, 0, 0, 0);
          monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) + i * 7);
          const key = monday.toISOString().slice(0, 10);
          const found = weeks.find((w) => w.week === key);
          return { week: key, amount: Math.round(found?.amount ?? 0), titles: found?.titles ?? 0 };
        }),
        received: received.map((r) => ({ month: r.month, amount: Math.round(r.amount) })),
        payers: payers.map((p) => ({ id: p.id, name: p.name, days: Math.round(p.days * 10) / 10, titles: p.titles, total: Math.round(p.total) })),
      },
      operations: {
        roasts: roastMonths.map((r) => ({ month: r.month, batches: r.batches, green: Math.round(r.green * 10) / 10, roasted: Math.round(r.roasted * 10) / 10, lossPercent: r.green > 0 ? Math.round((1 - r.roasted / r.green) * 1000) / 10 : null })),
        green: { ...coverage, lots: green[0]?.lots ?? 0, consumed30: Math.round((green30[0]?.green ?? 0) * 10) / 10 },
        leadTimeDays: lead[0]?.median != null ? Math.round(lead[0].median * 10) / 10 : null,
        delivered: lead[0]?.n ?? 0,
        onTime: { total: ot.total, onTime: ot.onTime, batchedShare: ot.total ? Math.round((ot.batched / ot.total) * 100) : 0 },
        open: statusOrder.map((status) => ({ status, orders: open.find((o) => o.status === status)?.orders ?? 0, late: open.find((o) => o.status === status)?.late ?? 0 })).filter((o) => o.orders > 0),
        finished: finished[0] ?? { units: 0, reserved: 0 },
      },
    };
  }

  /** Status de uma ação do plano (a fazer, fazendo, feita, descartada). */
  @Put("actions")
  async setAction(@Req() req: Request, @Body() body: { actionKey?: unknown; status?: unknown; title?: unknown }) {
    const actor = await this.actor(req);
    const actionKey = String(body?.actionKey ?? "").trim();
    const status = String(body?.status ?? "").toUpperCase();
    if (!/^[A-Z_]+(:[A-Za-z0-9_-]+)?$/.test(actionKey) || actionKey.length > 120) throw new BadRequestException("Ação inválida.");
    if (!(ACTION_STATUSES as readonly string[]).includes(status)) throw new BadRequestException("Status inválido.");
    const title = typeof body?.title === "string" ? body.title.slice(0, 200) : null;
    await this.database.$executeRawUnsafe(
      `INSERT INTO "BiActionStatus" ("companyId",month,"actionKey",status,title,"updatedById","updatedByName","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT ("companyId",month,"actionKey") DO UPDATE
         SET status=EXCLUDED.status,title=COALESCE(EXCLUDED.title,"BiActionStatus".title),
             "updatedById"=EXCLUDED."updatedById","updatedByName"=EXCLUDED."updatedByName","updatedAt"=NOW()`,
      actor.companyId, monthKey(new Date()), actionKey, status, title, actor.id, actor.name,
    );
    return { ok: true, actionKey, status };
  }
}
