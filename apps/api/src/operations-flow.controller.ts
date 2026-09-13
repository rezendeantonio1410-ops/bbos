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
}
