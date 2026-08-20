import { Body, Controller, Get, Param, Post, Query, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { ReconciliationService } from "./reconciliation.service";
import { AuthService } from "./auth.service";

@Controller("finance/reconciliation")
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService, private readonly auth: AuthService) {}
  private async actor(req: Request) { const actor = await this.auth.resolve(this.auth.readToken(req)); if (!actor) throw new UnauthorizedException("Sessão inválida."); return actor; }

  @Get("summary") async summary(@Query() query: Parameters<ReconciliationService["summary"]>[0], @Req() req: Request) { return this.reconciliation.summary({ ...query, companyId: (await this.actor(req)).companyId }); }
  @Get("pending") async pending(@Query() query: { companyId?: string; from?: string; to?: string }, @Req() req: Request) { return this.reconciliation.list({ ...query, companyId: (await this.actor(req)).companyId, status: "PENDING" }); }
  @Get("accounts") async accounts(@Query("companyId") _companyId: string | undefined, @Req() req: Request) { return this.reconciliation.accounts((await this.actor(req)).companyId); }
  @Get("institutions") async institutions(@Query("companyId") _companyId: string | undefined, @Req() req: Request) { return this.reconciliation.institutions((await this.actor(req)).companyId); }
  @Get("bank-transactions") async bankTransactions(@Query() query: { companyId?: string; financialAccountId?: string; currency?: string; status?: "PENDING" | "MATCHED" | "PARTIALLY_MATCHED" | "DIVERGENT" | "IGNORED" }, @Req() req: Request) { return this.reconciliation.bankTransactions({ ...query, companyId: (await this.actor(req)).companyId }); }
  @Get() async list(@Query() query: Parameters<ReconciliationService["list"]>[0], @Req() req: Request) { return this.reconciliation.list({ ...query, companyId: (await this.actor(req)).companyId }); }
  @Post() async create(@Body() body: Parameters<ReconciliationService["create"]>[0], @Req() req: Request) { body.companyId = (await this.actor(req)).companyId; return this.reconciliation.create(body); }
  @Post("bank-transactions") async importBankTransaction(@Body() body: Parameters<ReconciliationService["importBankTransaction"]>[0], @Req() req: Request) { body.companyId = (await this.actor(req)).companyId; return this.reconciliation.importBankTransaction(body); }
  @Post("import") async importStatement(@Body() body: Parameters<ReconciliationService["importStatement"]>[0], @Req() req: Request) { body.companyId = (await this.actor(req)).companyId; return this.reconciliation.importStatement(body); }
  @Get(":id/suggestions") async suggestions(@Param("id") id: string, @Req() req: Request) { return this.reconciliation.suggestions(id, (await this.actor(req)).companyId); }
  @Post(":id/match") async match(@Param("id") id: string, @Body() body: { financialTransactionId: string; matchedAmount?: number }, @Req() req: Request) { return this.reconciliation.match(id, body.financialTransactionId, body.matchedAmount, (await this.actor(req)).companyId); }
  @Post(":id/auto-match") async autoMatch(@Param("id") id: string, @Req() req: Request) { return this.reconciliation.autoMatch(id, (await this.actor(req)).companyId); }
  @Post(":id/unmatch") async unmatch(@Param("id") id: string, @Req() req: Request) { return this.reconciliation.unmatch(id, (await this.actor(req)).companyId); }
  @Post(":id/ignore") async ignore(@Param("id") id: string, @Req() req: Request) { return this.reconciliation.ignore(id, (await this.actor(req)).companyId); }
}
