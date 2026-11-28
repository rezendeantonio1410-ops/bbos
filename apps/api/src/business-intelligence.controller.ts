import { BadRequestException, Body, Controller, Get, Header, Put, Query, Req, UnauthorizedException } from "@nestjs/common";
import { prisma } from "@bbos/database";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { isDesignatedTermCreditApprover } from "./sales-order-term-approval-policy";
import { customerInsights, marginBreakdown, parseCoffeeCostSetting } from "./business-intelligence";
import { loadCostContext, loadCustomerOrders, loadSaleItems } from "./bi-data";

const PERIODS = [30, 90, 365] as const;


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
    const [items, orders, ctx] = await Promise.all([
      loadSaleItems(db, companyId, since, new Date(now.getTime() + 86_400_000)),
      loadCustomerOrders(db, companyId, yearAgo),
      loadCostContext(db, companyId, yearAgo),
    ]);
    const { packagingPerUnit, roastLossPercent, byLine, average, costs } = ctx;
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
