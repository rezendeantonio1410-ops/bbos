import { prisma } from "@bbos/database";
import { normalizeCustomerPhone } from "@bbos/shared";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AuthService } from "./auth.service";
import {
  assessCustomerFiscalReadiness,
  customerFiscalReadinessMessage,
} from "./customer-fiscal-readiness";
import { parseCustomerVisitInput } from "./customer-visit-input";
import {
  canUpdateInternalTaxIdRejectionMetadata,
  isTrustedInternalTaxIdVerificationStatus,
  normalizeCnpj,
  selectTaxIdSuggestionSnapshotRows,
  suggestInternalCnpjs,
  type CnpjSuggestionField,
  type InternalCnpjCandidateInput,
} from "./internal-cnpj-suggestion";
import { isDesignatedTermCreditApprover } from "./sales-order-term-approval-policy";
import { parsePaymentWeekday } from "./customer-payment-weekday";
import {
  assertCustomerInSalesPortfolio,
  salesPortfolioPartnerId,
} from "./sales-portfolio";
import { isValidCnpj } from "./supplier-verification";

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
const compactAddress = (...parts: unknown[]) =>
  parts
    .map(optionalText)
    .filter((part): part is string => Boolean(part))
    .join(", ") || null;

const suggestionMatchReasons = (
  scores: Partial<Record<CnpjSuggestionField, number>>,
) => {
  const labels: Record<CnpjSuggestionField, string> = {
    NAME: "nome",
    LEGAL_NAME: "razão social",
    ADDRESS: "endereço",
    POSTAL_CODE: "CEP",
    CITY: "cidade",
    STATE: "UF",
  };
  return (Object.entries(scores) as Array<[CnpjSuggestionField, number]>)
    .filter(([, score]) => Number(score) >= 0.5)
    .sort((left, right) => right[1] - left[1])
    .map(([field, score]) => ({
      field,
      label: labels[field],
      score: Number(score),
    }));
};

const jsonObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};
const actorDisplayName = (actor: any) =>
  String(actor?.name ?? actor?.email ?? "Usuário BBOS").trim() ||
  "Usuário BBOS";

type RawQueryClient = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Promise<T>;
};

