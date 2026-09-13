import { Controller, Get, Req, UnauthorizedException } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { AuthService } from "./auth.service";

@Controller("production-requirements")
export class ProductionRequirementsController {
  private readonly db=new PrismaClient();
  constructor(private readonly auth:AuthService){}
  private async actor(req:any){const a=await this.auth.resolve(this.auth.readToken(req));if(!a)throw new UnauthorizedException("Sessão inválida.");return a;}
  @Get()
  async list(@Req() req:any){
    const a=await this.actor(req);
    return this.db.$queryRawUnsafe<any[]>("SELECT r.*,p.name,pv.sku,pv.\"netWeightGrams\" FROM \"ProductionRequirement\" r JOIN \"ProductVariant\" pv ON pv.id=r.\"productVariantId\" JOIN \"Product\" p ON p.id=pv.\"productId\" WHERE r.\"companyId\"=$1 AND r.status IN ('OPEN','PLANNED') ORDER BY r.\"createdAt\" DESC",a.companyId).catch(()=>[]);
  }
}
