import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { prisma } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { buildPortfolio, portfolioAlerts, type PortfolioCustomerRow } from "./seller-portfolio";

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
    return buildPortfolio(await this.rows(companyId, partnerId));
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
