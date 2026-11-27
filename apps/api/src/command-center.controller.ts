import { BadRequestException, Body, Controller, Delete, Get, Header, Param, Post, Put, Req, UnauthorizedException } from "@nestjs/common";
import { prisma } from "@bbos/database";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import {
  monthMargin,
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
