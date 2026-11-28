import { BadRequestException, Body, Controller, Get, Header, Put, Query, Req, UnauthorizedException } from "@nestjs/common";
import { prisma } from "@bbos/database";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { isDesignatedTermCreditApprover } from "./sales-order-term-approval-policy";
import {
  averageRoastLoss,
  coffeeCosts,
  customerInsights,
  lineCosts,
  type LineLotRow,
  marginBreakdown,
  parseCoffeeCostSetting,
  type CoffeeRoastRow,
  type CoffeeSettingRow,
  type CustomerOrderRow,
  type SaleItemRow,
} from "./business-intelligence";

const PERIODS = [30, 90, 365] as const;

/**
 * Conta interna: cliente com o mesmo e-mail de um usuário da equipe (sócios,
 * funcionários). Parceiros com acesso ao portal (PARTNER) são clientes reais.
 */
const NOT_INTERNAL = `NOT EXISTS (SELECT 1 FROM "Customer" ic JOIN "User" iu ON lower(iu.email)=lower(ic.email) AND iu."companyId"=ic."companyId"
                                   WHERE ic.id=o."customerId" AND ic.email IS NOT NULL AND ic.email<>'' AND iu.role::text<>'PARTNER')`;

/**
 * Inteligência (BI): margem por café e canal, clientes e custo da
 * matéria-prima. Só leitura, exceto o ajuste manual de custo (José ou Suzi).
 */
@Controller("bi")
export class BusinessIntelligenceController {
  private readonly database = prisma;

  constructor(private readonly auth: AuthService) {}

