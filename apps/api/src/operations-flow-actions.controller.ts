import { BadRequestException, Body, Controller, Param, Patch, Post, Req, UnauthorizedException } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { AuthService } from "./auth.service";

@Controller("operations-flow")
export class OperationsFlowActionsController {
  private readonly db = new PrismaClient();
  constructor(private readonly auth: AuthService) {}
  private async actor(request:any){const a=await this.auth.resolve(this.auth.readToken(request));if(!a)throw new UnauthorizedException("Sessão inválida.");return a;}

  @Patch("finished-lots/:id/expiry")
  async expiry(@Param("id") id:string,@Body() body:{expiresAt:string},@Req() req:any){
    const actor=await this.actor(req);const date=new Date(body.expiresAt);if(Number.isNaN(date.getTime()))throw new BadRequestException("Validade inválida.");
    const rows=await this.db.$queryRawUnsafe<any[]>("UPDATE \"FinishedGoodsLot\" SET \"expiresAt\"=$3,\"updatedAt\"=NOW() WHERE id=$1 AND \"companyId\"=$2 RETURNING *",id,actor.companyId,date);
    if(!rows[0])throw new BadRequestException("Lote não encontrado.");return rows[0];
  }

  @Patch("packaging/:id/configure")
  async packaging(@Param("id") id:string,@Body() body:{tracked:boolean;minimumStock:number;targetStock:number},@Req() req:any){
    const actor=await this.actor(req);if([body.minimumStock,body.targetStock].some(v=>!Number.isFinite(v)||v<0))throw new BadRequestException("Parâmetros inválidos.");
    const rows=await this.db.$queryRawUnsafe<any[]>("UPDATE \"PackagingMaterial\" SET tracked=$3,\"minimumStock\"=$4,\"targetStock\"=$5,\"updatedAt\"=NOW() WHERE id=$1 AND \"companyId\"=$2 RETURNING *",id,actor.companyId,body.tracked,body.minimumStock,body.targetStock);
    if(!rows[0])throw new BadRequestException("Insumo não encontrado.");return rows[0];
  }

  @Post("demand/:productVariantId/requirement")
  async requirement(@Param("productVariantId") productVariantId:string,@Body() body:{recommendedUnits:number;uncoveredDemand:number;availableUnits:number;targetUnits:number},@Req() req:any){
    const actor=await this.actor(req);if(!Number.isSafeInteger(body.recommendedUnits)||body.recommendedUnits<=0)throw new BadRequestException("Quantidade recomendada inválida.");
    const id=`req-${Date.now()}-${productVariantId}`;
    await this.db.$executeRawUnsafe("INSERT INTO \"ProductionRequirement\"(id,\"companyId\",\"productVariantId\",\"recommendedUnits\",\"uncoveredDemand\",\"availableUnits\",\"targetUnits\",\"createdByUserId\",\"createdByName\") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",id,actor.companyId,productVariantId,body.recommendedUnits,body.uncoveredDemand,body.availableUnits,body.targetUnits,actor.userId,actor.userName);
    return {id,status:"OPEN"};
  }
}
