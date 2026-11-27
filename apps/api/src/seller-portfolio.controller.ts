import { BadRequestException, Controller, Get, Header, Query, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { salesPortfolioPartnerId } from "./sales-portfolio";
import { SellerPortfolioService } from "./seller-portfolio.service";

/** Tela "Minha carteira" do vendedor. A liderança pode abrir a carteira de um vendedor (?partnerId=). */
@Controller("seller-portfolio")
export class SellerPortfolioController {
  constructor(
    private readonly auth: AuthService,
    private readonly portfolios: SellerPortfolioService,
  ) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  async portfolio(@Req() req: Request, @Query("partnerId") partnerId?: string) {
    const actor = await this.auth.resolve(this.auth.readToken(req));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    const own = salesPortfolioPartnerId(actor as never);
    const target = own ?? String(partnerId ?? "").trim();
    if (!target) throw new BadRequestException("Escolha o vendedor.");
    return { generatedAt: new Date().toISOString(), ...(await this.portfolios.portfolio(actor.companyId, target)) };
  }
}
