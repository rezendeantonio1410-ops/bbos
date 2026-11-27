import { BadRequestException, Body, Controller, Get, Header, Put, Query, Req, UnauthorizedException } from "@nestjs/common";
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

  /** Metas dos vendedores num mês (liderança, tela de Parceiros). */
  @Get("goals")
  @Header("Cache-Control", "private, no-store")
  async goals(@Req() req: Request, @Query("month") month?: string) {
    const actor = await this.auth.resolve(this.auth.readToken(req));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    const key = String(month ?? "").trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) throw new BadRequestException("Mês inválido (use AAAA-MM).");
    return this.portfolios.goals(actor.companyId, key);
  }

  /** Define a meta do vendedor (R$ e kg) de um mês. Só a liderança. */
  @Put("goal")
  async saveGoal(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const actor = await this.auth.resolve(this.auth.readToken(req));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    try {
      return await this.portfolios.saveGoal(actor.companyId, body, String(actor.name ?? ""));
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Meta inválida.");
    }
  }
}
