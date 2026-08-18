import { BadRequestException, Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { PrismaClient } from "@bbos/database";
import { AuthService } from "./auth.service";
import { requireSession } from "./auth-context";

type BlendComponentInput = { coffeeLotId: string; percentage: number };

@Controller("blends")
export class BlendsController {
  private readonly db = new PrismaClient();
  constructor(private readonly auth: AuthService) {}

  @Get()
  async list(@Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    return this.db.blend.findMany({ where: { companyId: actor.companyId }, include: { components: { include: { coffeeLot: true } } }, orderBy: [{ active: "desc" }, { name: "asc" }, { version: "desc" }] });
  }

  @Get(":id")
  async get(@Param("id") id: string, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const blend = await this.db.blend.findFirst({ where: { id, companyId: actor.companyId }, include: { components: { include: { coffeeLot: { include: { supplier: true } } } }, productionOrders: true } });
    if (!blend) throw new BadRequestException("Blend não encontrado.");
    return blend;
  }

  @Post()
  async create(@Body() body: { name: string; code: string; version?: number; components: BlendComponentInput[] }, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    if (!body.name?.trim() || !body.code?.trim() || !body.components?.length) throw new BadRequestException("Nome, código e componentes são obrigatórios.");
    const total = body.components.reduce((sum, item) => sum + Number(item.percentage), 0);
    if (Math.abs(total - 100) > 0.01) throw new BadRequestException("A soma dos componentes deve ser 100%.");
    if (body.components.some((item) => item.percentage <= 0) || new Set(body.components.map((item) => item.coffeeLotId)).size !== body.components.length) throw new BadRequestException("Componentes devem ser únicos e maiores que zero.");
    return this.db.$transaction(async (tx) => {
      const lots = await tx.coffeeLot.findMany({ where: { companyId: actor.companyId, id: { in: body.components.map((item) => item.coffeeLotId) }, status: "APPROVED" } });
      if (lots.length !== body.components.length) throw new BadRequestException("Todos os lotes precisam pertencer à empresa e estar liberados pela Qualidade.");
      const blend = await tx.blend.create({ data: { companyId: actor.companyId, name: body.name.trim(), code: body.code.trim(), version: body.version ?? 1, components: { create: body.components.map((item) => ({ coffeeLotId: item.coffeeLotId, percentage: item.percentage })) } }, include: { components: true } });
      return blend;
    });
  }
}
