import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  UnauthorizedException,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { AuthService } from "./auth.service";

@Controller("brokers")
export class BrokersController {
  private readonly db = new PrismaClient();

  constructor(private readonly auth: AuthService) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  @Get()
  async list(@Req() request: any) {
    const actor = await this.actor(request);
    return this.db.broker.findMany({
      where: { companyId: actor.companyId },
      orderBy: { name: "asc" },
    });
  }

  @Post()
  async create(@Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.actor(request);
    if (!body.name?.trim())
      throw new BadRequestException("Nome do corretor é obrigatório.");
    if (body.taxId) {
      const duplicate = await this.db.broker.findFirst({
        where: { companyId: actor.companyId, taxId: String(body.taxId) },
      });
      if (duplicate)
        throw new BadRequestException(
          "CPF/CNPJ já cadastrado para esta empresa.",
        );
    }
    return this.db.broker.create({
      data: {
        companyId: actor.companyId,
        name: body.name.trim(),
        legalName: body.legalName?.trim() || null,
        tradeName: body.tradeName?.trim() || null,
        taxId: body.taxId?.trim() || null,
        contactName: body.contactName?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        bankDetails: body.bankDetails ?? undefined,
        active: body.active !== false,
      },
    });
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: Record<string, any>,
  ) {
    const actor = await this.actor(request);
    const broker = await this.db.broker.findFirst({
      where: { id, companyId: actor.companyId },
    });
    if (!broker) throw new NotFoundException("Corretor não encontrado.");
    const allowed = [
      "name",
      "legalName",
      "tradeName",
      "taxId",
      "contactName",
      "phone",
      "email",
      "bankDetails",
      "active",
    ];
    const data = Object.fromEntries(
      Object.entries(body).filter(([key]) => allowed.includes(key)),
    );
    if (data.name !== undefined && !String(data.name).trim())
      throw new BadRequestException("Nome do corretor é obrigatório.");
    if (data.taxId && data.taxId !== broker.taxId) {
      const duplicate = await this.db.broker.findFirst({
        where: {
          companyId: actor.companyId,
          taxId: String(data.taxId),
          NOT: { id },
        },
      });
      if (duplicate)
        throw new BadRequestException(
          "CPF/CNPJ já cadastrado para esta empresa.",
        );
    }
    return this.db.broker.update({ where: { id }, data });
  }
}
