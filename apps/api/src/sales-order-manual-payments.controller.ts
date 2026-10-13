import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SalesOrderPaymentsService } from "./sales-order-payments.service";

@Controller("sales-orders/:id/manual-pix")
export class SalesOrderManualPaymentsController {
  constructor(
    private readonly auth: AuthService,
    private readonly payments: SalesOrderPaymentsService,
  ) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  @Get()
  async info(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    return this.payments.manualPixInfo(actor.companyId, id);
  }

  @Post("confirm")
  async confirm(
    @Param("id") id: string,
    @Body()
    body: {
      financialAccountId: string;
      reference: string;
      paidAt?: string;
    },
    @Req() request: any,
  ) {
    return this.payments.confirmManualPix(id, body, await this.actor(request));
  }
}
