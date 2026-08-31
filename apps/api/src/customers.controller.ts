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

  @Get()
  async list(@Req() request: any) {
    const actor = await this.actor(request);
    return this.db.$queryRawUnsafe<any[]>(
      `SELECT id, "companyId", name, "legalName", "tradeName", "taxId", segment,
              email, phone, "postalCode", address, district, city, state,
              "paymentTerms", active, "creditStatus", "creditLimit", "creditNotes",
              "creditReviewedAt", "creditReviewedBy", "createdAt", "updatedAt"
         FROM "Customer"
        WHERE "companyId" = $1
        ORDER BY name ASC`,
      actor.companyId,
    );
  }

  @Post()
  async create(@Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.actor(request);
    const name = String(body.name ?? body.tradeName ?? body.legalName ?? "").trim();
    if (!name) throw new BadRequestException("Nome do cliente é obrigatório.");

    const taxId = body.taxId ? String(body.taxId).trim() : null;
    if (taxId) {
      const duplicate = await this.db.customer.findFirst({
        where: { companyId: actor.companyId, taxId },
      });
      if (duplicate) throw new BadRequestException("CPF/CNPJ já cadastrado para esta empresa.");
    }

    const id = randomUUID();
    const rows = await this.db.$queryRawUnsafe<any[]>(
      `INSERT INTO "Customer"
        (id, "companyId", name, "legalName", "tradeName", "taxId", segment,
         email, phone, "postalCode", address, district, city, state,
         "paymentTerms", active, "creditStatus", "creditLimit", "createdAt", "updatedAt")
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'NOT_ANALYZED',0,NOW(),NOW())
       RETURNING *`,
      id,
      actor.companyId,
      name,
      body.legalName?.trim() || null,
      body.tradeName?.trim() || null,
      taxId,
      body.segment?.trim() || null,
      body.email?.trim() || null,
      body.phone?.trim() || null,
      body.postalCode?.trim() || null,
      body.address?.trim() || null,
      body.district?.trim() || null,
      body.city?.trim() || null,
      body.state?.trim() || null,
      body.paymentTerms?.trim() || null,
      body.active !== false,
    );
    return rows[0];
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.actor(request);
    const existing = await this.db.customer.findFirst({ where: { id, companyId: actor.companyId } });
    if (!existing) throw new NotFoundException("Cliente não encontrado.");

    const name = String(body.name ?? existing.name).trim();
    if (!name) throw new BadRequestException("Nome do cliente é obrigatório.");
    const taxId = body.taxId === undefined ? existing.taxId : (body.taxId ? String(body.taxId).trim() : null);
    if (taxId && taxId !== existing.taxId) {
      const duplicate = await this.db.customer.findFirst({
        where: { companyId: actor.companyId, taxId, NOT: { id } },
      });
      if (duplicate) throw new BadRequestException("CPF/CNPJ já cadastrado para esta empresa.");
    }

    const current = (await this.db.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Customer" WHERE id = $1 AND "companyId" = $2`, id, actor.companyId,
    ))[0];

    const rows = await this.db.$queryRawUnsafe<any[]>(
      `UPDATE "Customer" SET
         name=$3, "legalName"=$4, "tradeName"=$5, "taxId"=$6, segment=$7,
         email=$8, phone=$9, "postalCode"=$10, address=$11, district=$12,
         city=$13, state=$14, "paymentTerms"=$15, active=$16, "updatedAt"=NOW()
       WHERE id=$1 AND "companyId"=$2
       RETURNING *`,
      id,
      actor.companyId,
      name,
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
    return rows[0];
  }

  @Patch(":id/credit")
  async credit(@Param("id") id: string, @Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.actor(request);
    if (!["ADMIN", "EXECUTIVE", "FINANCE"].includes(actor.role)) {
      throw new UnauthorizedException("A análise de crédito é restrita à administração/financeiro.");
    }
    const status = String(body.status ?? "").toUpperCase();
    if (!CREDIT_STATUSES.includes(status as any)) {
      throw new BadRequestException("Status de crédito inválido.");
    }
    const limit = Number(body.creditLimit ?? 0);
    if (!Number.isFinite(limit) || limit < 0) throw new BadRequestException("Limite de crédito inválido.");

    const rows = await this.db.$queryRawUnsafe<any[]>(
      `UPDATE "Customer" SET
         "creditStatus"=$3,
         "creditLimit"=$4,
         "creditNotes"=$5,
         "creditReviewedAt"=NOW(),
         "creditReviewedBy"=$6,
         "updatedAt"=NOW()
       WHERE id=$1 AND "companyId"=$2
       RETURNING *`,
      id,
      actor.companyId,
      status,
      limit,
      body.notes?.trim() || null,
      actor.name,
    );
    if (!rows.length) throw new NotFoundException("Cliente não encontrado.");
    return rows[0];
  }
}
