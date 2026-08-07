import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { FinanceService } from "./finance.service";

@Controller("finance")
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}
  @Get("summary") summary() { return this.finance.summary(); }
  @Get("receivables") receivables() { return this.finance.listReceivables(); }
  @Get("payables") payables() { return this.finance.listPayables(); }
  @Get("accounts") accounts() { return this.finance.listAccounts(); }
  @Post("accounts") createAccount(@Body() body: { companyId: string; name: string; type: "CASH" | "BANK" | "DIGITAL_ACCOUNT" | "OTHER"; openingBalance?: number }) { return this.finance.createAccount(body); }
  @Post("payables") createPayable(@Body() body: { companyId: string; supplierId?: string; costCenterId?: string; description: string; issueDate: string; dueDate: string; amount: number; category: string; notes?: string }) { return this.finance.createPayable(body); }
  @Post("receivables/:id/payments") receive(@Param("id") id: string, @Body() body: { financialAccountId: string; amount: number; method?: string; idempotencyKey: string }) { return this.finance.receive(id, body); }
  @Post("payables/:id/payments") pay(@Param("id") id: string, @Body() body: { financialAccountId: string; amount: number; method?: string; idempotencyKey: string }) { return this.finance.pay(id, body); }
}
