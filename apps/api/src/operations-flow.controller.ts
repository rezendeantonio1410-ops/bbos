import { BadRequestException, Body, Controller, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { AuthService } from "./auth.service";

@Controller("operations-flow")
export class OperationsFlowController {
  private readonly db = new PrismaClient();
  constructor(private readonly auth: AuthService) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  @Get("summary")
  async summary(@Req() request: any) {
    const actor = await this.actor(request);
    const wip = await this.db.$queryRawUnsafe<any[]>("SELECT COALESCE(SUM(\"availableKg\"),0)::float AS \"availableKg\", COUNT(*) FILTER (WHERE \"availableKg\">0)::int AS lots FROM \"RoastedWipLot\" WHERE \"companyId\"=$1", actor.companyId).catch(() => [{ availableKg: 0, lots: 0 }]);
    const finished = await this.db.$queryRawUnsafe<any[]>("SELECT COALESCE(SUM(\"quantityOnHand\"),0)::int AS units, COUNT(*) FILTER (WHERE \"quantityOnHand\">0)::int AS lots, COUNT(*) FILTER (WHERE \"quantityOnHand\">0 AND \"expiresAt\" IS NULL)::int AS \"missingExpiry\" FROM \"FinishedGoodsLot\" WHERE \"companyId\"=$1", actor.companyId).catch(() => [{ units: 0, lots: 0, missingExpiry: 0 }]);
    const packaging = await this.db.$queryRawUnsafe<any[]>("SELECT COUNT(*) FILTER (WHERE m.tracked AND (b.\"onHand\"-b.reserved)<=m.\"minimumStock\")::int AS alerts FROM \"PackagingMaterial\" m LEFT JOIN \"PackagingInventoryBalance\" b ON b.\"materialId\"=m.id WHERE m.\"companyId\"=$1 AND m.active=true", actor.companyId).catch(() => [{ alerts: 0 }]);
    return { wip: wip[0], finishedGoods: finished[0], packaging: packaging[0] };
  }

  @Get("wip")
  async wip(@Req() request: any) {
    const actor = await this.actor(request);
    return this.db.$queryRawUnsafe<any[]>("SELECT w.*, po.code AS \"productionOrderCode\", po.\"productName\", po.sku, pb.code AS \"batchCode\" FROM \"RoastedWipLot\" w JOIN \"ProductionOrder\" po ON po.id=w.\"productionOrderId\" JOIN \"ProductionBatch\" pb ON pb.id=w.\"productionBatchId\" WHERE w.\"companyId\"=$1 ORDER BY w.\"producedAt\" DESC", actor.companyId);
  }

  @Get("finished-lots")
  async finishedLots(@Req() request: any) {
    const actor = await this.actor(request);
    return this.db.$queryRawUnsafe<any[]>("SELECT l.*, fp.name, fp.sku, fp.\"packageWeightG\", wh.name AS warehouse, po.code AS \"productionOrderCode\" FROM \"FinishedGoodsLot\" l JOIN \"FinishedProduct\" fp ON fp.id=l.\"finishedProductId\" JOIN \"Warehouse\" wh ON wh.id=l.\"warehouseId\" LEFT JOIN \"ProductionOrder\" po ON po.id=l.\"productionOrderId\" WHERE l.\"companyId\"=$1 ORDER BY l.\"manufacturedAt\" DESC", actor.companyId);
  }

  @Get("packaging")
  async packaging(@Req() request: any) {
    const actor = await this.actor(request);
    return this.db.$queryRawUnsafe<any[]>("SELECT m.*, COALESCE(b.\"onHand\",0)::float AS \"onHand\", COALESCE(b.reserved,0)::float AS reserved, (COALESCE(b.\"onHand\",0)-COALESCE(b.reserved,0))::float AS available FROM \"PackagingMaterial\" m LEFT JOIN \"PackagingInventoryBalance\" b ON b.\"materialId\"=m.id WHERE m.\"companyId\"=$1 AND m.active=true ORDER BY m.category,m.name", actor.companyId).catch(() => []);
  }

  @Post("packaging/:id/stock-in")
  async stockIn(@Param("id") id: string, @Body() body: { quantity: number; unitCost?: number; reason?: string }, @Req() request: any) {
    const actor = await this.actor(request);
    if (!Number.isFinite(body.quantity) || body.quantity <= 0) throw new BadRequestException("Quantidade inválida.");
    return this.db.$transaction(async (tx) => {
      const materials = await tx.$queryRawUnsafe<any[]>("SELECT * FROM \"PackagingMaterial\" WHERE id=$1 AND \"companyId\"=$2", id, actor.companyId);
      if (!materials[0]) throw new BadRequestException("Insumo não encontrado.");
      await tx.$executeRawUnsafe("INSERT INTO \"PackagingInventoryBalance\"(id,\"companyId\",\"materialId\",\"onHand\",\"averageUnitCost\") VALUES($1,$2,$3,$4,$5) ON CONFLICT (\"materialId\") DO UPDATE SET \"onHand\"=\"PackagingInventoryBalance\".\"onHand\"+EXCLUDED.\"onHand\",\"averageUnitCost\"=CASE WHEN EXCLUDED.\"averageUnitCost\">0 THEN EXCLUDED.\"averageUnitCost\" ELSE \"PackagingInventoryBalance\".\"averageUnitCost\" END,\"updatedAt\"=NOW()", `pkgbal-${id}`, actor.companyId, id, body.quantity, Number(body.unitCost ?? 0));
      await tx.$executeRawUnsafe("INSERT INTO \"PackagingMovement\"(id,\"companyId\",\"materialId\",type,quantity,\"unitCost\",reason) VALUES($1,$2,$3,'ENTRY',$4,$5,$6)", `pkgentry-${Date.now()}-${id}`, actor.companyId, id, body.quantity, Number(body.unitCost ?? 0), body.reason ?? "Entrada de estoque");
      return { ok: true };
    });
  }
}