  private async actor(req: Request) {
    const actor = await this.auth.resolve(this.auth.readToken(req));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  @Get("overview")
  @Header("Cache-Control", "private, no-store")
  async overview(@Req() req: Request, @Query("days") daysParam?: string) {
    const actor = await this.actor(req);
    const companyId = actor.companyId;
    const days = PERIODS.includes(Number(daysParam) as (typeof PERIODS)[number]) ? Number(daysParam) : 90;
    const now = new Date();
    const since = new Date(now.getTime() - days * 86_400_000);
    const yearAgo = new Date(now.getTime() - 365 * 86_400_000);
    const db = this.database;
    const [items, coffees, roasts, settings, packaging, orders, lineLots] = await Promise.all([
      db.$queryRawUnsafe<SaleItemRow[]>(
        `SELECT o.id AS "orderId",COALESCE(ch.name,'Direto') AS channel,
                CASE WHEN line.code::text='GREEN_COFFEE' THEN NULL ELSE COALESCE(p."baseCoffeeProductId",p.id) END AS "coffeeId",
                CASE WHEN line.code::text='GREEN_COFFEE' THEN 'Café verde (revenda)' ELSE COALESCE(bp.name,i."productName") END AS "coffeeName",
                i.quantity::float AS units,
                (i.quantity*COALESCE(v."netWeightGrams",0)/1000.0)::float AS kg,
                i."totalAmount"::float AS revenue
           FROM "SalesOrderItem" i
           JOIN "SalesOrder" o ON o.id=i."salesOrderId"
           LEFT JOIN "SalesChannel" ch ON ch.id=o."salesChannelId"
           LEFT JOIN "ProductVariant" v ON v.id=i."productVariantId"
           LEFT JOIN "Product" p ON p.id=v."productId"
           LEFT JOIN "Product" bp ON bp.id=COALESCE(p."baseCoffeeProductId",p.id)
           LEFT JOIN "ProductLine" line ON line.id=bp."productLineId"
          WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED'
            AND o."orderedAt">=$2 AND ${NOT_INTERNAL}`,
        companyId, since,
      ),
      db.$queryRawUnsafe<Array<{ coffeeId: string; coffeeName: string; line: string }>>(
        `SELECT p.id AS "coffeeId",p.name AS "coffeeName",line.code::text AS line
           FROM "Product" p JOIN "ProductLine" line ON line.id=p."productLineId"
          WHERE line."companyId"=$1 AND p."baseCoffeeProductId" IS NULL AND line.code::text<>'GREEN_COFFEE'
          ORDER BY p.name`,
        companyId,
      ),
      db.$queryRawUnsafe<CoffeeRoastRow[]>(
        // Custo real: lotes de café verde usados (custo posto ÷ peso inicial) ÷ kg torrado.
        `WITH op AS (
           SELECT COALESCE(p."baseCoffeeProductId",p.id) AS "coffeeId",bp.name AS "coffeeName",
                  (SELECT COALESCE(SUM(c."reservedKg"),0) FROM "ProductionConsumption" c WHERE c."productionOrderId"=po.id) AS green_kg,
                  (SELECT COALESCE(SUM(c."reservedKg"*(l."landedCost"/NULLIF(l."initialWeightKg",0))),0)
                     FROM "ProductionConsumption" c JOIN "CoffeeLot" l ON l.id=c."coffeeLotId"
                    WHERE c."productionOrderId"=po.id AND l."landedCost">0) AS green_cost,
                  (SELECT COALESCE(SUM(c."reservedKg"),0) FROM "ProductionConsumption" c JOIN "CoffeeLot" l ON l.id=c."coffeeLotId"
                    WHERE c."productionOrderId"=po.id AND (l."landedCost" IS NULL OR l."landedCost"<=0)) AS uncosted_kg,
                  (SELECT COALESCE(SUM(b."roastedOutputKg"),0) FROM "ProductionBatch" b WHERE b."productionOrderId"=po.id) AS roasted
             FROM "ProductionOrder" po
             JOIN "ProductVariant" pv ON pv.id=po."productVariantId"
             JOIN "Product" p ON p.id=pv."productId"
             JOIN "Product" bp ON bp.id=COALESCE(p."baseCoffeeProductId",p.id)
            WHERE po."companyId"=$1 AND po.status::text<>'CANCELLED' AND po."plannedAt">=$2)
         SELECT "coffeeId","coffeeName",COUNT(*)::int AS roasts,
                SUM(green_kg)::float AS "greenKg",SUM(green_cost)::float AS "greenCost",SUM(roasted)::float AS "roastedKg"
           FROM op WHERE roasted>0 AND green_cost>0 AND uncosted_kg<=0.001
          GROUP BY "coffeeId","coffeeName"`,
        companyId, yearAgo,
      ),
      db.$queryRawUnsafe<CoffeeSettingRow[]>(
        `SELECT "productId" AS "coffeeId","greenCostPerKg"::float AS "greenCostPerKg",
                "roastLossPercent"::float AS "roastLossPercent","updatedByName","updatedAt"
           FROM "CoffeeCostSetting" WHERE "companyId"=$1`,
        companyId,
      ),
      db.$queryRawUnsafe<Array<{ perUnit: number | null }>>(
        `SELECT (SUM("totalCost")/NULLIF(SUM(quantity),0))::float AS "perUnit"
           FROM "PackagingConsumption" WHERE "companyId"=$1 AND "materialType"='PACKAGE' AND quantity>0`,
        companyId,
      ),
      db.$queryRawUnsafe<CustomerOrderRow[]>(
        `SELECT o."customerId",c.name,c.phone,o."orderedAt",o."totalAmount"::float AS amount
           FROM "SalesOrder" o JOIN "Customer" c ON c.id=o."customerId"
          WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED'
            AND o."orderedAt">=$2 AND ${NOT_INTERNAL}`,
        companyId, yearAgo,
      ),
      db.$queryRawUnsafe<LineLotRow[]>(
        // Lotes marcados para cada linha (custo posto e peso inicial).
        `SELECT line,SUM(l."landedCost")::float AS "greenCost",SUM(l."initialWeightKg")::float AS "greenKg"
           FROM "CoffeeLot" l, unnest(l."intendedLines") AS line
          WHERE l."companyId"=$1 AND l."landedCost">0 AND l."initialWeightKg">0
          GROUP BY line`,
        companyId,
      ),
    ]);
    const packagingPerUnit = Math.round((packaging[0]?.perUnit ?? 0) * 100) / 100;
    const roastLossPercent = averageRoastLoss(roasts);
    const byLine = lineCosts(lineLots, roastLossPercent);
    const { average, costs } = coffeeCosts(coffees, roasts, settings, byLine);
    const margin = marginBreakdown(items, costs, packagingPerUnit);
    const soldRevenue = new Map(margin.byCoffee.map((c) => [c.name, c.revenue]));
    const materials = [...costs.values()]
      .map((cost) => ({ ...cost, revenue: soldRevenue.get(cost.coffeeName) ?? 0 }))
      .filter((cost) => cost.revenue > 0 || cost.roasts > 0 || cost.manual)
      .sort((a, b) => b.revenue - a.revenue || a.coffeeName.localeCompare(b.coffeeName, "pt-BR"));
    const sources = { MANUAL: 0, ROASTS: 0, LINE: 0, AVERAGE: 0, NONE: 0 };
    for (const m of materials) sources[m.source] += 1;
    return {
      period: { days, since: since.toISOString() },
      averageCostPerRoastedKg: average,
      roastLossPercent,
      lines: [...byLine.entries()].map(([line, costPerRoastedKg]) => ({ line, costPerRoastedKg })),
      packagingPerUnit,
      sources,
      margin,
      materials,
      customers: customerInsights(orders, now),
      canEditCosts: isDesignatedTermCreditApprover(actor),
    };
  }

  /** Ajuste manual do custo da matéria-prima de um café. Só José ou Suzi. */
  @Put("coffee-costs")
  async setCoffeeCost(@Req() req: Request, @Body() body: unknown) {
    const actor = await this.actor(req);
    if (!isDesignatedTermCreditApprover(actor))
      throw new UnauthorizedException("Somente José ou Suzi podem ajustar o custo da matéria-prima.");
    let input: ReturnType<typeof parseCoffeeCostSetting>;
    try { input = parseCoffeeCostSetting(body); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "Ajuste inválido."); }
    const product = await this.database.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT p.id FROM "Product" p JOIN "ProductLine" line ON line.id=p."productLineId"
        WHERE p.id=$1 AND line."companyId"=$2 AND p."baseCoffeeProductId" IS NULL`,
      input.coffeeId, actor.companyId,
    );
    if (!product[0]) throw new BadRequestException("Café não encontrado.");
    if (input.greenCostPerKg === null) {
      await this.database.$executeRawUnsafe(
        `DELETE FROM "CoffeeCostSetting" WHERE "companyId"=$1 AND "productId"=$2`,
        actor.companyId, input.coffeeId,
      );
      return { ok: true, coffeeId: input.coffeeId, manual: null };
    }
    await this.database.$executeRawUnsafe(
      `INSERT INTO "CoffeeCostSetting" ("companyId","productId","greenCostPerKg","roastLossPercent","updatedById","updatedByName","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT ("companyId","productId") DO UPDATE
         SET "greenCostPerKg"=EXCLUDED."greenCostPerKg","roastLossPercent"=EXCLUDED."roastLossPercent",
             "updatedById"=EXCLUDED."updatedById","updatedByName"=EXCLUDED."updatedByName","updatedAt"=NOW()`,
      actor.companyId, input.coffeeId, input.greenCostPerKg, input.roastLossPercent, actor.id, actor.name,
    );
    return { ok: true, coffeeId: input.coffeeId, manual: { greenCostPerKg: input.greenCostPerKg, roastLossPercent: input.roastLossPercent } };
  }
}
