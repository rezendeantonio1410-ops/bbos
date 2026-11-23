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
import { salesPortfolioPartnerId } from "./sales-portfolio";

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

const documentDigits = (value: unknown) =>
  String(value ?? "").replace(/\D/g, "");

const salesCommissionPolicy = (value: Record<string, any>) => {
  const mode = String(value.salesCommissionMode ?? "")
    .trim()
    .toUpperCase();
  if (mode && !["PERCENTAGE", "PER_PACKAGE"].includes(mode)) {
    throw new BadRequestException("Modalidade de comissão inválida.");
  }
  const percent =
    value.salesCommissionPercent === "" || value.salesCommissionPercent == null
      ? null
      : Number(value.salesCommissionPercent);
  const perPackage =
    value.salesCommissionPerPackage === "" ||
    value.salesCommissionPerPackage == null
      ? null
      : Number(value.salesCommissionPerPackage);
  if (
    percent !== null &&
    (!Number.isFinite(percent) || percent < 0 || percent > 100)
  ) {
    throw new BadRequestException(
      "A comissão percentual deve estar entre 0% e 100%.",
    );
  }
  if (perPackage !== null && (!Number.isFinite(perPackage) || perPackage < 0)) {
    throw new BadRequestException(
      "A comissão por pacote não pode ser negativa.",
    );
  }
  return {
    salesCommissionMode: mode || null,
    salesCommissionPercent: mode === "PERCENTAGE" ? percent : null,
    salesCommissionPerPackage: mode === "PER_PACKAGE" ? perPackage : null,
  };
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

  private ensureAdministrator(actor: { role: UserRole | string }) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        "Somente José ou Suzi podem configurar representantes e comissões.",
      );
    }
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
    const partnerScope = salesPortfolioPartnerId(actor);
    const partners = await this.database.$queryRawUnsafe<any[]>(
      `SELECT partner.*, portal.id AS "portalUserId", portal.email AS "portalEmail",
              portal.active AS "portalActive",
              broker.id AS "brokerId", broker.active AS "brokerActive",
              (SELECT COUNT(*)::int FROM "StorefrontPartnerCustomer" link
                WHERE link."partnerId"=partner.id) AS "customerCount"
         FROM "StorefrontPartner" partner
         LEFT JOIN "User" portal ON portal."storefrontPartnerId"=partner.id
         LEFT JOIN "Broker" broker ON broker."businessPartnerId"=partner.id
        WHERE partner."companyId"=$1
          AND ($2::text IS NULL OR partner.id=$2)
        ORDER BY partner.name ASC`,
      actor.companyId,
      partnerScope,
    );
    if (actor.role !== UserRole.SALES) return partners;
    return partners.map((partner) => ({
      id: partner.id,
      name: partner.name,
      tradeName: partner.tradeName,
      active: partner.active,
      isSalesBroker: partner.isSalesBroker,
      brokerId: partner.brokerId,
      brokerActive: partner.brokerActive,
    }));
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
    if (
      !["VIEWER", "SELLER", "SALES_MANAGER", "DISTRIBUTOR"].includes(
        accessLevel,
      )
    ) {
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
      select: { id: true, taxId: true, active: true, isSalesPartner: true },
    });
    if (!partner) throw new BadRequestException("Parceiro não encontrado.");
    if (!partner.active || !partner.isSalesPartner) {
      throw new BadRequestException(
        "Habilite a função Parceiro comercial antes de configurar o portal.",
      );
    }
    const linkedCustomers = customerIds.length
      ? await this.database.$queryRawUnsafe<any[]>(
          `SELECT id,"taxId" FROM "Customer"
          WHERE "companyId"=$1 AND active=true AND id=ANY($2::text[])`,
          actor.companyId,
          customerIds,
        )
      : [];
    if (linkedCustomers.length !== customerIds.length) {
      throw new BadRequestException(
        "Um ou mais clientes selecionados são inválidos ou estão inativos.",
      );
    }
    if (accessLevel === "DISTRIBUTOR") {
      if (customerIds.length !== 1) {
        throw new BadRequestException(
          "Selecione somente o cadastro de cliente do próprio distribuidor.",
        );
      }
      const partnerTaxId = documentDigits(partner.taxId);
      const customerTaxId = documentDigits(linkedCustomers[0]?.taxId);
      if (!partnerTaxId || !customerTaxId || partnerTaxId !== customerTaxId) {
        throw new BadRequestException(
          "O distribuidor deve ser vinculado ao próprio cadastro de cliente, com o mesmo CPF/CNPJ.",
        );
      }
    }
    await this.database.$transaction(async (transaction) => {
      await transaction.$queryRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1))`,
        `${actor.companyId}:customer-tax-id-suggestions`,
      );
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

  /**
   * Rename an existing partner login without resetting its password or
   * disconnecting any customers, drafts or sales orders.
   */
  @Patch(":id/portal-email")
  async updatePortalEmail(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: { email?: unknown },
  ) {
    const actor = await this.actor(request);
    this.ensureAdministrator(actor);
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
      throw new BadRequestException("Informe um endereço de e-mail válido.");
    }
    return this.database.$transaction(async (tx) => {
      const partner = await tx.storefrontPartner.findFirst({
        where: { id, companyId: actor.companyId, active: true },
      });
      if (!partner || !partner.isSalesPartner) {
        throw new BadRequestException("Parceiro comercial ativo não encontrado.");
      }
      const user = await tx.user.findUnique({ where: { storefrontPartnerId: id } });
      if (!user || !user.active || user.companyId !== actor.companyId || user.role !== UserRole.PARTNER) {
        throw new BadRequestException("Acesso ativo do parceiro não encontrado.");
      }
      const owner = await tx.user.findUnique({ where: { email } });
      if (owner && owner.id !== user.id) {
        throw new BadRequestException("E-mail já utilizado por outro usuário do BBOS.");
      }
      const previousPartnerEmail = partner.email;
      const previousLoginEmail = user.email;
      await tx.storefrontPartner.update({ where: { id }, data: { email } });
      await tx.user.update({ where: { id: user.id }, data: { email } });
      // This is a login-identifier correction, not a password reset.
      // Keep the user ID and password hash unchanged.
      return {
        partnerId: partner.id,
        portalUserId: user.id,
        email,
        previousPartnerEmail,
        previousLoginEmail,
        passwordPreserved: true,
      };
    });
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
    this.ensureAdministrator(actor);
    const name = String(body.name ?? "").trim();
    if (!name) throw new BadRequestException("Nome do parceiro é obrigatório.");
    const taxId = String(body.taxId ?? "").replace(/\D/g, "") || null;
    const roles = {
      isSalesPartner: body.isSalesPartner !== false,
      isSalesBroker: body.isSalesBroker === true,
      isGreenCoffeeBroker: body.isGreenCoffeeBroker === true,
    };
    const commissionPolicy = salesCommissionPolicy(body);
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
          ...commissionPolicy,
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
    this.ensureAdministrator(actor);
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
    const commissionPolicy = salesCommissionPolicy(value);
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
          ...commissionPolicy,
        },
      });
      await this.syncBrokerProfile(transaction, partner);
      return partner;
    });
  }
}
