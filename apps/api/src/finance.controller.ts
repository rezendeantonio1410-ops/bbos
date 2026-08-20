import { Body, Controller, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { FinanceService } from "./finance.service";
import { AuthService } from "./auth.service";

@Controller("finance")
export class FinanceController {
  constructor(private readonly finance: FinanceService, private readonly auth: AuthService) {}
  private async actor(req: Request) { const actor = await this.auth.resolve(this.auth.readToken(req)); if (!actor) throw new UnauthorizedException("Sessão inválida."); return actor; }
  @Get("summary") async summary(@Req() req: Request) { return this.finance.summary((await this.actor(req)).companyId); }
  @Get("receivables") async receivables(@Req() req: Request) { return this.finance.listReceivables((await this.actor(req)).companyId); }
  @Get("payables") async payables(@Req() req: Request) { return this.finance.listPayables((await this.actor(req)).companyId); }
  @Get("accounts") async accounts(@Req() req: Request) { return this.finance.listAccounts((await this.actor(req)).companyId); }
  @Post("accounts") async createAccount(@Body() body: { companyId: string; name: string; type: "CASH" | "BANK" | "DIGITAL_ACCOUNT" | "OTHER"; openingBalance?: number }, @Req() req: Request) { body.companyId = (await this.actor(req)).companyId; return this.finance.createAccount(body); }
  @Post("payables") async createPayable(@Body() body: { companyId: string; supplierId?: string; costCenterId?: string; description: string; issueDate: string; dueDate: string; amount: number; category: string; notes?: string }, @Req() req: Request) { body.companyId = (await this.actor(req)).companyId; return this.finance.createPayable(body); }
  @Post("receivables/:id/payments") async receive(@Param("id") id: string, @Body() body: { financialAccountId: string; amount: number; method?: string; idempotencyKey: string }, @Req() req: Request) { return this.finance.receive(id, body, (await this.actor(req)).companyId); }
  @Post("payables/:id/payments") async pay(@Param("id") id: string, @Body() body: { financialAccountId: string; amount: number; method?: string; idempotencyKey: string }, @Req() req: Request) { return this.finance.pay(id, body, (await this.actor(req)).companyId); }
}
