import { Controller, Get, Param, Req, UnauthorizedException } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { AuthService } from "./auth.service";

@Controller("finance/sales-schedule")
export class FinanceSalesScheduleController {
  private readonly db=new PrismaClient();
  constructor(private readonly auth:AuthService){}
  private async actor(req:any){const a=await this.auth.resolve(this.auth.readToken(req));if(!a)throw new UnauthorizedException("Sessão inválida.");return a;}

  @Get()
  async list(@Req() req:any){
    const a=await this.actor(req);
    return this.db.$queryRawUnsafe<any[]>("SELECT s.*,so.\"orderNumber\",c.name AS customer FROM \"SalesOrderPaymentSchedule\" s JOIN \"SalesOrder\" so ON so.id=s.\"salesOrderId\" JOIN \"Customer\" c ON c.id=so.\"customerId\" WHERE s.\"companyId\"=$1 AND s.status='OPEN' ORDER BY s.\"dueDate\",s.installment",a.companyId).catch(()=>[]);
  }

  @Get(":orderId")
  async order(@Param("orderId") orderId:string,@Req() req:any){
    const a=await this.actor(req);
    return this.db.$queryRawUnsafe<any[]>("SELECT s.*,so.\"orderNumber\",c.name AS customer FROM \"SalesOrderPaymentSchedule\" s JOIN \"SalesOrder\" so ON so.id=s.\"salesOrderId\" JOIN \"Customer\" c ON c.id=so.\"customerId\" WHERE s.\"companyId\"=$1 AND s.\"salesOrderId\"=$2 ORDER BY s.installment",a.companyId,orderId).catch(()=>[]);
  }
}
