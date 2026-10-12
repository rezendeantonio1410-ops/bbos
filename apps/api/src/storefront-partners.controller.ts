import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { prisma, UserRole } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { AuthService, hashPassword } from "./auth.service";
import { passwordPolicyError } from "./auth-security";

const internationalPhone = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = `+${raw.replace(/\D/g, "")}`;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized))
    throw new BadRequestException(
      "Telefone inválido. Use o padrão internacional, por exemplo +5543991820201.",
    );
  return normalized;
};

@Controller("storefront/partners")
export class StorefrontPartnersController {
  private readonly database = prisma;
  constructor(private readonly auth: AuthService) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  private ensureOperationalRole(roles: {
    isSalesPartner: boolean;
    isSalesBroker: boolean;
    isGreenCoffeeBroker: boolean;
  }) {
    if (
      !roles.isSalesPartner &&
      !roles.isSalesBroker &&
      !roles.isGreenCoffeeBroker
    ) {
      throw new BadRequestException(
        "Habilite ao menos uma função para o parceiro de negócios.",
      );
    }
  }

  private async syncBrokerProfile(transaction: any, partner: any) {
    const shouldHaveBrokerProfile =
      partner.isSalesBroker || partner.isGreenCoffeeBroker;
    const brokerData = {
      companyId: partner.companyId,
      name: partner.name,
      legalName: partner.legalName,
      tradeName: partner.tradeName,
      taxId: partner.taxId,
      contactName: partner.contactName,
      phone: partner.phone,
      email: partner.email,
      bankDetails: partner.bankDetails ?? undefined,
      active: partner.active && shouldHaveBrokerProfile,
    };
    const current = await transaction.broker.findUnique({
      where: { businessPartnerId: partner.id },
    });
    if (current) {
      await transaction.broker.update({
        where: { id: current.id },
        data: brokerData,
      });
    } else if (shouldHaveBrokerProfile) {
      await transaction.broker.create({
        data: { ...brokerData, businessPartnerId: partner.id },
      });
    }

    if (!partner.active || !partner.isSalesPartner) {
      const portalUsers = await transaction.user.findMany({
        where: { storefrontPartnerId: partner.id, active: true },
        select: { id: true },
      });
      if (portalUsers.length) {
        const userIds = portalUsers.map((user: { id: string }) => user.id);
        await transaction.user.updateMany({
          where: { id: { in: userIds } },
          data: { active: false },
        });
        await transaction.authSession.updateMany({
          where: { userId: { in: userIds }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
  }

  @Get()
  async list(@Req() request: any) {
    const actor = await this.actor(request);
    return this.database.$queryRawUnsafe<any[]>(
      `SELECT partner.*, portal.id AS "portalUserId", portal.email AS "portalEmail",
              portal.active AS "portalActive",
              (SELECT COUNT(*)::int FROM "StorefrontPartnerCustomer" link
                WHERE link."partnerId"=partner.id) AS "customerCount"
         FROM "StorefrontPartner" partner
         LEFT JOIN "User" portal ON portal."storefrontPartnerId"=partner.id
        WHERE partner."companyId"=$1
        ORDER BY partner.name ASC`,
      actor.companyId,
    );
  }

  @Patch(":id/portal-permissions")
  async portalPermissions(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: { accessLevel?: string; customerIds?: string[] },
  ) {
    const actor = await this.actor(request);
    if (actor.role !== "ADMIN") {
      throw new ForbiddenException(
        "Somente administradores podem alterar as permissões do parceiro.",
      );
    }
    const accessLevel = String(body.accessLevel ?? "VIEWER").toUpperCase();
    if (!["VIEWER", "SELLER", "DISTRIBUTOR"].includes(accessLevel)) {
      throw new BadRequestException("Nível de acesso inválido.");
    }
    const customerIds = [
      ...new Set(
        (body.customerIds ?? [])
          .map((value) => String(value).trim())
          .filter(Boolean),
      ),
    ];
    const partner = await this.database.storefrontPartner.findFirst({
      where: { id, companyId: actor.companyId },
      select: { id: true, active: true, isSalesPartner: true },
    });
    if (!partner) throw new BadRequestException("Parceiro não encontrado.");
    if (!partner.active || !partner.isSalesPartner) {
      throw new BadRequestException(
        "Habilite a função Parceiro comercial antes de configurar o portal.",
      );
    }
    if (customerIds.length) {
      const countRows = await this.database.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int AS count FROM "Customer"
          WHERE "companyId"=$1 AND active=true AND id=ANY($2::text[])`,
        actor.companyId,
        customerIds,
      );
      const count = Number(countRows[0]?.count ?? 0);
      if (count !== customerIds.length) {
        throw new BadRequestException(
          "Um ou mais clientes selecionados são inválidos ou estão inativos.",
        );
      }
    }
    await this.database.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        `UPDATE "StorefrontPartner" SET "portalAccessLevel"=$3::"StorefrontPartnerAccessLevel","updatedAt"=NOW()
          WHERE id=$1 AND "companyId"=$2`,
        id,
        actor.companyId,
        accessLevel,
      );
      await transaction.$executeRawUnsafe(
        `DELETE FROM "StorefrontPartnerCustomer" WHERE "partnerId"=$1`,
        id,
      );
      for (const customerId of customerIds) {
        await transaction.$executeRawUnsafe(
          `INSERT INTO "StorefrontPartnerCustomer" ("partnerId","customerId","createdAt")
           VALUES ($1,$2,NOW())`,
          id,
          customerId,
        );
      }
    });
    return { id, accessLevel, customerIds };
  }

  @Get(":id/portal-permissions")
  async getPortalPermissions(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    if (actor.role !== "ADMIN") {
      throw new ForbiddenException(
        "Somente administradores podem consultar as permissões do parceiro.",
      );
    }
    const partners = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,"portalAccessLevel"::text AS "accessLevel"
         FROM "StorefrontPartner" WHERE id=$1 AND "companyId"=$2 LIMIT 1`,
      id,
      actor.companyId,
    );
    if (!partners[0]) throw new BadRequestException("Parceiro não encontrado.");
    const links = await this.database.$queryRawUnsafe<any[]>(
      `SELECT "customerId" FROM "StorefrontPartnerCustomer" WHERE "partnerId"=$1`,
      id,
    );
    return {
      ...partners[0],
      customerIds: links.map((link) => link.customerId),
    };
  }

  @Post(":id/portal-access")
  async portalAccess(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: { email?: string; password?: string },
  ) {
    const actor = await this.actor(request);
    if (actor.role !== "ADMIN")
      throw new ForbiddenException(
        "Somente administradores podem liberar o portal.",
      );
    const partner = await this.database.storefrontPartner.findFirst({
      where: { id, companyId: actor.companyId },
    });
    if (!partner) throw new BadRequestException("Parceiro não encontrado.");
    if (!partner.active)
      throw new BadRequestException(
        "Ative o parceiro antes de liberar o portal.",
      );
    if (!partner.isSalesPartner)
      throw new BadRequestException(
        "Habilite a função Parceiro comercial antes de liberar o portal.",
      );

    const email = String(body.email ?? partner.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email))
      throw new BadRequestException("Informe um e-mail válido para o portal.");
    const passwordError = passwordPolicyError(password);
    if (passwordError) throw new BadRequestException(passwordError);

    const [linkedUser, emailOwner] = await Promise.all([
      this.database.user.findUnique({ where: { storefrontPartnerId: id } }),
      this.database.user.findUnique({ where: { email } }),
    ]);
    if (emailOwner && emailOwner.id !== linkedUser?.id)
      throw new BadRequestException(
        "Este e-mail já pertence a outro acesso do BBOS.",
      );

    const data = {
      companyId: actor.companyId,
      storefrontPartnerId: partner.id,
      name: partner.contactName?.trim() || partner.name,
      email,
      passwordHash: hashPassword(password),
      role: UserRole.PARTNER,
      active: true,
    };
    const user = linkedUser
      ? await this.database.user.update({ where: { id: linkedUser.id }, data })
      : await this.database.user.create({ data });
    if (linkedUser) {
      await this.database.authSession.updateMany({
        where: { userId: linkedUser.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return {
      id: user.id,
      email: user.email,
      active: user.active,
      partnerId: partner.id,
    };
  }

  @Patch(":id/portal-access/status")
  async portalAccessStatus(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: { active?: boolean },
  ) {
    const actor = await this.actor(request);
    if (actor.role !== "ADMIN")
      throw new ForbiddenException(
        "Somente administradores podem alterar o portal.",
      );
    const user = await this.database.user.findFirst({
      where: { companyId: actor.companyId, storefrontPartnerId: id },
    });
    if (!user)
      throw new BadRequestException("Acesso do parceiro não encontrado.");
    const updated = await this.database.user.update({
      where: { id: user.id },
      data: { active: body.active !== false },
    });
    if (!updated.active) {
      await this.database.authSession.updateMany({
        where: { userId: updated.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { id: updated.id, email: updated.email, active: updated.active };
  }

  @Post()
  async create(@Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.actor(request);
    const name = String(body.name ?? "").trim();
    if (!name) throw new BadRequestException("Nome do parceiro é obrigatório.");
    const taxId = String(body.taxId ?? "").replace(/\D/g, "") || null;
    const roles = {
      isSalesPartner: body.isSalesPartner !== false,
      isSalesBroker: body.isSalesBroker === true,
      isGreenCoffeeBroker: body.isGreenCoffeeBroker === true,
    };
    this.ensureOperationalRole(roles);
    if (taxId) {
      const duplicate = await this.database.storefrontPartner.findFirst({
        where: { companyId: actor.companyId, taxId },
        select: { id: true },
      });
      if (duplicate)
        throw new BadRequestException(
          "CPF/CNPJ já cadastrado para outro parceiro.",
        );
    }
    return this.database.$transaction(async (transaction) => {
      const partner = await transaction.storefrontPartner.create({
        data: {
          id: randomUUID(),
          companyId: actor.companyId,
          name,
          legalName: String(body.legalName ?? "").trim() || null,
          tradeName: String(body.tradeName ?? "").trim() || null,
          taxId,
          contactName: String(body.contactName ?? "").trim() || null,
          phone: internationalPhone(body.phone),
          email: String(body.email ?? "").trim() || null,
          pixKey: String(body.pixKey ?? "").trim() || null,
          active: body.active !== false,
          ...roles,
        },
      });
      await this.syncBrokerProfile(transaction, partner);
      return partner;
    });
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: Record<string, any>,
  ) {
    const actor = await this.actor(request);
    const current = await this.database.storefrontPartner.findFirst({
      where: { id, companyId: actor.companyId },
    });
    if (!current) throw new BadRequestException("Parceiro não encontrado.");
    const value = { ...current, ...body };
    const name = String(value.name ?? "").trim();
    if (!name) throw new BadRequestException("Nome do parceiro é obrigatório.");
    const taxId = String(value.taxId ?? "").replace(/\D/g, "") || null;
    const roles = {
      isSalesPartner: value.isSalesPartner !== false,
      isSalesBroker: value.isSalesBroker === true,
      isGreenCoffeeBroker: value.isGreenCoffeeBroker === true,
    };
    this.ensureOperationalRole(roles);
    if (taxId) {
      const duplicate = await this.database.storefrontPartner.findFirst({
        where: {
          companyId: actor.companyId,
          taxId,
          NOT: { id },
        },
        select: { id: true },
      });
      if (duplicate)
        throw new BadRequestException(
          "CPF/CNPJ já cadastrado para outro parceiro.",
        );
    }
    return this.database.$transaction(async (transaction) => {
      const partner = await transaction.storefrontPartner.update({
        where: { id },
        data: {
          name,
          legalName: String(value.legalName ?? "").trim() || null,
          tradeName: String(value.tradeName ?? "").trim() || null,
          taxId,
          contactName: String(value.contactName ?? "").trim() || null,
          phone: internationalPhone(value.phone),
          email: String(value.email ?? "").trim() || null,
          pixKey: String(value.pixKey ?? "").trim() || null,
          active: value.active !== false,
          ...roles,
        },
      });
      await this.syncBrokerProfile(transaction, partner);
      return partner;
    });
  }
}
