import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { prisma } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { buildPortfolio, portfolioAlerts, sellerMonth, validateSellerGoal, type PortfolioCustomerRow } from "./seller-portfolio";

/**
 * Carteira do vendedor (clientes ligados ao parceiro de vendas dele) e os
 * avisos do sino: a cada 6 h, cria "esfriando", "cliente novo sem pedido" e
 * "recompra chegando", sem repetir o mesmo aviso dentro de 7 dias.
 */
@Injectable()
export class SellerPortfolioService implements OnModuleInit, OnModuleDestroy {
  private readonly database = prisma;
  private readonly logger = new Logger(SellerPortfolioService.name);
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;

  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    this.first = setTimeout(() => void this.generateAlerts(), 2 * 60_000);
    this.timer = setInterval(() => void this.generateAlerts(), 6 * 3_600_000);
    this.first.unref?.();
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  async rows(companyId: string, partnerId: string): Promise<PortfolioCustomerRow[]> {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT c.id,COALESCE(NULLIF(c."tradeName",''),c.name) AS name,c.phone,c."creditStatus"::text AS "creditStatus",
              c."paymentTerms",c."createdAt",
              COALESCE((SELECT array_agg(o."orderedAt") FROM "SalesOrder" o
                 WHERE o."customerId"=c.id AND o."companyId"=c."companyId" AND o."orderType"='COMMERCIAL'
                   AND o.status::text NOT IN ('CANCELLED','DRAFT') AND o."orderedAt">=NOW()-INTERVAL '365 days'),'{}') AS "orderDates",
              COALESCE((SELECT SUM(o."totalAmount") FROM "SalesOrder" o
                 WHERE o."customerId"=c.id AND o."companyId"=c."companyId" AND o."orderType"='COMMERCIAL'
                   AND o.status::text NOT IN ('CANCELLED','DRAFT') AND o."orderedAt">=NOW()-INTERVAL '90 days'),0)::float AS "revenue90",
              (SELECT o."totalAmount"::float FROM "SalesOrder" o
                 WHERE o."customerId"=c.id AND o."companyId"=c."companyId" AND o."orderType"='COMMERCIAL'
                   AND o.status::text NOT IN ('CANCELLED','DRAFT') ORDER BY o."orderedAt" DESC LIMIT 1) AS "lastOrderAmount",
              COALESCE((SELECT SUM(r."openAmount") FROM "AccountsReceivable" r
                 WHERE r."customerId"=c.id AND r."companyId"=c."companyId"
                   AND r.status::text IN ('OPEN','OVERDUE','PARTIALLY_PAID') AND r."dueDate"<date_trunc('day',NOW())),0)::float AS "overdueAmount",
              (SELECT MIN(r."dueDate") FROM "AccountsReceivable" r
                 WHERE r."customerId"=c.id AND r."companyId"=c."companyId"
                   AND r.status::text IN ('OPEN','OVERDUE','PARTIALLY_PAID') AND r."dueDate"<date_trunc('day',NOW())) AS "overdueSince",
              (SELECT MAX(v."visitAt") FROM "CustomerVisit" v WHERE v."customerId"=c.id) AS "lastVisitAt"
         FROM "StorefrontPartnerCustomer" link
         JOIN "Customer" c ON c.id=link."customerId"
        WHERE link."partnerId"=$1 AND c."companyId"=$2 AND c.active=true`,
      partnerId,
      companyId,
    );
    return rows.map((row) => ({ ...row, orderDates: Array.isArray(row.orderDates) ? row.orderDates : [] }));
  }

  async portfolio(companyId: string, partnerId: string) {
    const [rows, month] = await Promise.all([this.rows(companyId, partnerId), this.month(companyId, partnerId)]);
    return { ...buildPortfolio(rows), month };
  }

  /** Vendido no mês pela carteira (R$ e kg) contra a meta definida pela liderança. */
  async month(companyId: string, partnerId: string, now = new Date()) {
    const local = new Date(now.getTime() - 3 * 3_600_000);
    const key = local.toISOString().slice(0, 7);
    const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 3, 0, 0));
    const [sales, goals] = await Promise.all([
      this.database.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int AS orders,
                COALESCE(SUM(o."totalAmount"),0)::float AS revenue,
                COALESCE(SUM((SELECT SUM(i.quantity*COALESCE(v."netWeightGrams",0))
                                FROM "SalesOrderItem" i LEFT JOIN "ProductVariant" v ON v.id=i."productVariantId"
                               WHERE i."salesOrderId"=o.id)),0)::float/1000.0 AS kg
           FROM "SalesOrder" o
          WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL'
            AND o.status::text NOT IN ('CANCELLED','DRAFT') AND o."orderedAt">=$3
            AND (o."createdByStorefrontPartnerId"=$2 OR EXISTS (
              SELECT 1 FROM "StorefrontPartnerCustomer" l WHERE l."partnerId"=$2 AND l."customerId"=o."customerId"))`,
        companyId, partnerId, start,
      ),
      this.database.$queryRawUnsafe<any[]>(
        `SELECT "salesTarget"::float AS "salesTarget","kgTarget"::float AS "kgTarget"
           FROM "SellerGoal" WHERE "companyId"=$1 AND "partnerId"=$2 AND month=$3`,
        companyId, partnerId, key,
      ).catch(() => []),
    ]);
    return sellerMonth({
      revenue: Number(sales[0]?.revenue ?? 0),
      kg: Number(sales[0]?.kg ?? 0),
      orders: Number(sales[0]?.orders ?? 0),
      salesTarget: goals[0]?.salesTarget ?? null,
      kgTarget: goals[0]?.kgTarget ?? null,
      now,
    });
  }

  /** Metas de todos os vendedores para um mês (tela de Parceiros). */
  async goals(companyId: string, month: string) {
    return this.database.$queryRawUnsafe<any[]>(
      `SELECT "partnerId",month,"salesTarget"::float AS "salesTarget","kgTarget"::float AS "kgTarget","updatedByName","updatedAt"
         FROM "SellerGoal" WHERE "companyId"=$1 AND month=$2`,
      companyId, month,
    );
  }

  async saveGoal(companyId: string, body: Record<string, unknown>, actorName: string) {
    const goal = validateSellerGoal(body);
    const partner = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id FROM "StorefrontPartner" WHERE id=$1 AND "companyId"=$2 LIMIT 1`,
      goal.partnerId, companyId,
    );
    if (!partner[0]) throw new Error("Vendedor não encontrado.");
    if (goal.salesTarget === null && goal.kgTarget === null) {
      await this.database.$executeRawUnsafe(
        `DELETE FROM "SellerGoal" WHERE "companyId"=$1 AND "partnerId"=$2 AND month=$3`,
        companyId, goal.partnerId, goal.month,
      );
      return goal;
    }
    await this.database.$executeRawUnsafe(
      `INSERT INTO "SellerGoal" ("companyId","partnerId",month,"salesTarget","kgTarget","updatedByName","updatedAt")
       VALUES ($1,$2,$3,$4::numeric,$5::numeric,$6,NOW())
       ON CONFLICT ("companyId","partnerId",month) DO UPDATE SET "salesTarget"=EXCLUDED."salesTarget",
         "kgTarget"=EXCLUDED."kgTarget","updatedByName"=EXCLUDED."updatedByName","updatedAt"=NOW()`,
      companyId, goal.partnerId, goal.month,
      goal.salesTarget === null ? null : goal.salesTarget.toFixed(2),
      goal.kgTarget === null ? null : goal.kgTarget.toFixed(3),
      actorName.slice(0, 120),
    );
    return goal;
  }

  /** Avisos do sino para todos os vendedores com carteira. */
  async generateAlerts() {
    try {
      const partners = await this.database.$queryRawUnsafe<Array<{ id: string; companyId: string }>>(
        `SELECT p.id,p."companyId" FROM "StorefrontPartner" p
          WHERE p.active=true AND p."isSalesPartner"=true
            AND EXISTS (SELECT 1 FROM "User" u WHERE u."storefrontPartnerId"=p.id AND u.role::text='SALES' AND u.active=true)`,
      );
      let created = 0;
      for (const partner of partners) {
        const alerts = portfolioAlerts(await this.portfolio(partner.companyId, partner.id));
        for (const alert of alerts) {
          const recent = await this.database.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT id FROM "OperationalNotification"
              WHERE "companyId"=$1 AND type=$2 AND "createdAt">NOW()-INTERVAL '7 days' LIMIT 1`,
            partner.companyId,
            alert.type,
          );
          if (recent[0]) continue;
          await this.database.$executeRawUnsafe(
            `INSERT INTO "OperationalNotification" (id,"companyId",type,title,message,"targetRole","createdAt")
             VALUES ($1,$2,$3,$4,$5,'SALES',NOW())`,
            randomUUID(), partner.companyId, alert.type, alert.title.slice(0, 200), alert.message.slice(0, 500),
          );
          created += 1;
        }
      }
      if (created) this.logger.log(`Avisos de carteira criados: ${created}`);
      return { created };
    } catch (error) {
      this.logger.warn(`Avisos de carteira não gerados: ${error instanceof Error ? error.message : error}`);
      return { created: 0 };
    }
  }
}
