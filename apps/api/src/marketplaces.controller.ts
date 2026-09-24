import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { MarketplacesService } from "./marketplaces.service";
import { MercadoLivreService } from "./integrations/mercado-livre/mercado-livre.service";

@Controller("marketplaces")
export class MarketplacesController {
  constructor(
    private readonly auth: AuthService,
    private readonly marketplaces: MarketplacesService,
    private readonly mercadoLivre: MercadoLivreService,
  ) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    if (
      !["ADMIN", "EXECUTIVE", "SALES", "MARKETPLACE_OPERATOR"].includes(
        actor.role,
      )
    ) {
      throw new UnauthorizedException(
        "Acesso restrito à operação de marketplaces.",
      );
    }
    return actor;
  }

  private management(actor: any) {
    if (!["ADMIN", "EXECUTIVE"].includes(actor.role)) {
      throw new UnauthorizedException("Ação restrita à gestão da Bispo.");
    }
  }

  @Get("dashboard")
  async dashboard(@Req() request: any) {
    const actor = await this.actor(request);
    return this.marketplaces.dashboard(actor.companyId, actor.id, actor.role);
  }

  @Get("operators")
  async operators(@Req() request: any) {
    const actor = await this.actor(request);
    this.management(actor);
    return {
      accesses: await this.marketplaces.operators(actor.companyId),
      users: await this.marketplaces.availableOperators(actor.companyId),
    };
  }

  @Post("operators")
  async grant(@Req() request: any, @Body() body: any) {
    const actor = await this.actor(request);
    this.management(actor);
    return this.marketplaces.grantAccess(actor.companyId, actor.id, body ?? {});
  }

  @Patch("operators/:id/status")
  async operatorStatus(
    @Req() request: any,
    @Param("id") id: string,
    @Body() body: { active?: boolean },
  ) {
    const actor = await this.actor(request);
    this.management(actor);
    return this.marketplaces.setAccessStatus(
      actor.companyId,
      id,
      body.active !== false,
    );
  }

  @Post("mercado-livre/sync")
  async syncMercadoLivre(@Req() request: any) {
    const actor = await this.actor(request);
    try {
      return await this.mercadoLivre.syncOrders(actor.companyId, "MANUAL");
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Falha ao sincronizar o Mercado Livre.",
      );
    }
  }
}