const internationalPhone = (value: unknown) => {
  try {
    return normalizeCustomerPhone(value);
  } catch {
    throw new BadRequestException("Informe um celular válido com DDD.");
  }
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

  private async assertCustomerVisible(actor: any, customerId: string) {
    await assertCustomerInSalesPortfolio(this.db, actor, customerId);
  }

  private taxIdSuggestionCustomerSourceIds(scoreReasons: unknown) {
    const internalSources = jsonObject(scoreReasons).internalSources;
    if (!Array.isArray(internalSources) || internalSources.length === 0) {
      throw new NotFoundException("Sugestão de CNPJ não encontrada.");
    }
    const sources = internalSources
      .filter(
        (source): source is Record<string, unknown> =>
          Boolean(source) &&
          typeof source === "object" &&
          !Array.isArray(source),
      )
      .map((source) => ({
        source: String(source.source ?? ""),
        sourceId: String(source.sourceId ?? ""),
      }));
    if (
      sources.length !== internalSources.length ||
      sources.some(
        (source) => source.source !== "CUSTOMER" || !source.sourceId,
      )
    ) {
      throw new NotFoundException("Sugestão de CNPJ não encontrada.");
    }
    return [...new Set(sources.map((source) => source.sourceId))].sort();
  }

  private async assertTaxIdSuggestionAllowed(
    actor: any,
    scoreReasons: unknown,
    db: RawQueryClient = this.db,
  ) {
    if (actor.role !== "SALES") return;
    const partnerId = salesPortfolioPartnerId(actor);
    const uniqueSourceIds =
      this.taxIdSuggestionCustomerSourceIds(scoreReasons);
    const allowed = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT c.id
         FROM "Customer" c
         JOIN "StorefrontPartnerCustomer" portfolio
           ON portfolio."customerId"=c.id AND portfolio."partnerId"=$2
        WHERE c."companyId"=$1 AND c.id = ANY($3::text[])`,
      actor.companyId,
      partnerId,
      uniqueSourceIds,
    );
    if (new Set(allowed.map((row) => row.id)).size !== uniqueSourceIds.length) {
      throw new NotFoundException("Sugestão de CNPJ não encontrada.");
    }
  }

  private async lockAndAssertSalesPortfolioCustomers(
    actor: any,
    customerIds: string[],
    db: RawQueryClient,
  ) {
    if (actor.role !== "SALES") return;
    const partnerId = salesPortfolioPartnerId(actor);
    const scopedCustomerIds = [
      ...new Set(customerIds.filter((customerId) => Boolean(customerId))),
    ].sort();
    if (scopedCustomerIds.length === 0) {
      throw new NotFoundException("Sugestão de CNPJ não encontrada.");
    }
    const locked = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT portfolio."customerId" AS id
         FROM "StorefrontPartnerCustomer" portfolio
         JOIN "Customer" c ON c.id=portfolio."customerId"
        WHERE c."companyId"=$1 AND portfolio."partnerId"=$2
          AND portfolio."customerId" = ANY($3::text[])
        ORDER BY portfolio."customerId"
        FOR SHARE OF portfolio`,
      actor.companyId,
      partnerId,
      scopedCustomerIds,
    );
    if (new Set(locked.map((row) => row.id)).size !== scopedCustomerIds.length) {
      throw new NotFoundException("Sugestão de CNPJ não encontrada.");
    }
  }

  private async lockAndAssertTaxIdSuggestionPortfolioScope(
    actor: any,
    targetCustomerId: string,
    scoreReasons: unknown,
    db: RawQueryClient,
  ) {
    if (actor.role !== "SALES") return;
    await this.lockAndAssertSalesPortfolioCustomers(
      actor,
      [
        targetCustomerId,
        ...this.taxIdSuggestionCustomerSourceIds(scoreReasons),
      ],
      db,
    );
  }

  private async lockTaxIdSuggestionCompanyScope(
    actor: any,
    db: RawQueryClient,
  ) {
    await db.$queryRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext($1)) IS NULL AS locked`,
      `${actor.companyId}:customer-tax-id-suggestions`,
    );
  }

  private async assertTaxIdSuggestionEvidenceCurrent(
    actor: any,
    suggestionTaxId: unknown,
    scoreReasons: unknown,
    db: RawQueryClient,
  ) {
    const staleEvidence = () =>
      new ConflictException(
        "A fonte desta sugestão foi alterada. Pesquise o CNPJ novamente.",
      );
    const canonicalCnpj =
      typeof suggestionTaxId === "string" ? normalizeCnpj(suggestionTaxId) : "";
    if (!canonicalCnpj || !isValidCnpj(canonicalCnpj)) {
      throw new BadRequestException("A sugestão contém um CNPJ inválido.");
    }

    await this.assertTaxIdSuggestionAllowed(actor, scoreReasons, db);
    const rawSources = jsonObject(scoreReasons).internalSources;
    if (!Array.isArray(rawSources) || rawSources.length === 0) {
      throw staleEvidence();
    }
    const sources = rawSources.map((source) => {
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        throw staleEvidence();
      }
      const record = source as Record<string, unknown>;
      const type = String(record.source ?? "");
      const sourceId = String(record.sourceId ?? "");
      if (!sourceId || !["CUSTOMER", "SUPPLIER"].includes(type)) {
        throw staleEvidence();
      }
      return { type, sourceId };
    });

    const customerIds = [
      ...new Set(
        sources
          .filter((source) => source.type === "CUSTOMER")
          .map((source) => source.sourceId),
      ),
    ].sort();
    const supplierIds = [
      ...new Set(
        sources
          .filter((source) => source.type === "SUPPLIER")
          .map((source) => source.sourceId),
      ),
    ].sort();
    const customerRows = customerIds.length
      ? await db.$queryRawUnsafe<
          Array<{
            id: string;
            taxId: string | null;
            active: boolean;
            taxIdVerificationStatus: string;
          }>
        >(
          `SELECT id,"taxId",active,
                  "taxIdVerificationStatus"::text AS "taxIdVerificationStatus"
             FROM "Customer"
            WHERE "companyId"=$1 AND id = ANY($2::text[])
            ORDER BY id
            FOR UPDATE`,
          actor.companyId,
          customerIds,
        )
      : [];
    const supplierRows = supplierIds.length
      ? await db.$queryRawUnsafe<
          Array<{
            id: string;
            taxId: string | null;
            active: boolean;
            taxIdVerificationStatus: string;
          }>
        >(
          `SELECT id,"taxId",active,
                  "taxIdVerificationStatus"::text AS "taxIdVerificationStatus"
             FROM "Supplier"
            WHERE "companyId"=$1 AND id = ANY($2::text[])
            ORDER BY id
            FOR UPDATE`,
          actor.companyId,
          supplierIds,
        )
      : [];
    const currentSources = new Map<string, (typeof customerRows)[number]>();
    for (const row of customerRows)
      currentSources.set(`CUSTOMER:${row.id}`, row);
    for (const row of supplierRows)
      currentSources.set(`SUPPLIER:${row.id}`, row);

    for (const source of sources) {
      const row = currentSources.get(`${source.type}:${source.sourceId}`);
      if (
        !row ||
        row.active !== true ||
        !isTrustedInternalTaxIdVerificationStatus(
          row.taxIdVerificationStatus,
        ) ||
        normalizeCnpj(row.taxId) !== canonicalCnpj
      ) {
        throw staleEvidence();
      }
    }
    return canonicalCnpj;
  }

  private async taxIdSuggestionSnapshot(actor: any, customerId: string) {
    const companyId = actor.companyId;
    const customer = (
      await this.db.$queryRawUnsafe<any[]>(
        `SELECT id,"taxId","taxIdVerificationStatus"::text AS "taxIdVerificationStatus",
                "taxIdVerifiedAt","taxIdVerificationSource"
           FROM "Customer"
          WHERE id=$1 AND "companyId"=$2`,
        customerId,
        companyId,
      )
    )[0];
    if (!customer) throw new NotFoundException("Cliente não encontrado.");

    const rows = await this.db.$queryRawUnsafe<any[]>(
      `SELECT id,"taxId","legalName","tradeName","postalCode",address,"addressNumber",
              district,city,state,source,confidence::float8 AS confidence,"scoreReasons",
              status,"createdAt","selectedAt","confirmedAt"
         FROM "CustomerTaxIdSuggestion"
        WHERE "companyId"=$1 AND "customerId"=$2
          AND status IN ('DRAFT','SELECTED','CONFIRMED')
        ORDER BY CASE status WHEN 'SELECTED' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END,
                 "createdAt" DESC
        LIMIT 50`,
      companyId,
      customerId,
    );

    const visibleRows: any[] = [];
    for (const row of rows) {
      try {
        await this.assertTaxIdSuggestionAllowed(actor, row.scoreReasons);
        visibleRows.push(row);
      } catch (error) {
        if (actor.role !== "SALES") throw error;
      }
    }
    const snapshotRows = selectTaxIdSuggestionSnapshotRows(visibleRows, 3);

    return {
      customer,
      suggestions: snapshotRows.map((row) => {
        const scoreReasons = jsonObject(row.scoreReasons);
        const storedReasons = scoreReasons.matchReasons;
        const matchReasons = Array.isArray(storedReasons)
          ? storedReasons
          : suggestionMatchReasons(
              jsonObject(scoreReasons.fieldScores) as Partial<
                Record<CnpjSuggestionField, number>
              >,
            );
        return {
          id: row.id,
          taxId: row.taxId,
          legalName: row.legalName,
          tradeName: row.tradeName,
          postalCode: row.postalCode,
          address: row.address,
          addressNumber: row.addressNumber,
          district: row.district,
          city: row.city,
          state: row.state,
          source: row.source,
          sourceLabel: "Cadastro interno BBOS",
          confidence: Number(row.confidence),
          matchReasons,
          status: row.status,
          createdAt: row.createdAt,
          selectedAt: row.selectedAt,
          confirmedAt: row.confirmedAt,
        };
      }),
    };
  }

  private async health(
    companyId: string,
    customerId?: string,
    storefrontPartnerId?: string | null,
  ) {
    const args: unknown[] = [companyId];
    const conditions: string[] = [`c."companyId" = $1`];
    if (customerId) {
      args.push(customerId);
      conditions.push(`c.id = $${args.length}`);
    }
    if (storefrontPartnerId) {
      args.push(storefrontPartnerId);
      conditions.push(`EXISTS (
        SELECT 1 FROM "StorefrontPartnerCustomer" portfolio
         WHERE portfolio."customerId"=c.id
           AND portfolio."partnerId"=$${args.length}
      )`);
    }
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
        WHERE ${conditions.join(" AND ")}
        GROUP BY c.id`,
      ...args,
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
    const partnerId = salesPortfolioPartnerId(actor);
    const [customers, health] = await Promise.all([
      this.db.$queryRawUnsafe<any[]>(
        `SELECT c.id, c."companyId", c.name, c."legalName", c."tradeName", c."taxId",
                c."taxIdVerificationStatus"::text AS "taxIdVerificationStatus",
                c."taxIdVerifiedAt", c."taxIdVerificationSource",
                c."countryCode", c."countryName", c."foreignTaxId", c.segment,
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
            AND ($2::text IS NULL OR EXISTS (
              SELECT 1 FROM "StorefrontPartnerCustomer" portfolio
               WHERE portfolio."customerId"=c.id
                 AND portfolio."partnerId"=$2
            ))
          ORDER BY c.name ASC`,
        actor.companyId,
        partnerId,
      ),
      this.health(actor.companyId, undefined, partnerId),
    ]);
    const byId = new Map(health.map((item) => [item.id, item]));
    return customers.map((customer) => {
      const decorated = this.decorate(customer, byId.get(customer.id));
      if (actor.role !== "SALES") return decorated;
      const salesView = { ...decorated };
      delete salesView.creditNotes;
      delete salesView.creditReviewedBy;
      return salesView;
    });
  }

  @Get(":id/health")
  async getHealth(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    await this.assertCustomerVisible(actor, id);
    const customer = (
      await this.db.$queryRawUnsafe<any[]>(
        `SELECT c.id, c.name, c."legalName", c."tradeName", c."taxId",
              c."countryCode", c."countryName", c."foreignTaxId", c."postalCode", c.address,
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
    await this.assertCustomerVisible(actor, id);
    const customer = await this.db.customer.findFirst({
      where: { id, companyId: actor.companyId },
    });
    if (!customer) throw new NotFoundException("Cliente não encontrado.");
    const events = await this.db.$queryRawUnsafe<any[]>(
      `SELECT id, "eventType", "requestedLimit", "requestedTerms", "monthlyVolume", rationale,
              "decisionStatus", "decidedLimit", "decisionTerms", notes,
              "actorId", "actorName", "actorRole", "createdAt"
         FROM "CustomerCreditEvent"
        WHERE "companyId"=$1 AND "customerId"=$2
        ORDER BY "createdAt" DESC`,
      actor.companyId,
      id,
    );
    if (actor.role !== "SALES") return events;
    return events.map((event) => {
      const salesView = { ...event };
      delete salesView.notes;
      delete salesView.actorId;
      delete salesView.actorName;
      delete salesView.actorRole;
      return salesView;
    });
  }

  @Get(":id/sales-history")
  async salesHistory(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    await this.assertCustomerVisible(actor, id);
    const customer = await this.db.customer.findFirst({
      where: { id, companyId: actor.companyId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException("Cliente não encontrado.");

    return this.db.$queryRawUnsafe<any[]>(
      `SELECT so.id,COALESCE(so."orderNumber",so.code) AS "orderNumber",
              so.status::text AS status,so."orderedAt",so."totalAmount",so."paymentType",
              so."paymentTermsSnapshot",ar.status::text AS "paymentStatus",ar."dueDate",
              ar."openAmount",ar."paymentDate",
              COALESCE((
                SELECT json_agg(json_build_object(
                  'productName',item."productName",'sku',item.sku,'quantity',item.quantity,
                  'unitPrice',item."unitPrice",'totalAmount',item."totalAmount"
                ) ORDER BY item."createdAt")
                  FROM "SalesOrderItem" item
                 WHERE item."salesOrderId"=so.id
              ),'[]'::json) AS items
         FROM "SalesOrder" so
         LEFT JOIN "AccountsReceivable" ar
           ON ar."salesOrderId"=so.id AND ar."companyId"=so."companyId"
        WHERE so."companyId"=$1 AND so."customerId"=$2
          AND (
            NOT $3::boolean
            OR (
              so."externalOrderId" IS NULL
              AND so."importedAt" IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM "SalesChannel" channel
                 WHERE channel.id=so."salesChannelId"
                   AND (channel.type::text='ECOMMERCE' OR channel."platformCode" IS NOT NULL)
              )
            )
          )
        ORDER BY so."orderedAt" DESC,so."createdAt" DESC
        LIMIT 200`,
      actor.companyId,
      id,
      actor.role === "SALES",
    );
  }

  @Get(":id/tax-id-suggestions")
  async taxIdSuggestions(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    await this.assertCustomerVisible(actor, id);
    return this.taxIdSuggestionSnapshot(actor, id);
  }

  @Post(":id/tax-id-suggestions/search")
  async searchTaxIdSuggestions(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    await this.assertCustomerVisible(actor, id);
    const portfolioPartnerId = salesPortfolioPartnerId(actor);
    await this.db.$transaction(async (tx) => {
      await this.lockTaxIdSuggestionCompanyScope(actor, tx);
      await this.lockAndAssertSalesPortfolioCustomers(actor, [id], tx);
      const targets = await tx.$queryRawUnsafe<any[]>(
        `SELECT c.id,c.name,c."legalName",c."tradeName",c."postalCode",c.address,
                c."addressNumber",c.district,c.city,c.state,c."countryCode"
           FROM "Customer" c
          WHERE c.id=$1 AND c."companyId"=$2 AND c.active=true
            AND ($3::text IS NULL OR EXISTS (
              SELECT 1 FROM "StorefrontPartnerCustomer" portfolio
               WHERE portfolio."customerId"=c.id AND portfolio."partnerId"=$3
            ))
          FOR UPDATE OF c`,
        id,
        actor.companyId,
        portfolioPartnerId,
      );
      const target = targets[0];
      if (!target) {
        throw new NotFoundException("Cliente ativo não encontrado.");
      }
      if (String(target.countryCode ?? "BR").toUpperCase() !== "BR") {
        throw new BadRequestException(
          "A sugestão interna de CNPJ está disponível apenas para clientes do Brasil.",
        );
      }

      const customerRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT c.id,c.name,c."legalName",c."tradeName",c."taxId",c."postalCode",c.address,
                c."addressNumber",c.district,c.city,c.state,
                c."taxIdVerificationStatus"::text AS "taxIdVerificationStatus"
           FROM "Customer" c
          WHERE c."companyId"=$1 AND c.id<>$2 AND c.active=true
            AND c."taxIdVerificationStatus"::text IN ('VERIFIED_ACTIVE','CONFIRMED_INTERNAL')
            AND NULLIF(upper(regexp_replace(COALESCE(c."taxId",''),'[^0-9A-Za-z]','','g')),'') IS NOT NULL
            AND ($3::text IS NULL OR EXISTS (
              SELECT 1 FROM "StorefrontPartnerCustomer" portfolio
               WHERE portfolio."customerId"=c.id AND portfolio."partnerId"=$3
            ))
          ORDER BY c.id
          FOR UPDATE OF c`,
        actor.companyId,
        id,
        portfolioPartnerId,
      );
      await this.lockAndAssertSalesPortfolioCustomers(
        actor,
        [id, ...customerRows.map((row) => String(row.id))],
        tx,
      );
      const supplierRows =
        actor.role === "SALES"
          ? []
          : await tx.$queryRawUnsafe<any[]>(
              `SELECT s.id,s.name,s."legalName",s."tradeName",s."taxId",s."postalCode",s.address,
                      s.district,s.city,s.state,
                      s."taxIdVerificationStatus"::text AS "taxIdVerificationStatus"
                 FROM "Supplier" s
                WHERE s."companyId"=$1 AND s.active=true
                  AND s."taxIdVerificationStatus"::text IN ('VERIFIED_ACTIVE','CONFIRMED_INTERNAL')
                  AND NULLIF(upper(regexp_replace(COALESCE(s."taxId",''),'[^0-9A-Za-z]','','g')),'') IS NOT NULL
                ORDER BY s.id
                FOR UPDATE OF s`,
              actor.companyId,
            );

      const sourceRecords = new Map<string, any>();
      const candidates: InternalCnpjCandidateInput[] = [];
      for (const row of customerRows) {
        if (
          !isTrustedInternalTaxIdVerificationStatus(row.taxIdVerificationStatus)
        ) {
          continue;
        }
        sourceRecords.set(`CUSTOMER:${row.id}`, row);
        candidates.push({
          source: "CUSTOMER",
          sourceId: row.id,
          cnpj: row.taxId,
          name: row.tradeName ?? row.name,
          legalName: row.legalName,
          address: compactAddress(row.address, row.addressNumber, row.district),
          postalCode: row.postalCode,
          city: row.city,
          state: row.state,
        });
      }
      for (const row of supplierRows) {
        if (
          !isTrustedInternalTaxIdVerificationStatus(row.taxIdVerificationStatus)
        ) {
          continue;
        }
        sourceRecords.set(`SUPPLIER:${row.id}`, row);
        candidates.push({
          source: "SUPPLIER",
          sourceId: row.id,
          cnpj: row.taxId,
          name: row.tradeName ?? row.name,
          legalName: row.legalName,
          address: compactAddress(row.address, row.district),
          postalCode: row.postalCode,
          city: row.city,
          state: row.state,
        });
      }

      const result = suggestInternalCnpjs(
        {
          name: target.tradeName ?? target.name,
          legalName: target.legalName,
          address: compactAddress(
            target.address,
            target.addressNumber,
            target.district,
          ),
          postalCode: target.postalCode,
          city: target.city,
          state: target.state,
        },
        candidates,
      );
      if (!result.validQuery) {
        throw new BadRequestException({
          message: "Complete nome e localização antes de pesquisar o CNPJ.",
          issues: result.issues,
        });
      }
      const proposedSuggestions = result.suggestions.slice(0, 3);

      const activeRows = await tx.$queryRawUnsafe<
        Array<{ id: string; taxId: string; scoreReasons: unknown }>
      >(
        `SELECT id,"taxId","scoreReasons"
           FROM "CustomerTaxIdSuggestion"
          WHERE "companyId"=$1 AND "customerId"=$2
            AND status IN ('DRAFT','SELECTED')
          ORDER BY "createdAt" DESC
          FOR UPDATE`,
        actor.companyId,
        id,
      );
      const visibleRows: typeof activeRows = [];
      for (const row of activeRows) {
        try {
          if (actor.role === "SALES") {
            await this.lockAndAssertTaxIdSuggestionPortfolioScope(
              actor,
              id,
              row.scoreReasons,
              tx,
            );
          } else {
            await this.assertTaxIdSuggestionAllowed(
              actor,
              row.scoreReasons,
              tx,
            );
          }
          visibleRows.push(row);
        } catch (error) {
          if (actor.role !== "SALES") throw error;
        }
      }
      const visibleIds = visibleRows.map((row) => row.id);
      if (visibleIds.length > 0) {
        await tx.$executeRawUnsafe(
          `UPDATE "CustomerTaxIdSuggestion"
              SET status='REJECTED',"rejectedAt"=NOW(),"rejectedByUserId"=$3,
                  "rejectedByName"=$4,"updatedAt"=NOW()
            WHERE "companyId"=$1 AND "customerId"=$2
              AND id = ANY($5::text[]) AND status IN ('DRAFT','SELECTED')`,
          actor.companyId,
          id,
          actor.id ?? null,
          actorDisplayName(actor),
          visibleIds,
        );
      }

      for (const suggestion of proposedSuggestions) {
        const preferredSource = suggestion.sources[0];
        if (!preferredSource) continue;
        const sourceRow = sourceRecords.get(
          `${preferredSource.source}:${preferredSource.sourceId}`,
        );
        const internalSources = suggestion.sources.map((source) => {
          const row = sourceRecords.get(`${source.source}:${source.sourceId}`);
          return {
            ...source,
            taxIdVerificationStatus:
              row?.taxIdVerificationStatus ?? "NOT_VERIFIED",
          };
        });
        await tx.$executeRawUnsafe(
          `INSERT INTO "CustomerTaxIdSuggestion"
            (id,"companyId","customerId","taxId","legalName","tradeName","postalCode",address,
             "addressNumber",district,city,state,source,confidence,"scoreReasons","searchCriteria",
             status,"searchedByUserId","searchedByName","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,
                   'DRAFT',$17,$18,NOW(),NOW())`,
          randomUUID(),
          actor.companyId,
          id,
          suggestion.cnpj,
          suggestion.legalName ?? sourceRow?.legalName ?? null,
          suggestion.name ?? sourceRow?.tradeName ?? sourceRow?.name ?? null,
          suggestion.postalCode ?? sourceRow?.postalCode ?? null,
          sourceRow?.address ?? suggestion.address ?? null,
          sourceRow?.addressNumber ?? null,
          sourceRow?.district ?? null,
          suggestion.city ?? sourceRow?.city ?? null,
          suggestion.state ?? sourceRow?.state ?? null,
          `BBOS_INTERNAL:${suggestion.sources.map((item) => item.source).join("+")}`,
          suggestion.confidence,
          JSON.stringify({
            fieldScores: suggestion.fieldScores,
            matchReasons: suggestionMatchReasons(suggestion.fieldScores),
            internalSources,
          }),
          JSON.stringify(result.normalizedQuery),
          actor.id ?? null,
          actorDisplayName(actor),
        );
      }
    });

    return this.taxIdSuggestionSnapshot(actor, id);
  }

  @Post(":id/tax-id-suggestions/reject")
  async rejectTaxIdSuggestions(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: Record<string, unknown>,
  ) {
    const actor = await this.actor(request);
    await this.assertCustomerVisible(actor, id);
    if (body.acknowledged !== true) {
      throw new BadRequestException(
        "Confirme a decisão sobre as sugestões de CNPJ.",
      );
    }
    const reason = String(body.reason ?? "").trim();
    if (!["NONE_MATCH", "MANUAL_ENTRY"].includes(reason)) {
      throw new BadRequestException(
        'Informe reason como "NONE_MATCH" ou "MANUAL_ENTRY".',
      );
    }
    const verificationSource =
      reason === "NONE_MATCH"
        ? "BBOS_INTERNAL_NO_MATCH"
        : "BBOS_INTERNAL_MANUAL_ENTRY";

    await this.db.$transaction(async (tx) => {
      await this.lockTaxIdSuggestionCompanyScope(actor, tx);
      await this.lockAndAssertSalesPortfolioCustomers(actor, [id], tx);
      const customers = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          taxId: string | null;
          taxIdVerificationStatus: string;
          taxIdVerificationSource: string | null;
        }>
      >(
        `SELECT id,"taxId","taxIdVerificationStatus"::text AS "taxIdVerificationStatus",
                "taxIdVerificationSource"
           FROM "Customer"
          WHERE id=$1 AND "companyId"=$2
          FOR UPDATE`,
        id,
        actor.companyId,
      );
      const customer = customers[0];
      if (!customer) throw new NotFoundException("Cliente não encontrado.");

      const activeRows = await tx.$queryRawUnsafe<
        Array<{ id: string; scoreReasons: unknown }>
      >(
        `SELECT id,"scoreReasons"
           FROM "CustomerTaxIdSuggestion"
          WHERE "companyId"=$1 AND "customerId"=$2
            AND status IN ('DRAFT','SELECTED')
          FOR UPDATE`,
        actor.companyId,
        id,
      );
      const visibleIds: string[] = [];
      for (const row of activeRows) {
        try {
          if (actor.role === "SALES") {
            await this.lockAndAssertTaxIdSuggestionPortfolioScope(
              actor,
              id,
              row.scoreReasons,
              tx,
            );
          } else {
            await this.assertTaxIdSuggestionAllowed(
              actor,
              row.scoreReasons,
              tx,
            );
          }
          visibleIds.push(row.id);
        } catch (error) {
          if (actor.role !== "SALES") throw error;
        }
      }
      if (visibleIds.length === 0) {
        throw new BadRequestException(
          "Não há sugestões ativas de CNPJ para rejeitar.",
        );
      }
      await tx.$executeRawUnsafe(
        `UPDATE "CustomerTaxIdSuggestion"
            SET status='REJECTED',"rejectedAt"=NOW(),"rejectedByUserId"=$3,
                "rejectedByName"=$4,"updatedAt"=NOW()
          WHERE "companyId"=$1 AND "customerId"=$2
            AND id = ANY($5::text[]) AND status IN ('DRAFT','SELECTED')`,
        actor.companyId,
        id,
        actor.id ?? null,
        actorDisplayName(actor),
        visibleIds,
      );
      if (
        canUpdateInternalTaxIdRejectionMetadata(
          customer.taxIdVerificationStatus,
          customer.taxIdVerificationSource,
        )
      ) {
        await tx.$executeRawUnsafe(
          `UPDATE "Customer"
            SET "taxIdVerificationSource"=$3,
                "updatedAt"=NOW()
          WHERE id=$1 AND "companyId"=$2
            AND "taxIdVerificationStatus"='NOT_VERIFIED'::"TaxVerificationStatus"
            AND ("taxIdVerificationSource" IS NULL OR "taxIdVerificationSource" IN
                 ('','BBOS_INTERNAL_NO_MATCH','BBOS_INTERNAL_MANUAL_ENTRY'))`,
          id,
          actor.companyId,
          verificationSource,
        );
      }
    });

    return this.taxIdSuggestionSnapshot(actor, id);
  }

  @Post(":id/tax-id-suggestions/:suggestionId/confirm")
  async confirmTaxIdSuggestion(
    @Param("id") id: string,
    @Param("suggestionId") suggestionId: string,
    @Req() request: any,
    @Body() body: Record<string, unknown>,
  ) {
    const actor = await this.actor(request);
    await this.assertCustomerVisible(actor, id);
    if (body.acknowledged !== true) {
      throw new BadRequestException(
        "Confirme que o CNPJ selecionado pertence a este cliente.",
      );
    }

    await this.db.$transaction(async (tx) => {
      await this.lockTaxIdSuggestionCompanyScope(actor, tx);
      const customers = await tx.$queryRawUnsafe<
        Array<{ id: string; taxId: string | null }>
      >(
        `SELECT id,"taxId" FROM "Customer"
          WHERE id=$1 AND "companyId"=$2
          FOR UPDATE`,
        id,
        actor.companyId,
      );
      const customer = customers[0];
      if (!customer) throw new NotFoundException("Cliente não encontrado.");

      const lockedSuggestions = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          taxId: string;
          scoreReasons: unknown;
          status: string;
        }>
      >(
        `SELECT id,"taxId","scoreReasons",status
           FROM "CustomerTaxIdSuggestion"
          WHERE id=$1 AND "companyId"=$2 AND "customerId"=$3
          FOR UPDATE`,
        suggestionId,
        actor.companyId,
        id,
      );
      const lockedSuggestion = lockedSuggestions[0];
      if (!lockedSuggestion) {
        throw new NotFoundException("Sugestão de CNPJ não encontrada.");
      }
      await this.lockAndAssertTaxIdSuggestionPortfolioScope(
        actor,
        id,
        lockedSuggestion.scoreReasons,
        tx,
      );
      await this.assertTaxIdSuggestionAllowed(
        actor,
        lockedSuggestion.scoreReasons,
        tx,
      );
      const normalizedSuggestionCnpj = normalizeCnpj(lockedSuggestion.taxId);
      if (!normalizedSuggestionCnpj || !isValidCnpj(normalizedSuggestionCnpj)) {
        throw new BadRequestException("A sugestão contém um CNPJ inválido.");
      }
      if (
        lockedSuggestion.status === "CONFIRMED" &&
        normalizeCnpj(customer.taxId) === normalizedSuggestionCnpj
      ) {
        return;
      }
      if (!["DRAFT", "SELECTED"].includes(lockedSuggestion.status)) {
        throw new BadRequestException(
          "Esta sugestão não está mais disponível para confirmação.",
        );
      }

      const canonicalCnpj = await this.assertTaxIdSuggestionEvidenceCurrent(
        actor,
        lockedSuggestion.taxId,
        lockedSuggestion.scoreReasons,
        tx,
      );

      await tx.$queryRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1)) IS NULL AS locked`,
        `${actor.companyId}:${canonicalCnpj}`,
      );
      const duplicate = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "Customer"
          WHERE "companyId"=$1 AND id<>$2
            AND upper(regexp_replace(COALESCE("taxId",''),'[^0-9A-Za-z]','','g'))=$3
          LIMIT 1`,
        actor.companyId,
        id,
        canonicalCnpj,
      );
      if (duplicate[0]) {
        throw new ConflictException(
          "Este CNPJ já está cadastrado em outro cliente desta empresa.",
        );
      }

      await tx.$executeRawUnsafe(
        `UPDATE "Customer"
            SET "taxId"=$3,
                "taxIdVerificationStatus"='CONFIRMED_INTERNAL'::"TaxVerificationStatus",
                "taxIdVerifiedAt"=NOW(),
                "taxIdVerificationSource"=$4,
                "updatedAt"=NOW()
          WHERE id=$1 AND "companyId"=$2`,
        id,
        actor.companyId,
        canonicalCnpj,
        `BBOS_INTERNAL_CONFIRMED:${suggestionId}`,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "CustomerTaxIdSuggestion"
            SET status='CONFIRMED',
                "selectedAt"=COALESCE("selectedAt",NOW()),
                "selectedByUserId"=COALESCE("selectedByUserId",$4),
                "selectedByName"=COALESCE("selectedByName",$5),
                "confirmedAt"=COALESCE("confirmedAt",NOW()),
                "confirmedByUserId"=COALESCE("confirmedByUserId",$4),
                "confirmedByName"=COALESCE("confirmedByName",$5),
                "updatedAt"=NOW()
          WHERE id=$1 AND "companyId"=$2 AND "customerId"=$3`,
        suggestionId,
        actor.companyId,
        id,
        actor.id ?? null,
        actorDisplayName(actor),
      );
      await tx.$executeRawUnsafe(
        `UPDATE "CustomerTaxIdSuggestion"
            SET status='REJECTED',"rejectedAt"=NOW(),"rejectedByUserId"=$4,
                "rejectedByName"=$5,"updatedAt"=NOW()
          WHERE "companyId"=$1 AND "customerId"=$2 AND id<>$3
            AND status IN ('DRAFT','SELECTED')`,
        actor.companyId,
        id,
        suggestionId,
        actor.id ?? null,
        actorDisplayName(actor),
      );
    });

    return this.taxIdSuggestionSnapshot(actor, id);
  }

  @Get(":id/visits")
  async visitHistory(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    await this.assertCustomerVisible(actor, id);
    const customer = await this.db.customer.findFirst({
      where: { id, companyId: actor.companyId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException("Cliente não encontrado.");

    return this.db.$queryRawUnsafe<any[]>(
      `SELECT v.id,v."recordedByName",v."visitAt",v."contactName",v.purpose,v.outcome,
              v.facts,v."nextAction",v."nextActionAt",v."createdAt",
              partner.name AS "partnerName"
         FROM "CustomerVisit" v
         LEFT JOIN "StorefrontPartner" partner ON partner.id=v."storefrontPartnerId"
        WHERE v."companyId"=$1 AND v."customerId"=$2
        ORDER BY v."visitAt" DESC,v."createdAt" DESC
        LIMIT 200`,
      actor.companyId,
      id,
    );
  }

  @Get("visits/recent")
  async recentVisits(@Req() request: any) {
    const actor = await this.actor(request);
    const partnerId = salesPortfolioPartnerId(actor);
    return this.db.$queryRawUnsafe<any[]>(
      `SELECT v.id,v."customerId",v."recordedByName",v."visitAt",v."contactName",
              v.purpose,v.outcome,v.facts,v."nextAction",v."nextActionAt",v."createdAt",
              c.name AS "customerName",c."tradeName" AS "customerTradeName"
         FROM "CustomerVisit" v
         JOIN "Customer" c ON c.id=v."customerId" AND c."companyId"=v."companyId"
        WHERE v."companyId"=$1
          AND ($2::text IS NULL OR EXISTS (
            SELECT 1 FROM "StorefrontPartnerCustomer" portfolio
             WHERE portfolio."customerId"=v."customerId"
               AND portfolio."partnerId"=$2
          ))
        ORDER BY v."visitAt" DESC,v."createdAt" DESC
        LIMIT 300`,
      actor.companyId,
      partnerId,
    );
  }

  @Post(":id/visits")
  async createVisit(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: Record<string, unknown>,
  ) {
    const actor = await this.actor(request);
    const partnerId = await assertCustomerInSalesPortfolio(this.db, actor, id);
    const customer = await this.db.customer.findFirst({
      where: { id, companyId: actor.companyId, active: true },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException("Cliente ativo não encontrado.");
    }

    const input = parseCustomerVisitInput(body);
    const visitId = randomUUID();
    await this.db.$executeRawUnsafe(
      `INSERT INTO "CustomerVisit"
        (id,"companyId","customerId","storefrontPartnerId","recordedByUserId","recordedByName",
         "visitAt","contactName",purpose,outcome,facts,"nextAction","nextActionAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())`,
      visitId,
      actor.companyId,
      id,
      partnerId,
      actor.id ?? null,
      actor.name,
      input.visitAt,
      input.contactName,
      input.purpose,
      input.outcome,
      input.facts,
      input.nextAction,
      input.nextActionAt,
    );
    return { id: visitId, ok: true };
  }

  @Post()
  async create(@Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.actor(request);
    const partnerId = salesPortfolioPartnerId(actor);
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
            AND upper(regexp_replace(COALESCE("taxId",''),'[^0-9A-Za-z]','','g'))=$2
          LIMIT 1`,
        actor.companyId,
        taxId,
      );
      if (duplicate[0])
        throw new BadRequestException(
          "CPF/CNPJ já cadastrado para esta empresa.",
        );
    }
    if (fiscal.isForeign && fiscal.foreignTaxId) {
      const duplicate = await this.db.$queryRawUnsafe<any[]>(
        `SELECT id FROM "Customer"
          WHERE "companyId"=$1 AND UPPER("countryCode")=$2
            AND UPPER(COALESCE("foreignTaxId",''))=UPPER($3)
          LIMIT 1`,
        actor.companyId,
        fiscal.countryCode,
        fiscal.foreignTaxId,
      );
      if (duplicate[0]) {
        throw new BadRequestException(
          "Identificação fiscal estrangeira já cadastrada para este país.",
        );
      }
    }
    const paymentTerms = body.paymentTerms?.trim() || "À vista";
    const initialCreditStatus = isCashTerm(paymentTerms)
      ? "NOT_ANALYZED"
      : "UNDER_REVIEW";
    const id = randomUUID();
    const rows = await this.db.$transaction(async (transaction) => {
      const created = await transaction.$queryRawUnsafe<any[]>(
        `INSERT INTO "Customer"
        (id, "companyId", name, "legalName", "tradeName", "taxId", "countryCode", "countryName", "foreignTaxId", segment,
         email, phone, "postalCode", address, "addressNumber", "addressComplement", district, city, state,
         "stateRegistration", "stateRegistrationType",
         "paymentTerms", active, "creditStatus", "creditLimit", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,0,NOW(),NOW())
       RETURNING *`,
        id,
        actor.companyId,
        name,
        fiscal.legalName || null,
        body.tradeName?.trim() || null,
        taxId || null,
        fiscal.countryCode,
        fiscal.countryName,
        fiscal.foreignTaxId || null,
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
      if (partnerId) {
        await transaction.storefrontPartnerCustomer.create({
          data: { partnerId, customerId: id },
        });
      }
      return created;
    });
    return this.decorate(rows[0], null);
  }

  @Post(":id/credit-request")
  async requestCredit(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: Record<string, any>,
  ) {
    const actor = await this.actor(request);
    await this.assertCustomerVisible(actor, id);
    const customer = (
      await this.db.$queryRawUnsafe<any[]>(
        `SELECT id,name,"companyId","creditStatus","creditLimit","paymentTerms"
           FROM "Customer" WHERE id=$1 AND "companyId"=$2`,
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
    const requestEventId = randomUUID();
    await this.db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO "CustomerCreditEvent"
          (id, "companyId", "customerId", "eventType", "requestedLimit", "requestedTerms", "monthlyVolume", rationale,
           "actorId", "actorName", "actorRole", "createdAt")
         VALUES ($1,$2,$3,'REQUEST',$4,$5,$6,$7,$8,$9,$10,NOW())`,
        requestEventId,
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
      const notificationMessage = `${actor.name} solicitou ${requestedLimit.toLocaleString(
        "pt-BR",
        { style: "currency", currency: "BRL" },
      )} de crédito para ${customer.name}, na condição ${requestedTerms}.`;
      for (const targetRole of ["ADMIN", "EXECUTIVE"]) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "OperationalNotification"
            (id,"companyId",type,title,message,"targetRole","createdAt")
           VALUES ($1,$2,$3,'Crédito aguardando decisão',$4,$5,NOW())`,
          randomUUID(),
          actor.companyId,
          `CREDIT_REQUEST:${id}:${targetRole}:${requestEventId}`,
          notificationMessage,
          targetRole,
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
    await this.assertCustomerVisible(actor, id);
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
      countryCode:
        body.countryCode === undefined ? current.countryCode : body.countryCode,
      countryName:
        body.countryName === undefined ? current.countryName : body.countryName,
      foreignTaxId:
        body.foreignTaxId === undefined
          ? current.foreignTaxId
          : body.foreignTaxId,
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
    const taxIdChanged = normalizeCnpj(taxId) !== normalizeCnpj(current.taxId);
    if (taxId && taxIdChanged) {
      const duplicate = await this.db.$queryRawUnsafe<any[]>(
        `SELECT id FROM "Customer"
          WHERE "companyId"=$1 AND id<>$2
            AND upper(regexp_replace(COALESCE("taxId",''),'[^0-9A-Za-z]','','g'))=$3
          LIMIT 1`,
        actor.companyId,
        id,
        taxId,
      );
      if (duplicate[0])
        throw new ConflictException(
          "CPF/CNPJ já cadastrado para esta empresa.",
        );
    }
    if (fiscal.isForeign && fiscal.foreignTaxId) {
      const duplicate = await this.db.$queryRawUnsafe<any[]>(
        `SELECT id FROM "Customer"
          WHERE "companyId"=$1 AND id<>$2 AND UPPER("countryCode")=$3
            AND UPPER(COALESCE("foreignTaxId",''))=UPPER($4)
          LIMIT 1`,
        actor.companyId,
        id,
        fiscal.countryCode,
        fiscal.foreignTaxId,
      );
      if (duplicate[0]) {
        throw new BadRequestException(
          "Identificação fiscal estrangeira já cadastrada para este país.",
        );
      }
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
    const rows = await this.db.$transaction(async (tx) => {
      // Keep the same lock order used by CNPJ confirmation: customer row first,
      // then the CNPJ advisory lock. Besides preventing lost updates, this avoids
      // a row-lock/advisory-lock deadlock when PATCH and /confirm run together.
      const lockedCurrent = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "Customer"
          WHERE id=$1 AND "companyId"=$2 AND "updatedAt"=$3::timestamptz
          FOR UPDATE`,
        id,
        actor.companyId,
        current.updatedAt,
      );
      if (!lockedCurrent[0]) {
        throw new ConflictException(
          "Este cliente foi alterado por outra ação. Recarregue os dados e tente novamente.",
        );
      }

      if (taxId && taxIdChanged) {
        await tx.$queryRawUnsafe(
          `SELECT pg_advisory_xact_lock(hashtext($1)) IS NULL AS locked`,
          `${actor.companyId}:${taxId}`,
        );
        const duplicate = await tx.$queryRawUnsafe<any[]>(
          `SELECT id FROM "Customer"
            WHERE "companyId"=$1 AND id<>$2
              AND upper(regexp_replace(COALESCE("taxId",''),'[^0-9A-Za-z]','','g'))=$3
            LIMIT 1`,
          actor.companyId,
          id,
          taxId,
        );
        if (duplicate[0]) {
          throw new ConflictException(
            "CPF/CNPJ já cadastrado para esta empresa.",
          );
        }
      }
      const updatedRows = await tx.$queryRawUnsafe<any[]>(
        `UPDATE "Customer" SET name=$3, "legalName"=$4, "tradeName"=$5, "taxId"=$6,
         "countryCode"=$7, "countryName"=$8, "foreignTaxId"=$9, segment=$10,
         email=$11, phone=$12, "postalCode"=$13, address=$14, "addressNumber"=$15,
         "addressComplement"=$16, district=$17, city=$18, state=$19,
         "stateRegistration"=$20, "stateRegistrationType"=$21,
         "paymentTerms"=$22, active=$23, "creditStatus"=$24,
         "taxIdVerificationStatus"=CASE
           WHEN $25::boolean THEN 'NOT_VERIFIED'::"TaxVerificationStatus"
           ELSE "taxIdVerificationStatus"
         END,
         "taxIdVerifiedAt"=CASE
           WHEN $25::boolean THEN NULL
           ELSE "taxIdVerifiedAt"
         END,
         "taxIdVerificationSource"=CASE
           WHEN $25::boolean THEN 'MANUAL_ENTRY'
           ELSE "taxIdVerificationSource"
         END,
         "updatedAt"=NOW()
       WHERE id=$1 AND "companyId"=$2 AND "updatedAt"=$26::timestamptz RETURNING *`,
        id,
        actor.companyId,
        name,
        fiscal.legalName || null,
        body.tradeName === undefined
          ? current.tradeName
          : body.tradeName?.trim() || null,
        taxId || null,
        fiscal.countryCode,
        fiscal.countryName,
        fiscal.foreignTaxId || null,
        body.segment === undefined
          ? current.segment
          : body.segment?.trim() || null,
        body.email === undefined ? current.email : body.email?.trim() || null,
        body.phone === undefined
          ? current.phone
          : internationalPhone(body.phone),
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
        taxIdChanged,
        current.updatedAt,
      );

      if (!updatedRows[0]) {
        throw new ConflictException(
          "Este cliente foi alterado por outra ação. Recarregue os dados e tente novamente.",
        );
      }

      if (taxIdChanged) {
        await tx.$executeRawUnsafe(
          `UPDATE "CustomerTaxIdSuggestion"
              SET status='REJECTED',
                  "rejectedAt"=COALESCE("rejectedAt",NOW()),
                  "rejectedByUserId"=COALESCE("rejectedByUserId",$3),
                  "rejectedByName"=COALESCE("rejectedByName",$4),
                  "updatedAt"=NOW()
            WHERE "companyId"=$1 AND "customerId"=$2
              AND status IN ('DRAFT','SELECTED')`,
          actor.companyId,
          id,
          actor.id ?? null,
          actorDisplayName(actor),
        );
      }

      return updatedRows;
    });
    const financial = (await this.health(actor.companyId, id))[0];
    return this.decorate(rows[0], financial);
  }

  @Get(":id/payment-weekday")
  async paymentWeekday(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    const rows = await this.db.$queryRawUnsafe<Array<{ paymentWeekday: number | null }>>(
      `SELECT "paymentWeekday" FROM "Customer" WHERE id=$1 AND "companyId"=$2`,
      id,
      actor.companyId,
    );
    if (!rows[0]) throw new NotFoundException("Cliente não encontrado.");
    return { weekday: rows[0].paymentWeekday === null ? null : Number(rows[0].paymentWeekday) };
  }

  /** Dia fixo de pagamento (ex.: só às quintas). Só José ou Suzi. */
  @Patch(":id/payment-weekday")
  async setPaymentWeekday(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: unknown,
  ) {
    const actor = await this.actor(request);
    if (!isDesignatedTermCreditApprover(actor)) {
      throw new UnauthorizedException("Somente José ou Suzi podem definir o dia de pagamento do cliente.");
    }
    let weekday: number | null;
    try { weekday = parsePaymentWeekday(body); }
    catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Dia de pagamento inválido.");
    }
    const rows = await this.db.$queryRawUnsafe<Array<{ id: string }>>(
      `UPDATE "Customer" SET "paymentWeekday"=$3
        WHERE id=$1 AND "companyId"=$2 RETURNING id`,
      id,
      actor.companyId,
      weekday,
    );
    if (!rows[0]) throw new NotFoundException("Cliente não encontrado.");
    return { ok: true, weekday };
  }

  @Patch(":id/credit")
  async credit(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: Record<string, any>,
  ) {
    const actor = await this.actor(request);
    if (!isDesignatedTermCreditApprover(actor)) {
      throw new UnauthorizedException(
        "Somente José ou Suzi podem aprovar ou rejeitar crédito.",
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
    const decisionEventId = randomUUID();
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
        decisionEventId,
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
      await tx.$executeRawUnsafe(
        `INSERT INTO "OperationalNotification"
          (id,"companyId",type,title,message,"targetRole","createdAt")
         VALUES ($1,$2,$3,$4,$5,'SALES',NOW())`,
        randomUUID(),
        actor.companyId,
        `CREDIT_DECISION:${id}:${decisionEventId}`,
        status === "APPROVED"
          ? "Crédito aprovado"
          : "Decisão de crédito registrada",
        `${actor.name} definiu o crédito de ${updated.name} como ${status === "APPROVED" ? "aprovado" : status === "REJECTED" ? "reprovado" : "em análise"}, com limite de ${limit.toLocaleString(
          "pt-BR",
          { style: "currency", currency: "BRL" },
        )}.`,
      );
    });

    const financial = (await this.health(actor.companyId, id))[0];
    return this.decorate(updated, financial);
  }
}
