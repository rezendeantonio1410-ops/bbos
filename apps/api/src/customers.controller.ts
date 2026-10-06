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
import { prisma } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { AuthService } from "./auth.service";
import {
  assessCustomerFiscalReadiness,
  customerFiscalReadinessMessage,
} from "./customer-fiscal-readiness";

const CREDIT_STATUSES = [
  "NOT_ANALYZED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;
const isCashTerm = (value: unknown) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return !normalized || normalized === "à vista" || normalized === "a vista";
};
const optionalText = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};
const internationalPhone = (value: unknown) => {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[\s().-]/g, "");
  if (!normalized) return null;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new BadRequestException(
      "Telefone inválido. Use o formato internacional, por exemplo +5543999999999.",
    );
  }
  return normalized;
};

@Controller("customers")
export class CustomersController {
  private readonly db = prisma;

  constructor(private readonly auth: AuthService) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  private async health(companyId: string, customerId?: string) {
    return this.db.$queryRawUnsafe<any[]>(
      `SELECT c.id,
              (
                COALESCE(SUM(CASE WHEN ar.status NOT IN ('PAID','CANCELLED') THEN ar."openAmount" ELSE 0 END),0)
                + COALESCE((SELECT SUM(pending."totalAmount") FROM "SalesOrder" pending
                             WHERE pending."customerId"=c.id
                               AND pending."paymentType"='TERM'
                               AND pending.status IN ('CONFIRMED','RESERVED','PICKING','READY_TO_SHIP','INVOICED','IN_PRODUCTION','SHIPPED')
                               AND NOT EXISTS (SELECT 1 FROM "AccountsReceivable" ar2 WHERE ar2."salesOrderId"=pending.id)),0)
              )::numeric AS "openReceivables",
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
    let guidance =
      customer.creditStatus === "APPROVED"
        ? `Crédito vigente de ${creditLimit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Disponível ${availableCredit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`
        : "Cliente apto para compras à vista.";
    if (overdueCount > 0) {
      health = maxDaysOverdue >= 30 ? "BLOCKED" : "ATTENTION";
      guidance =
        maxDaysOverdue >= 30
          ? `Há ${overdueCount} título(s) vencido(s), com atraso de até ${maxDaysOverdue} dias. Venda a prazo exige análise.`
          : `Há ${overdueCount} título(s) vencido(s), com atraso de até ${maxDaysOverdue} dias. Revise antes de vender a prazo.`;
    } else if (
      customer.creditStatus === "APPROVED" &&
      customer.creditReviewPending
    ) {
      health = "HEALTHY";
      guidance = `Crédito vigente continua válido (${availableCredit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} disponível). Há uma revisão de limite em análise.`;
    } else if (customer.creditStatus === "UNDER_REVIEW") {
      health = "ATTENTION";
      guidance =
        "Primeira análise de crédito pendente. Compras à vista continuam liberadas.";
    } else if (customer.creditStatus === "REJECTED") {
      health = "BLOCKED";
      guidance =
        "Crédito não aprovado. Compras à vista continuam liberadas; venda a prazo permanece bloqueada.";
    } else if (customer.creditStatus === "NOT_ANALYZED") {
      health = "INFO";
      guidance =
        "Cliente apto para compras à vista. Para comprar a prazo, solicite aprovação de crédito.";
    }

    return {
      ...customer,
      fiscalReadiness: assessCustomerFiscalReadiness(customer),
      creditReviewPending: Boolean(customer.creditReviewPending),
      cashPurchaseAllowed: customer.active !== false,
      termPurchaseAllowed:
        customer.active !== false &&
        customer.creditStatus === "APPROVED" &&
        overdueCount === 0,
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
        `SELECT c.id, c."companyId", c.name, c."legalName", c."tradeName", c."taxId", c.segment,
                c.email, c.phone, c."postalCode", c.address, c."addressNumber", c."addressComplement",
                c.district, c.city, c.state, c."stateRegistration", c."stateRegistrationType",
                c."paymentTerms", c.active, c."creditStatus", c."creditLimit", c."creditNotes",
                c."creditReviewedAt", c."creditReviewedBy", c."createdAt", c."updatedAt",
                EXISTS (
                  SELECT 1
                    FROM "CustomerCreditEvent" req
                   WHERE req."customerId" = c.id
                     AND req."companyId" = c."companyId"
                     AND req."eventType" = 'REQUEST'
                     AND NOT EXISTS (
                       SELECT 1
                         FROM "CustomerCreditEvent" dec
                        WHERE dec."customerId" = c.id
                          AND dec."companyId" = c."companyId"
                          AND dec."eventType" = 'DECISION'
                          AND dec."createdAt" > req."createdAt"
                     )
                ) AS "creditReviewPending"
           FROM "Customer" c
          WHERE c."companyId" = $1
          ORDER BY c.name ASC`,
        actor.companyId,
      ),
      this.health(actor.companyId),
    ]);
    const byId = new Map(health.map((item) => [item.id, item]));
    return customers.map((customer) =>
      this.decorate(customer, byId.get(customer.id)),
    );
  }

  @Get(":id/health")
  async getHealth(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    const customer = (
      await this.db.$queryRawUnsafe<any[]>(
        `SELECT c.id, c.name, c."legalName", c."tradeName", c."taxId", c."postalCode", c.address,
              c."addressNumber", c."addressComplement", c.district, c.city, c.state,
              c."stateRegistration", c."stateRegistrationType",
              c.active, c."creditStatus", c."creditLimit", c."paymentTerms",
              EXISTS (
                SELECT 1 FROM "CustomerCreditEvent" req
                 WHERE req."customerId"=c.id AND req."companyId"=c."companyId" AND req."eventType"='REQUEST'
                   AND NOT EXISTS (
                     SELECT 1 FROM "CustomerCreditEvent" dec
                      WHERE dec."customerId"=c.id AND dec."companyId"=c."companyId" AND dec."eventType"='DECISION'
                        AND dec."createdAt" > req."createdAt"
                   )
              ) AS "creditReviewPending"
         FROM "Customer" c WHERE c.id=$1 AND c."companyId"=$2`,
        id,
        actor.companyId,
      )
    )[0];
    if (!customer) throw new NotFoundException("Cliente não encontrado.");
    const financial = (await this.health(actor.companyId, id))[0];
    return this.decorate(customer, financial);
  }

  @Get(":id/credit-history")
  async creditHistory(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    const customer = await this.db.customer.findFirst({
      where: { id, companyId: actor.companyId },
    });
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
    const fiscalReadiness = assessCustomerFiscalReadiness({
      ...body,
      name: body.name ?? body.tradeName ?? body.legalName,
    });
    const fiscalError = customerFiscalReadinessMessage({
      ...body,
      name: body.name ?? body.tradeName ?? body.legalName,
    });
    if (fiscalError) throw new BadRequestException(fiscalError);
    const fiscal = fiscalReadiness.normalized;
    const name = fiscal.name;
    const taxId = fiscal.taxId;
    if (taxId) {
      const duplicate = await this.db.$queryRawUnsafe<any[]>(
        `SELECT id FROM "Customer"
          WHERE "companyId"=$1
            AND regexp_replace(COALESCE("taxId",''),'[^0-9]','','g')=$2
          LIMIT 1`,
        actor.companyId,
        taxId,
      );
      if (duplicate[0])
        throw new BadRequestException(
          "CPF/CNPJ já cadastrado para esta empresa.",
        );
    }
    const paymentTerms = body.paymentTerms?.trim() || "À vista";
    const initialCreditStatus = isCashTerm(paymentTerms)
      ? "NOT_ANALYZED"
      : "UNDER_REVIEW";
    const id = randomUUID();
    const rows = await this.db.$queryRawUnsafe<any[]>(
      `INSERT INTO "Customer"
        (id, "companyId", name, "legalName", "tradeName", "taxId", segment,
         email, phone, "postalCode", address, "addressNumber", "addressComplement", district, city, state,
         "stateRegistration", "stateRegistrationType",
         "paymentTerms", active, "creditStatus", "creditLimit", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,0,NOW(),NOW())
       RETURNING *`,
      id,
      actor.companyId,
      name,
      fiscal.legalName || null,
      body.tradeName?.trim() || null,
      taxId,
      optionalText(body.segment),
      optionalText(body.email),
      internationalPhone(body.phone),
      fiscal.postalCode,
      fiscal.address,
      fiscal.addressNumber,
      fiscal.addressComplement || null,
      fiscal.district,
      fiscal.city,
      fiscal.state,
      fiscal.stateRegistration || null,
      fiscal.stateRegistrationType,
      paymentTerms,
      body.active !== false,
      initialCreditStatus,
    );
    return this.decorate(rows[0], null);
  }

  @Post(":id/credit-request")
  async requestCredit(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: Record<string, any>,
  ) {
    const actor = await this.actor(request);
    const customer = (
      await this.db.$queryRawUnsafe<any[]>(
        `SELECT id, "companyId", "creditStatus", "creditLimit", "paymentTerms" FROM "Customer" WHERE id=$1 AND "companyId"=$2`,
        id,
        actor.companyId,
      )
    )[0];
    if (!customer) throw new NotFoundException("Cliente não encontrado.");

    const pending = (
      await this.db.$queryRawUnsafe<any[]>(
        `SELECT EXISTS (
         SELECT 1 FROM "CustomerCreditEvent" req
          WHERE req."customerId"=$1 AND req."companyId"=$2 AND req."eventType"='REQUEST'
            AND NOT EXISTS (
              SELECT 1 FROM "CustomerCreditEvent" dec
               WHERE dec."customerId"=$1 AND dec."companyId"=$2 AND dec."eventType"='DECISION'
                 AND dec."createdAt" > req."createdAt"
            )
       ) AS pending`,
        id,
        actor.companyId,
      )
    )[0]?.pending;
    if (pending)
      throw new BadRequestException(
        "Já existe uma solicitação de crédito aguardando decisão.",
      );

    const requestedLimit = Number(body.requestedLimit ?? 0);
    if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
      throw new BadRequestException(
        "Informe um limite de crédito solicitado maior que zero.",
      );
    }
    const requestedTerms = String(body.requestedTerms ?? "").trim();
    if (!requestedTerms)
      throw new BadRequestException(
        "Informe a condição de pagamento solicitada.",
      );
    const monthlyVolume =
      body.monthlyVolume === undefined || body.monthlyVolume === ""
        ? null
        : Number(body.monthlyVolume);
    if (
      monthlyVolume !== null &&
      (!Number.isFinite(monthlyVolume) || monthlyVolume < 0)
    ) {
      throw new BadRequestException("Volume mensal estimado inválido.");
    }
    const rationale = String(body.rationale ?? "").trim();
    if (!rationale)
      throw new BadRequestException(
        "Informe a justificativa da solicitação de crédito.",
      );

    const keepsCurrentApproval = customer.creditStatus === "APPROVED";
    await this.db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO "CustomerCreditEvent"
          (id, "companyId", "customerId", "eventType", "requestedLimit", "requestedTerms", "monthlyVolume", rationale,
           "actorId", "actorName", "actorRole", "createdAt")
         VALUES ($1,$2,$3,'REQUEST',$4,$5,$6,$7,$8,$9,$10,NOW())`,
        randomUUID(),
        actor.companyId,
        id,
        requestedLimit,
        requestedTerms,
        monthlyVolume,
        rationale,
        actor.id ?? null,
        actor.name,
        actor.role ?? null,
      );
      if (!keepsCurrentApproval) {
        await tx.$executeRawUnsafe(
          `UPDATE "Customer" SET "creditStatus"='UNDER_REVIEW', "updatedAt"=NOW()
            WHERE id=$1 AND "companyId"=$2`,
          id,
          actor.companyId,
        );
      }
    });

    return {
      ok: true,
      status: keepsCurrentApproval ? "APPROVED" : "UNDER_REVIEW",
      creditReviewPending: true,
    };
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: Record<string, any>,
  ) {
    const actor = await this.actor(request);
    const existing = await this.db.customer.findFirst({
      where: { id, companyId: actor.companyId },
    });
    if (!existing) throw new NotFoundException("Cliente não encontrado.");
    const current = (
      await this.db.$queryRawUnsafe<any[]>(
        `SELECT * FROM "Customer" WHERE id=$1 AND "companyId"=$2`,
        id,
        actor.companyId,
      )
    )[0];
    const fiscalReadiness = assessCustomerFiscalReadiness({
      name: body.name === undefined ? current.name : body.name,
      legalName:
        body.legalName === undefined ? current.legalName : body.legalName,
      taxId: body.taxId === undefined ? current.taxId : body.taxId,
      postalCode:
        body.postalCode === undefined ? current.postalCode : body.postalCode,
      address: body.address === undefined ? current.address : body.address,
      addressNumber:
        body.addressNumber === undefined
          ? current.addressNumber
          : body.addressNumber,
      addressComplement:
        body.addressComplement === undefined
          ? current.addressComplement
          : body.addressComplement,
      district: body.district === undefined ? current.district : body.district,
      city: body.city === undefined ? current.city : body.city,
      state: body.state === undefined ? current.state : body.state,
      stateRegistration:
        body.stateRegistration === undefined
          ? current.stateRegistration
          : body.stateRegistration,
      stateRegistrationType:
        body.stateRegistrationType === undefined
          ? current.stateRegistrationType
          : body.stateRegistrationType,
    });
    if (!fiscalReadiness.ready) {
      throw new BadRequestException(
        `Complete o cadastro fiscal do cliente antes de salvar: ${fiscalReadiness.issues.join(", ")}.`,
      );
    }
    const fiscal = fiscalReadiness.normalized;
    const name = fiscal.name;
    const taxId = fiscal.taxId;
    if (taxId && taxId !== current.taxId) {
      const duplicate = await this.db.$queryRawUnsafe<any[]>(
        `SELECT id FROM "Customer"
          WHERE "companyId"=$1 AND id<>$2
            AND regexp_replace(COALESCE("taxId",''),'[^0-9]','','g')=$3
          LIMIT 1`,
        actor.companyId,
        id,
        taxId,
      );
      if (duplicate[0])
        throw new BadRequestException(
          "CPF/CNPJ já cadastrado para esta empresa.",
        );
    }
    const paymentTerms =
      body.paymentTerms === undefined
        ? current.paymentTerms
        : body.paymentTerms?.trim() || "À vista";
    const needsCreditApproval = !isCashTerm(paymentTerms);
    const nextCreditStatus =
      needsCreditApproval && current.creditStatus !== "APPROVED"
        ? "UNDER_REVIEW"
        : current.creditStatus;
    const rows = await this.db.$queryRawUnsafe<any[]>(
      `UPDATE "Customer" SET name=$3, "legalName"=$4, "tradeName"=$5, "taxId"=$6, segment=$7,
         email=$8, phone=$9, "postalCode"=$10, address=$11, "addressNumber"=$12,
         "addressComplement"=$13, district=$14, city=$15, state=$16,
         "stateRegistration"=$17, "stateRegistrationType"=$18,
         "paymentTerms"=$19, active=$20, "creditStatus"=$21, "updatedAt"=NOW()
       WHERE id=$1 AND "companyId"=$2 RETURNING *`,
      id,
      actor.companyId,
      name,
      fiscal.legalName || null,
      body.tradeName === undefined
        ? current.tradeName
        : body.tradeName?.trim() || null,
      taxId,
      body.segment === undefined
        ? current.segment
        : body.segment?.trim() || null,
      body.email === undefined ? current.email : body.email?.trim() || null,
      body.phone === undefined ? current.phone : internationalPhone(body.phone),
      fiscal.postalCode,
      fiscal.address,
      fiscal.addressNumber,
      fiscal.addressComplement || null,
      fiscal.district,
      fiscal.city,
      fiscal.state,
      fiscal.stateRegistration || null,
      fiscal.stateRegistrationType,
      paymentTerms,
      body.active === undefined ? current.active : Boolean(body.active),
      nextCreditStatus,
    );
    const financial = (await this.health(actor.companyId, id))[0];
    return this.decorate(rows[0], financial);
  }

