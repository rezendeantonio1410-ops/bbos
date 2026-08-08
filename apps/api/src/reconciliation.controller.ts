import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ReconciliationService } from "./reconciliation.service";

@Controller("finance/reconciliation")
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Get("summary") summary(@Query() query: { companyId?: string; from?: string; to?: string }) { return this.reconciliation.summary(query); }
  @Get("pending") pending(@Query() query: { companyId?: string; from?: string; to?: string }) { return this.reconciliation.list({ ...query, status: "PENDING" }); }
  @Get("accounts") accounts(@Query("companyId") companyId?: string) { return this.reconciliation.accounts(companyId); }
  @Get("institutions") institutions(@Query("companyId") companyId?: string) { return this.reconciliation.institutions(companyId); }
  @Get("bank-transactions") bankTransactions(@Query() query: { companyId?: string; financialAccountId?: string; currency?: string; status?: "PENDING" | "MATCHED" | "PARTIALLY_MATCHED" | "DIVERGENT" | "IGNORED" }) { return this.reconciliation.bankTransactions(query); }
  @Get() list(@Query() query: { companyId?: string; financialAccountId?: string; currency?: string; status?: "PENDING" | "MATCHED" | "PARTIALLY_MATCHED" | "DIVERGENT" | "IGNORED"; direction?: "IN" | "OUT"; from?: string; to?: string }) { return this.reconciliation.list(query); }
  @Post() create(@Body() body: Parameters<ReconciliationService["create"]>[0]) { return this.reconciliation.create(body); }
  @Post("bank-transactions") importBankTransaction(@Body() body: Parameters<ReconciliationService["importBankTransaction"]>[0]) { return this.reconciliation.importBankTransaction(body); }
  @Post(":id/match") match(@Param("id") id: string, @Body() body: { financialTransactionId: string; matchedAmount?: number }) { return this.reconciliation.match(id, body.financialTransactionId, body.matchedAmount); }
  @Post(":id/auto-match") autoMatch(@Param("id") id: string) { return this.reconciliation.autoMatch(id); }
  @Post(":id/unmatch") unmatch(@Param("id") id: string) { return this.reconciliation.unmatch(id); }
  @Post(":id/ignore") ignore(@Param("id") id: string) { return this.reconciliation.ignore(id); }
}
