import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Header, Param, Post, Put, Query, Req, UnauthorizedException } from "@nestjs/common";
import { prisma } from "@bbos/database";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { NOT_INTERNAL } from "./bi-data";
import { SALES_GROUPS, dailySalesGroups, groupSales } from "./sales-group";
import {
  itemLabel,
  marketplaceOrderList,
  marketplaceShipState,
  monthMargin,
  orderShipState,
  salesOfTheDay,
  payerDelays,
  repurchaseHealth,
  snoozeUntil,
  validateGoal,
  validateTaskKey,
  type CustomerOrderDates,
  type PaidReceivable,
} from "./command-center-insights";

function badRequest(error: unknown): never {
  throw new BadRequestException(error instanceof Error ? error.message : "Dados inválidos.");
}

/** Mês corrente em São Paulo, como AAAA-MM, e o instante em que começou (UTC). */
function saoPauloMonth(now = new Date()) {
  const local = new Date(now.getTime() - 3 * 3_600_000);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    start: new Date(Date.UTC(year, month, 1, 3, 0, 0)),
    nextKey: `${month === 11 ? year + 1 : year}-${String(month === 11 ? 1 : month + 2).padStart(2, "0")}`,
  };
}

/**
 * Central de comando v6: lucro, meta, vitórias, crescimento, recompra, canais
 * e atraso de pagamento, num só pedido de leitura. Também guarda a meta do mês
 * e as tarefas marcadas como Feito / Amanhã / Adiar 7 dias.
 */
@Controller("command-center")
export class CommandCenterController {
  private readonly database = prisma;

  constructor(private readonly auth: AuthService) {}

