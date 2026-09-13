import { Controller, Get, Req, UnauthorizedException } from "@nestjs/common";
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
    return { wip: wip[0], finishedGoods: finished[0] };
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
}
