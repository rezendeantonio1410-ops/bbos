import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { AuthService } from "./auth.service";

const CREDIT_STATUSES = ["NOT_ANALYZED", "UNDER_REVIEW", "APPROVED", "REJECTED"] as const;

@Controller("customers")
export class CustomersController {
  private readonly db = new PrismaClient();

  constructor(private readonly auth: AuthService) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  private async health(companyId: string, customerId?: string) {
    return this.db.$queryRawUnsafe<any[]>(
      `SELECT c.id,
              COALESCE(SUM(CASE WHEN ar.status NOT IN ('PAID','CANCELLED') THEN ar."openAmount" ELSE 0 END),0)::numeric AS "openReceivables",
              COALESCE(SUM(CASE WHEN ar.status NOT IN ('PAID','CANCELLED') AND ar."dueDate" < NOW() AND ar."openAmount" > 0 THEN ar."openAmount" ELSE 0 END),0)::numeric AS "overdueAmount",
              COUNT(CASE WHEN ar.status NOT IN ('PAID','CANCELLED') AND ar."dueDate" < NOW() AND ar."openAmount" > 0 THEN 1 END)::int AS "overdueCount",
              COALESCE(MAX(CASE WHEN ar.status NOT IN ('PAID','CANCELLED') AND ar."dueDate" < NOW() AND ar."openAmount" > 0 THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - ar."dueDate"))/86400) END),0)::int AS "maxDaysOverdue"
         FROM "Customer" c
         LEFT JOIN "AccountsReceivable" ar ON ar."customerId" = c.id
        WHERE c."companyId" = $1 ${customerId ? "AND c.id = $2" : ""}
        GROUP BY c.id`,
      ...(customerId ? [companyId, customerId] : [companyId]),
    );
  }

  private decorate(customer: any, financial: any) {
    const openReceivables = Number(financial?.openReceivables ?? 0);
    const overdueAmount = Number(financial?.overdueAmount ?? 0);
    const overdueCount = Number(financial?.overdueCount ?? 0);
    const maxDaysOverdue = Number(financial?.maxDaysOverdue ?? 0);
    const creditLimit = Number(customer.creditLimit ?? 0);
    const availableCredit = Math.max(0, creditLimit - openReceivables);

    let health = "HEALTHY";
    let guidance = "Cliente em dia. Nenhuma pendência financeira encontrada.";
    if (overdueCount > 0) {
      health = maxDaysOverdue >= 30 ? "BLOCKED" : "ATTENTION";
      guidance = maxDaysOverdue >= 30
        ? `Há ${overdueCount} título(s) vencido(s), com atraso de até ${maxDaysOverdue} dias. Venda a prazo exige análise.`
        : `Há ${overdueCount} título(s) vencido(s), com atraso de até ${maxDaysOverdue} dias. Revise antes de vender a prazo.`;
    } else if (customer.creditStatus === "UNDER_REVIEW") {
      health = "ATTENTION";
      guidance = "Análise de crédito em andamento. Venda à vista pode seguir normalmente.";
    } else if (customer.creditStatus === "REJECTED") {
      health = "BLOCKED";
      guidance = "Crédito não aprovado. Venda a prazo deve permanecer bloqueada.";
    } else if (customer.creditStatus === "NOT_ANALYZED") {
      health = "INFO";
      guidance = "Cliente ainda sem análise de crédito. Venda à vista pode seguir; venda a prazo deve solicitar análise.";
    }

    return {
      ...customer,
      financialHealth: {
        health,
        guidance,
        openReceivables,
        overdueAmount,
        overdueCount,
        maxDaysOverdue,
        availableCredit,
      },
    };
  }

  @Get()
  async list(@Req() request: any) {
    const actor = await this.actor(request);
    const [customers, health] = await Promise.all([
      this.db.$queryRawUnsafe<any[]>(
        `SELECT id, "companyId", name, "legalName", "tradeName", "taxId", segment,
                email, phone, "postalCode", address, district, city, state,
                "paymentTerms", active, "creditStatus", "creditLimit", "creditNotes",
                "creditReviewedAt", "creditReviewedBy", "createdAt", "updatedAt"
           FROM "Customer"
          WHERE "companyId" = $1
          ORDER BY name ASC`,
        actor.companyId,
      ),
      this.health(actor.companyId),
    ]);
    const byId = new Map(health.map((item) => [item.id, item]));
    return customers.map((customer) => this.decorate(customer, byId.get(customer.id)));
  }

  @Get(":id/health")
  async getHealth(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    const customer = (await this.db.$queryRawUnsafe<any[]>(
      `SELECT id, name, "tradeName", "creditStatus", "creditLimit", "paymentTerms"
         FROM "Customer" WHERE id=$1 AND "companyId"=$2`, id, actor.companyId,
    ))[0];
    if (!customer) throw new NotFoundException("Cliente não encontrado.");
    const financial = (await this.health(actor.companyId, id))[0];
    return this.decorate(customer, financial);
  }

