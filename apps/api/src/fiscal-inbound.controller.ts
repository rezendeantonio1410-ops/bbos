import { BadRequestException, Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { requireSession } from "./auth-context";
import { FiscalInboundService } from "./fiscal-inbound.service";

@Controller("fiscal-inbound")
export class FiscalInboundController {
  constructor(private readonly auth: AuthService, private readonly fiscal: FiscalInboundService) {}

  @Get()
  async list(@Req() request: Request) {
    const actor = await requireSession(request, this.auth);
    return this.fiscal.list(actor.companyId);
  }

  @Get(":id")
  async detail(@Req() request: Request, @Param("id") id: string) {
    const actor = await requireSession(request, this.auth);
    return this.fiscal.detail(actor.companyId, id);
  }

  @Post("import-xml")
  async importXml(@Req() request: Request, @Body() body: { xmlContent?: string }) {
    const actor = await requireSession(request, this.auth);
    if (!body.xmlContent?.trim()) throw new BadRequestException("Selecione o XML autorizado da NF-e.");
    return this.fiscal.importXml(actor.companyId, actor, body.xmlContent, "MANUAL_UPLOAD");
  }

  @Post("sync")
  async sync(@Req() request: Request) {
    const actor = await requireSession(request, this.auth);
    return this.fiscal.sync(actor.companyId, actor);
  }

  @Post(":id/match-purchase")
  async matchPurchase(@Req() request: Request, @Param("id") id: string, @Body() body: { purchaseId?: string }) {
    const actor = await requireSession(request, this.auth);
    if (!body.purchaseId) throw new BadRequestException("Selecione a compra que corresponde à NF-e.");
    return this.fiscal.matchPurchase(actor.companyId, actor, id, body.purchaseId);
  }

  @Post(":id/allocate-item")
  async allocateItem(@Req() request: Request, @Param("id") id: string, @Body() body: { itemId?: string; allocationType?: string; purchaseId?: string; costCenterId?: string; targetReferenceId?: string; category?: string; description?: string }) {
    const actor = await requireSession(request, this.auth);
    return this.fiscal.allocateItem(actor.companyId, actor, id, body);
  }
}