  private async actor(req: Request) {
    const actor = await this.auth.resolve(this.auth.readToken(req));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  @Get("insights")
  @Header("Cache-Control", "private, no-store")
  async insights(@Req() req: Request) {
    const { companyId } = await this.actor(req);
    const now = new Date();
    const month = saoPauloMonth(now);
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const yearAgo = new Date(now.getTime() - 365 * 86_400_000);
    const db = this.database;
    const [
      marginRows, goals, deliveredRows, receivedRows, firstOrderRows, prospectRows, visitRows,
      channelRows, topRows, orderHistory, paidRows, snoozes, directRows,
    ] = await Promise.all([
      db.$queryRawUnsafe<any[]>(
        // Custo por unidade: o cadastrado no produto ou o último cálculo de Custos e margens.
        `SELECT COALESCE(SUM(i."totalAmount"),0)::float AS revenue,
                COALESCE(SUM(CASE WHEN unit.cost>0 THEN i."totalAmount" END),0)::float AS "costedRevenue",
                COALESCE(SUM(CASE WHEN unit.cost>0 THEN i.quantity*unit.cost END),0)::float AS cost
           FROM "SalesOrderItem" i
           JOIN "SalesOrder" o ON o.id=i."salesOrderId"
           LEFT JOIN "ProductVariant" v ON v.id=i."productVariantId"
           LEFT JOIN LATERAL (
             SELECT COALESCE(NULLIF(v."unitCost",0),(
               SELECT s."costPerUnit" FROM "CostCalculationSnapshot" s
                WHERE s."productVariantId"=i."productVariantId" AND s."costPerUnit">0
                ORDER BY s."createdAt" DESC LIMIT 1)) AS cost
           ) unit ON TRUE
          WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED' AND o."orderedAt">=$2`,
        companyId, month.start,
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT month,"salesTarget"::float AS "salesTarget","updatedByName","updatedAt"
           FROM "CommandCenterGoal" WHERE "companyId"=$1 AND month IN ($2,$3)`,
        companyId, month.key, month.nextKey,
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int AS count FROM "SalesOrder"
          WHERE "companyId"=$1 AND "deliveredAt">=$2 AND status::text<>'CANCELLED'`,
        companyId, weekAgo,
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(SUM(amount),0)::float AS amount FROM "FinancialTransaction"
          WHERE "companyId"=$1 AND type::text='RECEIPT' AND "occurredAt">=$2`,
        companyId, weekAgo,
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT first."customerId",c.name,first.at
           FROM (SELECT "customerId",MIN("orderedAt") AS at FROM "SalesOrder"
                  WHERE "companyId"=$1 AND "orderType"='COMMERCIAL' AND status::text<>'CANCELLED'
                  GROUP BY "customerId") first
           JOIN "Customer" c ON c.id=first."customerId"
          WHERE first.at>=$2 ORDER BY first.at DESC`,
        companyId, month.start,
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT stage,COUNT(*)::int AS count FROM "Prospect" WHERE "companyId"=$1 GROUP BY stage`,
        companyId,
      ).catch(() => []),
      db.$queryRawUnsafe<any[]>(
        `SELECT (SELECT COUNT(*) FROM "ProspectVisit" WHERE "companyId"=$1 AND "visitAt">=$2)::int AS prospects,
                (SELECT COUNT(*) FROM "CustomerVisit" WHERE "companyId"=$1 AND "visitAt">=$2)::int AS customers`,
        companyId, month.start,
      ).catch(() => [{ prospects: 0, customers: 0 }]),
      db.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(ch.name,'Sem canal') AS name,SUM(o."totalAmount")::float AS revenue,COUNT(*)::int AS orders
           FROM "SalesOrder" o LEFT JOIN "SalesChannel" ch ON ch.id=o."salesChannelId"
          WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED' AND o."orderedAt">=$2
          GROUP BY 1 ORDER BY 2 DESC`,
        companyId, month.start,
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT c.name,SUM(o."totalAmount")::float AS revenue
           FROM "SalesOrder" o JOIN "Customer" c ON c.id=o."customerId"
          WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED' AND o."orderedAt">=$2
          GROUP BY c.id,c.name ORDER BY 2 DESC LIMIT 1`,
        companyId, month.start,
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT o."customerId",c.name,array_agg(o."orderedAt" ORDER BY o."orderedAt") AS dates
           FROM "SalesOrder" o JOIN "Customer" c ON c.id=o."customerId"
          WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED' AND o."orderedAt">=$2
          GROUP BY o."customerId",c.name HAVING COUNT(*)>=3`,
        companyId, yearAgo,
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT r."customerId",c.name,r."dueDate",r."paymentDate"
           FROM "AccountsReceivable" r JOIN "Customer" c ON c.id=r."customerId"
          WHERE r."companyId"=$1 AND r.status::text='PAID' AND r."paymentDate" IS NOT NULL AND r."dueDate">=$2`,
        companyId, yearAgo,
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT "taskKey",action,until FROM "CommandCenterTaskSnooze" WHERE "companyId"=$1 AND until>NOW()`,
        companyId,
      ),
      db.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int AS count FROM "PartnerDirectShipment" WHERE "companyId"=$1 AND "postedAt">=$2`,
        companyId, weekAgo,
      ).catch(() => [{ count: 0 }]),
    ]);

    const margin = monthMargin(marginRows[0] ?? { revenue: 0, costedRevenue: 0, cost: 0 });
    const goal = goals.find((g) => g.month === month.key) ?? null;
    const nextGoal = goals.find((g) => g.month === month.nextKey) ?? null;
    const stages = new Map<string, number>(prospectRows.map((row) => [row.stage, Number(row.count)]));
    const activeProspects = [...stages.entries()]
      .filter(([stage]) => !["CLIENTE", "SEM_INTERESSE"].includes(stage))
      .reduce((sum, [, count]) => sum + count, 0);
    const monthRevenue = channelRows.reduce((sum, row) => sum + Number(row.revenue), 0);
    const repurchase = repurchaseHealth(
      orderHistory.map((row): CustomerOrderDates => ({ customerId: row.customerId, name: row.name, orderedAt: row.dates })),
      now,
    );
    const delays = payerDelays(paidRows as PaidReceivable[]);
    const newThisWeek = firstOrderRows.filter((row) => new Date(row.at) >= weekAgo).length;

    return {
      generatedAt: now.toISOString(),
      month: month.key,
      margin,
      goal: { month: month.key, salesTarget: goal?.salesTarget ?? null, updatedByName: goal?.updatedByName ?? null },
      nextGoal: { month: month.nextKey, salesTarget: nextGoal?.salesTarget ?? null },
      wins: {
        deliveredOrders: Number(deliveredRows[0]?.count ?? 0),
        received: Number(receivedRows[0]?.amount ?? 0),
        newCustomers: newThisWeek,
        directShipmentsPosted: Number(directRows[0]?.count ?? 0),
      },
      growth: {
        activeProspects,
        proposals: (stages.get("PROPOSTA") ?? 0) + (stages.get("DEGUSTACAO") ?? 0),
        visitsMonth: Number(visitRows[0]?.prospects ?? 0) + Number(visitRows[0]?.customers ?? 0),
        newCustomersMonth: firstOrderRows.length,
        newCustomerNames: firstOrderRows.slice(0, 3).map((row) => row.name),
      },
      customers: {
        recurring: repurchase.recurring,
        onTimeRate: repurchase.onTimeRate,
        lapsed: repurchase.lapsed.slice(0, 5),
        topCustomer: topRows[0] && monthRevenue > 0
          ? { name: topRows[0].name, share: Math.round((Number(topRows[0].revenue) / monthRevenue) * 100) }
          : null,
      },
      channels: channelRows.map((row) => ({ name: row.name, revenue: Number(row.revenue), orders: Number(row.orders) })),
      payerDelays: delays.slice(0, 30),
      snoozes: snoozes.map((row) => ({ taskKey: row.taskKey, action: row.action, until: row.until })),
    };
  }

  /**
   * Vendas de hoje, leve para atualizar a cada minuto: pedidos do BBOS mais os
   * de marketplace que ainda não viraram pedido (sem contar duas vezes), por
   * canal, e os últimos pedidos que chegaram. Também o mês do marketplace que
   * ainda está só na caixa de entrada.
   */
  @Get("today")
  @Header("Cache-Control", "private, no-store")
  async today(@Req() req: Request) {
    const { companyId } = await this.actor(req);
    const now = new Date();
    const local = new Date(now.getTime() - 3 * 3_600_000);
    const dayStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3, 0, 0));
    const month = saoPauloMonth(now);
    const [orders, inbox, inboxMonth, pending] = await Promise.all([
      this.database.$queryRawUnsafe<any[]>(
        `SELECT o.id,COALESCE(o."orderNumber",o.code) AS code,o."createdAt" AS at,o."totalAmount"::float AS amount,
                c.name AS customer,COALESCE(ch.name,'Venda direta') AS channel,ch."platformCode" AS platform,o.status::text AS status,
                (SELECT COALESCE(jsonb_agg(jsonb_build_object('name',i."productName",'quantity',i.quantity) ORDER BY i."totalAmount" DESC),'[]'::jsonb)
                   FROM "SalesOrderItem" i WHERE i."salesOrderId"=o.id) AS items
           FROM "SalesOrder" o
           JOIN "Customer" c ON c.id=o."customerId"
           LEFT JOIN "SalesChannel" ch ON ch.id=o."salesChannelId"
          WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text NOT IN ('CANCELLED','DRAFT')
            AND (o."orderedAt">=$2 OR o."createdAt">=$2)
          ORDER BY o."createdAt" DESC`,
        companyId, dayStart,
      ),
      this.database.$queryRawUnsafe<any[]>(
        `SELECT moi.id,moi."externalOrderId" AS code,COALESCE(moi."orderedAt",moi."firstSeenAt") AS at,
                COALESCE(moi."grossAmount",0)::float AS amount,ch.name AS channel,ch."platformCode" AS platform,
                moi.payload->'tags' AS tags,moi.payload->'order_items' AS items
           FROM "MarketplaceOrderInbox" moi
           JOIN "SalesChannel" ch ON ch.id=moi."salesChannelId"
          WHERE moi."companyId"=$1 AND moi."salesOrderId" IS NULL
            AND LOWER(COALESCE(moi."externalStatus",'')) NOT IN ('cancelled','canceled','cancelado')
            AND COALESCE(moi."orderedAt",moi."firstSeenAt")>=$2
          ORDER BY 3 DESC`,
        companyId, dayStart,
      ).catch(() => []),
      this.database.$queryRawUnsafe<any[]>(
        `SELECT ch.name AS channel,COUNT(*)::int AS orders,COALESCE(SUM(moi."grossAmount"),0)::float AS amount
           FROM "MarketplaceOrderInbox" moi
           JOIN "SalesChannel" ch ON ch.id=moi."salesChannelId"
          WHERE moi."companyId"=$1 AND moi."salesOrderId" IS NULL
            AND LOWER(COALESCE(moi."externalStatus",'')) NOT IN ('cancelled','canceled','cancelado')
            AND COALESCE(moi."orderedAt",moi."firstSeenAt")>=$2
          GROUP BY ch.name ORDER BY 3 DESC`,
        companyId, month.start,
      ).catch(() => []),
      // Pedidos do BBOS que ainda não saíram (e quantos já passaram da data de entrega).
      this.database.$queryRawUnsafe<Array<{ open: number; late: number }>>(
        `SELECT COUNT(*)::int AS open,
                COUNT(*) FILTER (WHERE "expectedDeliveryDate" IS NOT NULL AND "expectedDeliveryDate"::date < (now() AT TIME ZONE 'America/Sao_Paulo')::date)::int AS late
           FROM "SalesOrder" WHERE "companyId"=$1 AND "orderType"='COMMERCIAL'
            AND status::text IN ('CONFIRMED','RESERVED','IN_PRODUCTION','PICKING','READY_TO_SHIP')`,
        companyId,
      ).catch(() => [{ open: 0, late: 0 }]),
    ]);
    const sales = salesOfTheDay(
      orders.map((o) => ({
        id: o.id, code: o.code, at: o.at, amount: o.amount, customer: o.customer, channel: o.channel,
        marketplace: Boolean(o.platform && o.platform !== "BISPO_STORE"),
        item: itemLabel((Array.isArray(o.items) ? o.items : []).map((i: any) => ({ name: String(i.name ?? ""), quantity: Number(i.quantity) || 1 }))),
        ship: orderShipState(String(o.status ?? "")),
      })),
      inbox.map((o) => ({
        id: `mp-${o.id}`, code: o.code, at: o.at, amount: o.amount, customer: null, channel: o.channel, marketplace: true,
        item: itemLabel((Array.isArray(o.items) ? o.items : []).map((i: any) => ({ name: String(i?.item?.title ?? "Item"), quantity: Number(i?.quantity) || 1 }))),
        ship: marketplaceShipState(o.tags),
      })),
    );
    const bbosOpen = pending[0] ?? { open: 0, late: 0 };
    return {
      generatedAt: now.toISOString(),
      ...sales,
      // Expedição: pedidos do BBOS em aberto + os de marketplace de hoje ainda não entregues.
      shipping: {
        toShip: Number(bbosOpen.open) + inbox.filter((o) => marketplaceShipState(o.tags) === "TO_SHIP").length,
        late: Number(bbosOpen.late),
      },
      marketplaceMonth: {
        amount: inboxMonth.reduce((sum, row) => sum + Number(row.amount), 0),
        orders: inboxMonth.reduce((sum, row) => sum + Number(row.orders), 0),
        byChannel: inboxMonth.map((row) => ({ channel: row.channel, amount: Number(row.amount), orders: Number(row.orders) })),
      },
    };
  }

  /**
   * Vendas por grupo (Signa, Distribuidores, White Label, Pontos de consumo,
   * Mercado Livre, Loja online) dia a dia nas últimas 8 semanas, para o gráfico
   * da Central. Só a liderança vê.
   */
  @Get("sales-groups")
  @Header("Cache-Control", "private, no-store")
  async salesGroups(@Req() req: Request) {
    const actor = await this.actor(req);
    if (!["ADMIN", "EXECUTIVE"].includes(String(actor.role))) throw new ForbiddenException("Só a liderança vê as vendas por grupo.");
    const now = new Date();
    const local = new Date(now.getTime() - 3 * 3_600_000);
    // Segunda-feira de 7 semanas atrás (8 semanas contando a atual), meia-noite em São Paulo.
    const dow = (local.getUTCDay() + 6) % 7;
    const since = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - dow - 49, 3, 0, 0));
    // Também o mês passado inteiro, para comparar no mesmo período (1 até o dia de hoje).
    const previousStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1, 3, 0, 0));
    const queryFrom = previousStart < since ? previousStart : since;
    const day = (column: string) => `to_char((${column} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD')`;
    const rows = await this.database.$queryRawUnsafe<Array<{ day: string; segment: string | null; partnerB2B: boolean; webStore: boolean; marketplace: boolean; revenue: number; orders: number }>>(
      `SELECT ${day('o."orderedAt"')} AS day,c.segment,
              (EXISTS (SELECT 1 FROM "StorefrontPartnerCustomer" l JOIN "User" pu ON pu."storefrontPartnerId"=l."partnerId"
                        WHERE l."customerId"=o."customerId" AND pu.role::text='PARTNER')
               OR EXISTS (SELECT 1 FROM "User" pu WHERE pu."storefrontPartnerId"=o."createdByStorefrontPartnerId" AND pu.role::text='PARTNER')) AS "partnerB2B",
              (COALESCE(o."orderNumber",'') LIKE 'WEB-%') AS "webStore", false AS marketplace,
              SUM(o."totalAmount")::float AS revenue,COUNT(*)::int AS orders
         FROM "SalesOrder" o JOIN "Customer" c ON c.id=o."customerId"
        WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED' AND o."orderedAt">=$2 AND ${NOT_INTERNAL}
        GROUP BY 1,2,3,4
       UNION ALL
       SELECT ${day('COALESCE(moi."orderedAt",moi."firstSeenAt")')},NULL,false,false,true,SUM(COALESCE(moi."grossAmount",0))::float,COUNT(*)::int
         FROM "MarketplaceOrderInbox" moi
        WHERE moi."companyId"=$1 AND moi."salesOrderId" IS NULL
          AND LOWER(COALESCE(moi."externalStatus",'')) NOT IN ('cancelled','canceled','cancelado')
          AND COALESCE(moi."orderedAt",moi."firstSeenAt")>=$2
        GROUP BY 1`,
      actor.companyId, queryFrom,
    );
    const month = saoPauloMonth(now).key;
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const todayIso = iso(local);
    const prevKey = iso(previousStart).slice(0, 7);
    const prevDays = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 0)).getUTCDate();
    const prevUntil = `${prevKey}-${String(Math.min(local.getUTCDate(), prevDays)).padStart(2, "0")}`;
    const monthRows = rows.filter((r) => r.day.startsWith(month) && r.day <= todayIso);
    const monthGroups = groupSales(monthRows);
    return {
      generatedAt: now.toISOString(),
      since: iso(since).slice(0, 10),
      groups: SALES_GROUPS,
      days: dailySalesGroups(rows.filter((r) => r.day >= iso(since).slice(0, 10))),
      month: {
        key: month,
        total: Math.round(monthGroups.reduce((sum, g) => sum + g.revenue, 0) * 100) / 100,
        orders: monthGroups.reduce((sum, g) => sum + g.orders, 0),
        previousTotal: Math.round(rows.filter((r) => r.day.startsWith(prevKey) && r.day <= prevUntil).reduce((sum, r) => sum + Number(r.revenue || 0), 0) * 100) / 100,
        groups: monthGroups.map((g) => ({ name: g.name, revenue: Math.round(g.revenue * 100) / 100, orders: g.orders })),
      },
    };
  }

  /**
   * Pedidos de marketplace (ex.: Mercado Livre) de hoje, 7 dias ou do mês, para
   * a página aberta pelo card "Vendas de hoje". Mostra o que foi vendido, a
   * cidade de entrega e a situação; não expõe dados pessoais do comprador.
   */
  @Get("marketplace-orders")
  @Header("Cache-Control", "private, no-store")
  async marketplaceOrders(@Req() req: Request, @Query("period") period?: string, @Query("channel") channel?: string) {
    const { companyId } = await this.actor(req);
    const now = new Date();
    const local = new Date(now.getTime() - 3 * 3_600_000);
    const today = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3, 0, 0));
    const key = period === "7d" || period === "month" ? period : "today";
    const since = key === "today" ? today : key === "7d" ? new Date(today.getTime() - 6 * 86_400_000) : saoPauloMonth(now).start;
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT moi.id,moi."externalOrderId",moi."externalStatus",COALESCE(moi."orderedAt",moi."firstSeenAt") AS "orderedAt",
              COALESCE(moi."grossAmount",0)::float AS gross,COALESCE(NULLIF(moi."feeAmount",0),(SELECT SUM(COALESCE((oi->>'sale_fee')::numeric,0)*COALESCE((oi->>'quantity')::numeric,1)) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(moi.payload->'order_items')='array' THEN moi.payload->'order_items' ELSE '[]'::jsonb END) oi),0)::float AS fee,
              COALESCE(moi."freightAmount",0)::float AS freight,moi."importStatus",moi."salesOrderId",
              ch.name AS channel,ch."platformCode" AS platform,d.city,d.state,
              moi.payload->'order_items' AS items
         FROM "MarketplaceOrderInbox" moi
         JOIN "SalesChannel" ch ON ch.id=moi."salesChannelId"
         LEFT JOIN "MarketplaceOrderDestination" d ON d."inboxId"=moi.id
        WHERE moi."companyId"=$1 AND COALESCE(moi."orderedAt",moi."firstSeenAt")>=$2
          AND ($3::text IS NULL OR ch.name=$3)
        ORDER BY 4 DESC LIMIT 500`,
      companyId, since, channel?.trim() || null,
    ).catch(() => []);
    const channels = await this.database.$queryRawUnsafe<any[]>(
      `SELECT DISTINCT ch.name FROM "MarketplaceOrderInbox" moi JOIN "SalesChannel" ch ON ch.id=moi."salesChannelId"
        WHERE moi."companyId"=$1 ORDER BY 1`,
      companyId,
    ).catch(() => []);
    return {
      period: key,
      since: since.toISOString(),
      channels: channels.map((row) => row.name as string),
      ...marketplaceOrderList(rows),
    };
  }

  @Put("goal")
  async saveGoal(@Body() body: { month?: string; salesTarget?: number | string | null }, @Req() req: Request) {
    const actor = await this.actor(req);
    let goal;
    try {
      goal = validateGoal(body);
    } catch (error) {
      badRequest(error);
    }
    if (goal.salesTarget === null) {
      await this.database.$executeRawUnsafe(
        `DELETE FROM "CommandCenterGoal" WHERE "companyId"=$1 AND month=$2`,
        actor.companyId, goal.month,
      );
    } else {
      await this.database.$executeRawUnsafe(
        `INSERT INTO "CommandCenterGoal" ("companyId",month,"salesTarget","updatedByName","updatedAt")
         VALUES ($1,$2,$3::numeric,$4,NOW())
         ON CONFLICT ("companyId",month) DO UPDATE SET "salesTarget"=EXCLUDED."salesTarget","updatedByName"=EXCLUDED."updatedByName","updatedAt"=NOW()`,
        actor.companyId, goal.month, goal.salesTarget.toFixed(2), String(actor.name ?? "").slice(0, 120),
      );
    }
    return goal;
  }

  @Post("tasks/snooze")
  async snooze(@Body() body: { taskKey?: string; action?: string }, @Req() req: Request) {
    const actor = await this.actor(req);
    let taskKey: string;
    let until: Date;
    try {
      taskKey = validateTaskKey(body.taskKey);
      until = snoozeUntil(String(body.action ?? ""));
    } catch (error) {
      badRequest(error);
    }
    await this.database.$executeRawUnsafe(
      `INSERT INTO "CommandCenterTaskSnooze" ("companyId","taskKey",action,until,"createdByName")
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT ("companyId","taskKey") DO UPDATE SET action=EXCLUDED.action,until=EXCLUDED.until,"createdByName"=EXCLUDED."createdByName","createdAt"=NOW()`,
      actor.companyId, taskKey, String(body.action), until, String(actor.name ?? "").slice(0, 120),
    );
    return { taskKey, action: body.action, until };
  }

  @Delete("tasks/snooze/:taskKey")
  async unsnooze(@Param("taskKey") taskKey: string, @Req() req: Request) {
    const actor = await this.actor(req);
    await this.database.$executeRawUnsafe(
      `DELETE FROM "CommandCenterTaskSnooze" WHERE "companyId"=$1 AND "taskKey"=$2`,
      actor.companyId, taskKey,
    );
    return { taskKey, restored: true };
  }
}
