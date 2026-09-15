import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { AuthService } from "./auth.service";

type PlanRequirementBody = {
  productionOrderId: string;
};

@Controller("production-requirements")
export class ProductionRequirementsController {
  private readonly db = new PrismaClient();

  constructor(private readonly auth: AuthService) {}

  private async actor(req: any) {
    const actor = await this.auth.resolve(this.auth.readToken(req));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  @Get()
  async list(@Req() req: any) {
    const actor = await this.actor(req);
    return this.db
      .$queryRawUnsafe<any[]>(
        `SELECT
          r.*,
          p.name,
          pv.sku,
          pv."netWeightGrams",
          po.code AS "productionOrderCode",
          po.status AS "productionOrderStatus",
          po."plannedAt" AS "productionOrderPlannedAt"
        FROM "ProductionRequirement" r
        JOIN "ProductVariant" pv ON pv.id = r."productVariantId"
        JOIN "Product" p ON p.id = pv."productId"
        LEFT JOIN "ProductionOrder" po ON po.id = r."productionOrderId"
        WHERE r."companyId" = $1
          AND r.status IN ('OPEN','PLANNED')
        ORDER BY
          CASE r.status WHEN 'OPEN' THEN 0 ELSE 1 END,
          r."createdAt" DESC`,
        actor.companyId,
      )
      .catch(() => []);
  }

  @Post(":id/plan")
  async plan(
    @Param("id") id: string,
    @Body() body: PlanRequirementBody,
    @Req() req: any,
  ) {
    const actor = await this.actor(req);
    if (!body.productionOrderId)
      throw new BadRequestException("Informe a Ordem de Produção.");

    return this.db.$transaction(async (transaction) => {
      const rows = await transaction.$queryRawUnsafe<any[]>(
        `SELECT * FROM "ProductionRequirement"
         WHERE id = $1 AND "companyId" = $2
         FOR UPDATE`,
        id,
        actor.companyId,
      );
      const requirement = rows[0];
      if (!requirement)
        throw new NotFoundException("Necessidade de produção não encontrada.");
      if (requirement.status === "RESOLVED" || requirement.status === "CANCELLED")
        throw new BadRequestException("Esta necessidade já foi encerrada.");

      const orders = await transaction.$queryRawUnsafe<any[]>(
        `SELECT id, code, status, "productVariantId", "plannedWeightKg"
         FROM "ProductionOrder"
         WHERE id = $1 AND "companyId" = $2`,
        body.productionOrderId,
        actor.companyId,
      );
      const order = orders[0];
      if (!order)
        throw new NotFoundException("Ordem de Produção não encontrada.");
      if (order.productVariantId !== requirement.productVariantId)
        throw new BadRequestException(
          "A OP selecionada não corresponde ao SKU desta necessidade.",
        );
      if (order.status === "COMPLETED" || order.status === "CANCELLED")
        throw new BadRequestException(
          "A OP selecionada já está encerrada e não pode ser vinculada.",
        );

      await transaction.$executeRawUnsafe(
        `UPDATE "ProductionRequirement"
         SET status = 'PLANNED', "productionOrderId" = $3
         WHERE id = $1 AND "companyId" = $2`,
        id,
        actor.companyId,
        body.productionOrderId,
      );

      return {
        id,
        status: "PLANNED",
        productionOrderId: order.id,
        productionOrderCode: order.code,
        productionOrderStatus: order.status,
        recommendedUnits: requirement.recommendedUnits,
        plannedWeightKg: Number(order.plannedWeightKg),
      };
    });
  }

  @Post(":id/resolve")
  async resolve(@Param("id") id: string, @Req() req: any) {
    const actor = await this.actor(req);

    return this.db.$transaction(async (transaction) => {
      const rows = await transaction.$queryRawUnsafe<any[]>(
        `SELECT r.*, po.status AS "productionOrderStatus", po.code AS "productionOrderCode"
         FROM "ProductionRequirement" r
         LEFT JOIN "ProductionOrder" po ON po.id = r."productionOrderId"
         WHERE r.id = $1 AND r."companyId" = $2
         FOR UPDATE OF r`,
        id,
        actor.companyId,
      );
      const requirement = rows[0];
      if (!requirement)
        throw new NotFoundException("Necessidade de produção não encontrada.");
      if (requirement.status === "RESOLVED")
        return {
          id,
          status: "RESOLVED",
          productionOrderId: requirement.productionOrderId,
          productionOrderCode: requirement.productionOrderCode,
          idempotent: true,
        };
      if (!requirement.productionOrderId)
        throw new BadRequestException(
          "Vincule uma Ordem de Produção antes de resolver a necessidade.",
        );
      if (requirement.productionOrderStatus !== "COMPLETED")
        throw new BadRequestException(
          "A necessidade só pode ser resolvida após a conclusão da OP vinculada.",
        );

      await transaction.$executeRawUnsafe(
        `UPDATE "ProductionRequirement"
         SET status = 'RESOLVED', "resolvedAt" = CURRENT_TIMESTAMP
         WHERE id = $1 AND "companyId" = $2`,
        id,
        actor.companyId,
      );

      return {
        id,
        status: "RESOLVED",
        productionOrderId: requirement.productionOrderId,
        productionOrderCode: requirement.productionOrderCode,
        resolvedAt: new Date().toISOString(),
      };
    });
  }
}
