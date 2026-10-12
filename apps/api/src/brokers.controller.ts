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
  Query,
  Req,
} from "@nestjs/common";
import { prisma } from "@bbos/database";
import { AuthService } from "./auth.service";

@Controller("brokers")
export class BrokersController {
  private readonly db = prisma;

  constructor(private readonly auth: AuthService) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  @Get()
  async list(@Req() request: any, @Query("role") role?: string) {
    const actor = await this.actor(request);
    const normalizedRole = String(role ?? "").toUpperCase();
    const brokers = await this.db.broker.findMany({
      where: {
        companyId: actor.companyId,
        ...(normalizedRole === "SALES"
          ? { businessPartner: { isSalesBroker: true } }
          : normalizedRole === "GREEN_COFFEE"
            ? { businessPartner: { isGreenCoffeeBroker: true } }
            : {}),
      },
      include: { businessPartner: true },
      orderBy: { name: "asc" },
    });
    return brokers.map((broker) => ({
      ...broker,
      name: broker.businessPartner?.name ?? broker.name,
      legalName: broker.businessPartner?.legalName ?? broker.legalName,
      tradeName: broker.businessPartner?.tradeName ?? broker.tradeName,
      taxId: broker.businessPartner?.taxId ?? broker.taxId,
      contactName: broker.businessPartner?.contactName ?? broker.contactName,
      phone: broker.businessPartner?.phone ?? broker.phone,
      email: broker.businessPartner?.email ?? broker.email,
      active: Boolean(broker.businessPartner?.active ?? true) && broker.active,
      isSalesBroker: broker.businessPartner?.isSalesBroker ?? true,
      isGreenCoffeeBroker: broker.businessPartner?.isGreenCoffeeBroker ?? true,
    }));
  }

  @Post()
  async create(@Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.actor(request);
    if (!body.name?.trim())
      throw new BadRequestException("Nome do corretor é obrigatório.");
    const taxId = String(body.taxId ?? "").replace(/\D/g, "") || null;
    return this.db.$transaction(async (transaction) => {
      let partner = taxId
        ? await transaction.storefrontPartner.findFirst({
            where: { companyId: actor.companyId, taxId },
          })
        : null;
      if (partner) {
        const existingProfile = await transaction.broker.findUnique({
          where: { businessPartnerId: partner.id },
          select: { id: true },
        });
        if (existingProfile)
          throw new BadRequestException(
            "Este parceiro já está habilitado como corretor.",
          );
      }
      partner = partner
        ? await transaction.storefrontPartner.update({
            where: { id: partner.id },
            data: { isGreenCoffeeBroker: true, active: body.active !== false },
          })
        : await transaction.storefrontPartner.create({
            data: {
              companyId: actor.companyId,
              name: body.name.trim(),
              legalName: body.legalName?.trim() || null,
              tradeName: body.tradeName?.trim() || null,
              taxId,
              contactName: body.contactName?.trim() || null,
              phone: body.phone?.trim() || null,
              email: body.email?.trim() || null,
              bankDetails: body.bankDetails ?? undefined,
              active: body.active !== false,
              isSalesPartner: false,
              isGreenCoffeeBroker: true,
            },
          });
      if (!partner)
        throw new BadRequestException("Não foi possível criar o parceiro.");
      return transaction.broker.create({
        data: {
          businessPartnerId: partner.id,
          companyId: actor.companyId,
          name: partner.name,
          legalName: partner.legalName,
          tradeName: partner.tradeName,
          taxId: partner.taxId,
          contactName: partner.contactName,
          phone: partner.phone,
          email: partner.email,
          bankDetails: partner.bankDetails ?? undefined,
          active: partner.active,
        },
      });
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
      include: { businessPartner: true },
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
    if (!broker.businessPartnerId)
      return this.db.broker.update({ where: { id }, data });
    return this.db.$transaction(async (transaction) => {
      const partner = await transaction.storefrontPartner.update({
        where: { id: broker.businessPartnerId! },
        data: {
          name: data.name,
          legalName: data.legalName,
          tradeName: data.tradeName,
          taxId:
            data.taxId === undefined
              ? undefined
              : String(data.taxId).replace(/\D/g, "") || null,
          contactName: data.contactName,
          phone: data.phone,
          email: data.email,
          bankDetails: data.bankDetails,
          active: data.active,
          isGreenCoffeeBroker: true,
        },
      });
      return transaction.broker.update({
        where: { id },
        data: {
          name: partner.name,
          legalName: partner.legalName,
          tradeName: partner.tradeName,
          taxId: partner.taxId,
          contactName: partner.contactName,
          phone: partner.phone,
          email: partner.email,
          bankDetails: partner.bankDetails ?? undefined,
          active: partner.active,
        },
      });
    });
  }
}