  @Patch(":id/credit")
  async credit(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: Record<string, any>,
  ) {
    const actor = await this.actor(request);
    if (!["ADMIN", "EXECUTIVE", "FINANCE"].includes(actor.role)) {
      throw new UnauthorizedException(
        "A análise de crédito é restrita à administração/financeiro.",
      );
    }
    const status = String(body.status ?? "").toUpperCase();
    if (!CREDIT_STATUSES.includes(status as any))
      throw new BadRequestException("Status de crédito inválido.");
    const limit = Number(body.creditLimit ?? 0);
    if (!Number.isFinite(limit) || limit < 0)
      throw new BadRequestException("Limite de crédito inválido.");
    const decisionTerms = String(body.paymentTerms ?? "").trim() || null;
    const notes = String(body.notes ?? "").trim() || null;

    let updated: any;
    await this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<any[]>(
        `UPDATE "Customer" SET "creditStatus"=$3, "creditLimit"=$4, "creditNotes"=$5,
           "creditReviewedAt"=NOW(), "creditReviewedBy"=$6,
           "paymentTerms"=COALESCE($7,"paymentTerms"), "updatedAt"=NOW()
         WHERE id=$1 AND "companyId"=$2 RETURNING *`,
        id,
        actor.companyId,
        status,
        limit,
        notes,
        actor.name,
        decisionTerms,
      );
      if (!rows.length) throw new NotFoundException("Cliente não encontrado.");
      updated = rows[0];
      await tx.$executeRawUnsafe(
        `INSERT INTO "CustomerCreditEvent"
          (id, "companyId", "customerId", "eventType", "decisionStatus", "decidedLimit", "decisionTerms", notes,
           "actorId", "actorName", "actorRole", "createdAt")
         VALUES ($1,$2,$3,'DECISION',$4,$5,$6,$7,$8,$9,$10,NOW())`,
        randomUUID(),
        actor.companyId,
        id,
        status,
        limit,
        decisionTerms,
        notes,
        actor.id ?? null,
        actor.name,
        actor.role ?? null,
      );
    });

    const financial = (await this.health(actor.companyId, id))[0];
    return this.decorate(updated, financial);
  }
}
