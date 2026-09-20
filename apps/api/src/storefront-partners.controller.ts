import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { AuthService } from "./auth.service";

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
  private readonly database = new PrismaClient();
  constructor(private readonly auth: AuthService) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  @Get()
  async list(@Req() request: any) {
    const actor = await this.actor(request);
    return this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "StorefrontPartner" WHERE "companyId"=$1 ORDER BY name ASC`,
      actor.companyId,
    );
  }

  @Post()
  async create(@Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.actor(request);
    const name = String(body.name ?? "").trim();
    if (!name) throw new BadRequestException("Nome do parceiro é obrigatório.");
    const taxId = String(body.taxId ?? "").replace(/\D/g, "") || null;
    if (taxId) {
      const duplicate = await this.database.$queryRawUnsafe<any[]>(
        `SELECT id FROM "StorefrontPartner" WHERE "companyId"=$1 AND "taxId"=$2 LIMIT 1`,
        actor.companyId,
        taxId,
      );
      if (duplicate[0])
        throw new BadRequestException(
          "CPF/CNPJ já cadastrado para outro parceiro.",
        );
    }
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `INSERT INTO "StorefrontPartner"
        (id,"companyId",name,"taxId","contactName",phone,email,"pixKey",active,"createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()) RETURNING *`,
      randomUUID(),
      actor.companyId,
      name,
      taxId,
      String(body.contactName ?? "").trim() || null,
      internationalPhone(body.phone),
      String(body.email ?? "").trim() || null,
      String(body.pixKey ?? "").trim() || null,
      body.active !== false,
    );
    return rows[0];
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: Record<string, any>,
  ) {
    const actor = await this.actor(request);
    const current = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "StorefrontPartner" WHERE id=$1 AND "companyId"=$2 LIMIT 1`,
      id,
      actor.companyId,
    );
    if (!current[0]) throw new BadRequestException("Parceiro não encontrado.");
    const value = { ...current[0], ...body };
    const name = String(value.name ?? "").trim();
    if (!name) throw new BadRequestException("Nome do parceiro é obrigatório.");
    const taxId = String(value.taxId ?? "").replace(/\D/g, "") || null;
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `UPDATE "StorefrontPartner" SET name=$3,"taxId"=$4,"contactName"=$5,phone=$6,email=$7,"pixKey"=$8,active=$9,"updatedAt"=NOW()
        WHERE id=$1 AND "companyId"=$2 RETURNING *`,
      id,
      actor.companyId,
      name,
      taxId,
      String(value.contactName ?? "").trim() || null,
      internationalPhone(value.phone),
      String(value.email ?? "").trim() || null,
      String(value.pixKey ?? "").trim() || null,
      value.active !== false,
    );
    return rows[0];
  }
}
