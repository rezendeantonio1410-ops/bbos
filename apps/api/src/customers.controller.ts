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
const isCashTerm = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return !normalized || normalized === "à vista" || normalized === "a vista";
};

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
    let guidance = "Cliente apto para compras à vista.";
    if (overdueCount > 0) {
      health = maxDaysOverdue >= 30 ? "BLOCKED" : "ATTENTION";
      guidance = maxDaysOverdue >= 30
        ? `Há ${overdueCount} título(s) vencido(s), com atraso de até ${maxDaysOverdue} dias. Venda a prazo exige análise.`
        : `Há ${overdueCount} título(s) vencido(s), com atraso de até ${maxDaysOverdue} dias. Revise antes de vender a prazo.`;
    } else if (customer.creditStatus === "UNDER_REVIEW") {
      health = "ATTENTION";
      guidance = "Crédito pendente de aprovação. Compras à vista continuam liberadas.";
    } else if (customer.creditStatus === "REJECTED") {
      health = "BLOCKED";
      guidance = "Crédito não aprovado. Compras à vista continuam liberadas; venda a prazo permanece bloqueada.";
    } else if (customer.creditStatus === "NOT_ANALYZED") {
      health = "INFO";
      guidance = "Cliente apto para compras à vista. Para comprar a prazo, solicite aprovação de crédito.";
    }

    return {
      ...customer,
      cashPurchaseAllowed: customer.active !== false,
      termPurchaseAllowed: customer.active !== false && customer.creditStatus === "APPROVED" && overdueCount === 0,
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
      `SELECT id, name, "tradeName", active, "creditStatus", "creditLimit", "paymentTerms"
         FROM "Customer" WHERE id=$1 AND "companyId"=$2`, id, actor.companyId,
    ))[0];
    if (!customer) throw new NotFoundException("Cliente não encontrado.");
    const financial = (await this.health(actor.companyId, id))[0];
    return this.decorate(customer, financial);
  }

  @Get(":id/credit-history")
  async creditHistory(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    const customer = await this.db.customer.findFirst({ where: { id, companyId: actor.companyId } });
    if (!customer) throw new NotFoundException("Cliente não encontrado.");
    return this.db.$queryRawUnsafe<any[]>(
      `SELECT id, "eventType", "requestedLimit", "requestedTerms", "monthlyVolume", rationale,
              "decisionStatus", "decidedLimit", "decisionTerms", notes,
              "actorId", "actorName", "actorRole", "createdAt"
         FROM "CustomerCreditEvent"
        WHERE "companyId"=$1 AND "customerId"=$2
        ORDER BY "createdAt" DESC`,
      actor.companyId,
      id,
    );
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
    const paymentTerms = body.paymentTerms?.trim() || "À vista";
    const initialCreditStatus = isCashTerm(paymentTerms) ? "NOT_ANALYZED" : "UNDER_REVIEW";
    const id = randomUUID();
    const rows = await this.db.$queryRawUnsafe<any[]>(
      `INSERT INTO "Customer"
        (id, "companyId", name, "legalName", "tradeName", "taxId", segment,
         email, phone, "postalCode", address, district, city, state,
         "paymentTerms", active, "creditStatus", "creditLimit", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,0,NOW(),NOW())
       RETURNING *`,
      id, actor.companyId, name,
      body.legalName?.trim() || null, body.tradeName?.trim() || null, taxId,
      body.segment?.trim() || null, body.email?.trim() || null, body.phone?.trim() || null,
      body.postalCode?.trim() || null, body.address?.trim() || null, body.district?.trim() || null,
      body.city?.trim() || null, body.state?.trim() || null, paymentTerms,
      body.active !== false, initialCreditStatus,
    );
    return this.decorate(rows[0], null);
  }

  @Post(":id/credit-request")
  async requestCredit(@Param("id") id: string, @Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.actor(request);
    const customer = await this.db.customer.findFirst({ where: { id, companyId: actor.companyId } });
    if (!customer) throw new NotFoundException("Cliente não encontrado.");

    const requestedLimit = Number(body.requestedLimit ?? 0);
    if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
      throw new BadRequestException("Informe um limite de crédito solicitado maior que zero.");
    }
    const requestedTerms = String(body.requestedTerms ?? "").trim();
    if (!requestedTerms) throw new BadRequestException("Informe a condição de pagamento solicitada.");
    const monthlyVolume = body.monthlyVolume === undefined || body.monthlyVolume === "" ? null : Number(body.monthlyVolume);
    if (monthlyVolume !== null && (!Number.isFinite(monthlyVolume) || monthlyVolume < 0)) {
      throw new BadRequestException("Volume mensal estimado inválido.");
    }
    const rationale = String(body.rationale ?? "").trim();
    if (!rationale) throw new BadRequestException("Informe a justificativa da solicitação de crédito.");

    await this.db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO "CustomerCreditEvent"
          (id, "companyId", "customerId", "eventType", "requestedLimit", "requestedTerms", "monthlyVolume", rationale,
           "actorId", "actorName", "actorRole", "createdAt")
         VALUES ($1,$2,$3,'REQUEST',$4,$5,$6,$7,$8,$9,$10,NOW())`,
        randomUUID(), actor.companyId, id, requestedLimit, requestedTerms, monthlyVolume, rationale,
        actor.id ?? null, actor.name, actor.role ?? null,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "Customer" SET "creditStatus"='UNDER_REVIEW', "updatedAt"=NOW()
          WHERE id=$1 AND "companyId"=$2`,
        id,
        actor.companyId,
      );
    });

    return { ok: true, status: "UNDER_REVIEW" };
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
    const paymentTerms = body.paymentTerms === undefined ? current.paymentTerms : (body.paymentTerms?.trim() || "À vista");
    const needsCreditApproval = !isCashTerm(paymentTerms);
    const nextCreditStatus = needsCreditApproval && current.creditStatus !== "APPROVED" ? "UNDER_REVIEW" : current.creditStatus;
    const rows = await this.db.$queryRawUnsafe<any[]>(
      `UPDATE "Customer" SET name=$3, "legalName"=$4, "tradeName"=$5, "taxId"=$6, segment=$7,
         email=$8, phone=$9, "postalCode"=$10, address=$11, district=$12, city=$13, state=$14,
         "paymentTerms"=$15, active=$16, "creditStatus"=$17, "updatedAt"=NOW()
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
      paymentTerms,
      body.active === undefined ? current.active : Boolean(body.active),
      nextCreditStatus,
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
    const decisionTerms = String(body.paymentTerms ?? "").trim() || null;
    const notes = String(body.notes ?? "").trim() || null;

    let updated: any;
    await this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<any[]>(
        `UPDATE "Customer" SET "creditStatus"=$3, "creditLimit"=$4, "creditNotes"=$5,
           "creditReviewedAt"=NOW(), "creditReviewedBy"=$6,
           "paymentTerms"=COALESCE($7,"paymentTerms"), "updatedAt"=NOW()
         WHERE id=$1 AND "companyId"=$2 RETURNING *`,
        id, actor.companyId, status, limit, notes, actor.name, decisionTerms,
      );
      if (!rows.length) throw new NotFoundException("Cliente não encontrado.");
      updated = rows[0];
      await tx.$executeRawUnsafe(
        `INSERT INTO "CustomerCreditEvent"
          (id, "companyId", "customerId", "eventType", "decisionStatus", "decidedLimit", "decisionTerms", notes,
           "actorId", "actorName", "actorRole", "createdAt")
         VALUES ($1,$2,$3,'DECISION',$4,$5,$6,$7,$8,$9,$10,NOW())`,
        randomUUID(), actor.companyId, id, status, limit, decisionTerms, notes,
        actor.id ?? null, actor.name, actor.role ?? null,
      );
    });

    const financial = (await this.health(actor.companyId, id))[0];
    return this.decorate(updated, financial);
  }
}
