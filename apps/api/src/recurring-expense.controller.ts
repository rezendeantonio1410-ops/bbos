import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Req, UnauthorizedException } from "@nestjs/common";
import { prisma } from "@bbos/database";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { recurringKey, validateRecurring, type RecurringCandidate } from "./recurring-expenses";

function validate(body: Parameters<typeof validateRecurring>[0], required: boolean) {
  try {
    return validateRecurring(body, required);
  } catch (error) {
    throw new BadRequestException((error as Error).message);
  }
}

type Row = { id: string; key: string; label: string; category: string; amount: number; dayOfMonth: number; active: boolean; source: string; userEdited: boolean; lastPaidAt: Date | null };
const COLUMNS = `"id","key","label","category","amount"::float AS "amount","dayOfMonth","active","source","userEdited","lastPaidAt"`;

/** Grava o que o extrato ensinou, sem desfazer o que a pessoa corrigiu à mão. */
export async function upsertRecurring(companyId: string, candidates: RecurringCandidate[], actorName: string) {
  for (const c of candidates) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "RecurringExpense" ("id","companyId","key","label","category","amount","dayOfMonth","lastPaidAt","updatedByName")
       VALUES ($1,$2,$3,$4,$5,$6::numeric,$7,$8::timestamp,$9)
       ON CONFLICT ("companyId","key") DO UPDATE SET
         "lastPaidAt" = GREATEST("RecurringExpense"."lastPaidAt", EXCLUDED."lastPaidAt"),
         "label" = CASE WHEN "RecurringExpense"."userEdited" THEN "RecurringExpense"."label" ELSE EXCLUDED."label" END,
         "category" = CASE WHEN "RecurringExpense"."userEdited" THEN "RecurringExpense"."category" ELSE EXCLUDED."category" END,
         "amount" = CASE WHEN "RecurringExpense"."userEdited" THEN "RecurringExpense"."amount" ELSE EXCLUDED."amount" END,
         "dayOfMonth" = CASE WHEN "RecurringExpense"."userEdited" THEN "RecurringExpense"."dayOfMonth" ELSE EXCLUDED."dayOfMonth" END,
         "updatedAt" = NOW()`,
      randomUUID(), companyId, c.key, c.label.slice(0, 160), c.category, c.amount.toFixed(2), c.dayOfMonth, `${c.lastPaidAt}T12:00:00`, actorName.slice(0, 120),
    );
  }
}

/** Despesas fixas previstas: listar, corrigir valor/dia, desligar ou cadastrar à mão. */
@Controller("finance/recurring-expenses")
export class RecurringExpenseController {
  constructor(private readonly auth: AuthService) {}

  private async actor(req: Request) {
    const actor = await this.auth.resolve(this.auth.readToken(req));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  @Get()
  async list(@Req() req: Request) {
    const actor = await this.actor(req);
    return prisma.$queryRawUnsafe<Row[]>(`SELECT ${COLUMNS} FROM "RecurringExpense" WHERE "companyId"=$1 ORDER BY "active" DESC, "amount" DESC`, actor.companyId);
  }

  @Post()
  async create(@Body() body: { label?: string; category?: string; amount?: number; dayOfMonth?: number }, @Req() req: Request) {
    const actor = await this.actor(req);
    const input = validate(body, true);
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `INSERT INTO "RecurringExpense" ("id","companyId","key","label","category","amount","dayOfMonth","source","userEdited","updatedByName")
       VALUES ($1,$2,$3,$4,$5,$6::numeric,$7,'MANUAL',TRUE,$8) RETURNING ${COLUMNS}`,
      randomUUID(), actor.companyId, `MANUAL ${recurringKey("", input.label!)}`.slice(0, 80), input.label, input.category, input.amount!.toFixed(2), input.dayOfMonth, actor.name.slice(0, 120),
    ).catch(() => { throw new BadRequestException("Já existe uma despesa fixa com esse nome."); });
    return rows[0];
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: { label?: string; category?: string; amount?: number; dayOfMonth?: number; active?: boolean }, @Req() req: Request) {
    const actor = await this.actor(req);
    const input = validate(body, false);
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `UPDATE "RecurringExpense" SET
         "label"=COALESCE($3,"label"), "category"=COALESCE($4,"category"), "amount"=COALESCE($5::numeric,"amount"),
         "dayOfMonth"=COALESCE($6,"dayOfMonth"), "active"=COALESCE($7,"active"), "userEdited"=TRUE, "updatedByName"=$8, "updatedAt"=NOW()
       WHERE "id"=$1 AND "companyId"=$2 RETURNING ${COLUMNS}`,
      id, actor.companyId, input.label ?? null, input.category ?? null, input.amount === undefined ? null : input.amount.toFixed(2), input.dayOfMonth ?? null,
      typeof body?.active === "boolean" ? body.active : null, actor.name.slice(0, 120),
    );
    if (!rows[0]) throw new NotFoundException("Despesa fixa não encontrada.");
    return rows[0];
  }
}