  @Post()
  async create(@Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.actor(request);
    const name = String(body.name ?? body.tradeName ?? body.legalName ?? "").trim();
    if (!name) throw new BadRequestException("Nome do cliente é obrigatório.");
    const taxId = body.taxId ? String(body.taxId).trim() : null;
    if (taxId) {
      const duplicate = await this.db.customer.findFirst({ where: { companyId: actor.companyId, taxId } });
      if (duplicate) throw new BadRequestException("CPF/CNPJ já cadastrado para esta empresa.");
    }
    const id = randomUUID();
    const rows = await this.db.$queryRawUnsafe<any[]>(
      `INSERT INTO "Customer"
        (id, "companyId", name, "legalName", "tradeName", "taxId", segment,
         email, phone, "postalCode", address, district, city, state,
         "paymentTerms", active, "creditStatus", "creditLimit", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'NOT_ANALYZED',0,NOW(),NOW())
       RETURNING *`,
      id, actor.companyId, name,
      body.legalName?.trim() || null, body.tradeName?.trim() || null, taxId,
      body.segment?.trim() || null, body.email?.trim() || null, body.phone?.trim() || null,
      body.postalCode?.trim() || null, body.address?.trim() || null, body.district?.trim() || null,
      body.city?.trim() || null, body.state?.trim() || null, body.paymentTerms?.trim() || null,
      body.active !== false,
    );
    return this.decorate(rows[0], null);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.actor(request);
    const existing = await this.db.customer.findFirst({ where: { id, companyId: actor.companyId } });
    if (!existing) throw new NotFoundException("Cliente não encontrado.");
    const current = (await this.db.$queryRawUnsafe<any[]>(`SELECT * FROM "Customer" WHERE id=$1 AND "companyId"=$2`, id, actor.companyId))[0];
    const name = String(body.name ?? current.name).trim();
    if (!name) throw new BadRequestException("Nome do cliente é obrigatório.");
    const taxId = body.taxId === undefined ? current.taxId : (body.taxId ? String(body.taxId).trim() : null);
    if (taxId && taxId !== current.taxId) {
      const duplicate = await this.db.customer.findFirst({ where: { companyId: actor.companyId, taxId, NOT: { id } } });
      if (duplicate) throw new BadRequestException("CPF/CNPJ já cadastrado para esta empresa.");
    }
    const rows = await this.db.$queryRawUnsafe<any[]>(
      `UPDATE "Customer" SET name=$3, "legalName"=$4, "tradeName"=$5, "taxId"=$6, segment=$7,
         email=$8, phone=$9, "postalCode"=$10, address=$11, district=$12, city=$13, state=$14,
         "paymentTerms"=$15, active=$16, "updatedAt"=NOW()
       WHERE id=$1 AND "companyId"=$2 RETURNING *`,
      id, actor.companyId, name,
      body.legalName === undefined ? current.legalName : (body.legalName?.trim() || null),
      body.tradeName === undefined ? current.tradeName : (body.tradeName?.trim() || null),
      taxId,
      body.segment === undefined ? current.segment : (body.segment?.trim() || null),
      body.email === undefined ? current.email : (body.email?.trim() || null),
      body.phone === undefined ? current.phone : (body.phone?.trim() || null),
      body.postalCode === undefined ? current.postalCode : (body.postalCode?.trim() || null),
      body.address === undefined ? current.address : (body.address?.trim() || null),
      body.district === undefined ? current.district : (body.district?.trim() || null),
      body.city === undefined ? current.city : (body.city?.trim() || null),
      body.state === undefined ? current.state : (body.state?.trim() || null),
      body.paymentTerms === undefined ? current.paymentTerms : (body.paymentTerms?.trim() || null),
      body.active === undefined ? current.active : Boolean(body.active),
    );
    const financial = (await this.health(actor.companyId, id))[0];
    return this.decorate(rows[0], financial);
  }

  @Patch(":id/credit")
  async credit(@Param("id") id: string, @Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.actor(request);
    if (!["ADMIN", "EXECUTIVE", "FINANCE"].includes(actor.role)) {
      throw new UnauthorizedException("A análise de crédito é restrita à administração/financeiro.");
    }
    const status = String(body.status ?? "").toUpperCase();
    if (!CREDIT_STATUSES.includes(status as any)) throw new BadRequestException("Status de crédito inválido.");
    const limit = Number(body.creditLimit ?? 0);
    if (!Number.isFinite(limit) || limit < 0) throw new BadRequestException("Limite de crédito inválido.");
    const rows = await this.db.$queryRawUnsafe<any[]>(
      `UPDATE "Customer" SET "creditStatus"=$3, "creditLimit"=$4, "creditNotes"=$5,
         "creditReviewedAt"=NOW(), "creditReviewedBy"=$6, "updatedAt"=NOW()
       WHERE id=$1 AND "companyId"=$2 RETURNING *`,
      id, actor.companyId, status, limit, body.notes?.trim() || null, actor.name,
    );
    if (!rows.length) throw new NotFoundException("Cliente não encontrado.");
    const financial = (await this.health(actor.companyId, id))[0];
    return this.decorate(rows[0], financial);
  }
}
