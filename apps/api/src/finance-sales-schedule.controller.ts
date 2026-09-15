import {
  Controller,
  Get,
  Param,
  Req,
  UnauthorizedException,
  type OnModuleDestroy,
} from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { AuthService } from "./auth.service";

@Controller("finance/sales-schedule")
export class FinanceSalesScheduleController implements OnModuleDestroy {
  private readonly db = new PrismaClient();

  constructor(private readonly auth: AuthService) {}

  onModuleDestroy() {
    return this.db.$disconnect();
  }

  private async actor(req: any) {
    const actor = await this.auth.resolve(this.auth.readToken(req));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  @Get()
  async list(@Req() req: any) {
    const actor = await this.actor(req);
    return this.db.$queryRawUnsafe<any[]>(
      `SELECT s.*, so."orderNumber", c.name AS customer
         FROM "SalesOrderPaymentSchedule" s
         JOIN "SalesOrder" so ON so.id = s."salesOrderId"
         JOIN "Customer" c ON c.id = so."customerId"
        WHERE s."companyId" = $1
          AND s.status = 'OPEN'
        ORDER BY s."dueDate", s.installment`,
      actor.companyId,
    );
  }

  @Get(":orderId")
  async order(@Param("orderId") orderId: string, @Req() req: any) {
    const actor = await this.actor(req);
    return this.db.$queryRawUnsafe<any[]>(
      `SELECT s.*, so."orderNumber", c.name AS customer
         FROM "SalesOrderPaymentSchedule" s
         JOIN "SalesOrder" so ON so.id = s."salesOrderId"
         JOIN "Customer" c ON c.id = so."customerId"
        WHERE s."companyId" = $1
          AND s."salesOrderId" = $2
        ORDER BY s.installment`,
      actor.companyId,
      orderId,
    );
  }
}
