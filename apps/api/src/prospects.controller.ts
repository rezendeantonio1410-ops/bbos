import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { prisma } from "@bbos/database";
import { AuthService } from "./auth.service";
import { parseCustomerVisitInput } from "./customer-visit-input";
import {
  PROSPECT_STAGES,
  type ProspectImportRow,
  mapProspectSheet,
  parseProspectPatch,
} from "./prospect-input";
import { readXlsxRows } from "./xlsx-reader";

const PROSPECT_COLUMNS = `p.id,p.name,p.segment,p."taxId",p."legalName",p."tradeName",p."contactName",p.phone,p.email,
  p."postalCode",p.address,p."addressNumber",p.district,p.city,p.state,p.profile,p."openingHours",p.potential,
  p."espressoMachine",p."machineNotes",p."currentSupplier",p."monthlyVolumeKg"::float AS "monthlyVolumeKg",p.stage,
  p."lostReason",p.notes,p.latitude,p.longitude,p."lastContactAt",p."nextAction",p."nextActionAt",
  p."customerId",p."convertedAt",p."createdAt",p."updatedAt",p."geocodeSource",
  p."suggestedTaxId",p."suggestedTaxIdConfidence",p."suggestedTaxIdReason"`;

/** Fields a visit can change: an edit to one of these resets the coordinates. */
const ADDRESS_FIELDS = ["postalCode", "address", "addressNumber", "district", "city", "state"];

/** Prospects (pré-cadastros) shared by the whole commercial team. */
@Controller("prospects")
export class ProspectsController {
  private readonly db: any = prisma;

  constructor(private readonly auth: AuthService) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  private async findProspect(companyId: string, id: string) {
    const rows = await this.db.$queryRawUnsafe(
      `SELECT ${PROSPECT_COLUMNS} FROM "Prospect" p WHERE p.id=$1 AND p."companyId"=$2 LIMIT 1`,
      id,
      companyId,
    );
    if (!rows[0]) throw new NotFoundException("Pré-cadastro não encontrado.");
    return rows[0];
  }

  @Get()
  async list(@Req() request: any, @Query("stage") stage?: string) {
    const actor = await this.actor(request);
    const stageFilter = stage && stage in PROSPECT_STAGES ? stage : null;
    return this.db.$queryRawUnsafe(
      `SELECT ${PROSPECT_COLUMNS},
              last_visit."visitAt" AS "lastVisitAt",last_visit."recordedByName" AS "lastVisitBy",
              (SELECT COUNT(*)::int FROM "ProspectVisit" v WHERE v."prospectId"=p.id) AS "visitCount"
         FROM "Prospect" p
         LEFT JOIN LATERAL (
           SELECT v."visitAt",v."recordedByName" FROM "ProspectVisit" v
            WHERE v."prospectId"=p.id ORDER BY v."visitAt" DESC LIMIT 1
         ) last_visit ON TRUE
        WHERE p."companyId"=$1 AND ($2::text IS NULL OR p.stage=$2)
        ORDER BY p.city NULLS LAST,p.name
        LIMIT 2000`,
      actor.companyId,
      stageFilter,
    );
  }

  @Get(":id")
  async detail(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    const prospect = await this.findProspect(actor.companyId, id);
    const visits = await this.db.$queryRawUnsafe(
      `SELECT id,"recordedByName","visitAt","contactName",purpose,outcome,facts,"nextAction","nextActionAt","createdAt"
         FROM "ProspectVisit" WHERE "prospectId"=$1 AND "companyId"=$2
        ORDER BY "visitAt" DESC LIMIT 100`,
      id,
      actor.companyId,
    );
    return { ...prospect, visits };
  }

  @Post()
  async create(@Req() request: any, @Body() body: Record<string, unknown>) {
    const actor = await this.actor(request);
    const patch = parseProspectPatch(body);
    if (!patch.name) throw new BadRequestException("Informe o nome do estabelecimento.");
    const id = randomUUID();
    await this.db.$executeRawUnsafe(
      `INSERT INTO "Prospect" (id,"companyId","createdByUserId","createdAt","updatedAt",name)
       VALUES ($1,$2,$3,NOW(),NOW(),$4)`,
      id,
      actor.companyId,
      actor.id ?? null,
      patch.name,
    );
    await this.applyPatch(actor.companyId, id, patch);
    return this.findProspect(actor.companyId, id);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Req() request: any, @Body() body: Record<string, unknown>) {
    const actor = await this.actor(request);
    await this.findProspect(actor.companyId, id);
    await this.applyPatch(actor.companyId, id, parseProspectPatch(body));
    return this.findProspect(actor.companyId, id);
  }

  private async applyPatch(companyId: string, id: string, patch: Record<string, unknown>) {
    const entries = Object.entries(patch);
    if (!entries.length) return;
    const assignments = entries.map(([field], index) => `"${field}"=$${index + 3}`);
    const addressChanged = entries.some(([field]) => ADDRESS_FIELDS.includes(field));
    const gpsGiven = "latitude" in patch;
    if (gpsGiven) assignments.push(`"geocodedAt"=NOW()`, `"geocodeSource"='GPS'`);
    else if (addressChanged)
      // A new address invalidates old coordinates (except precise GPS pins).
      assignments.push(
        `latitude=CASE WHEN "geocodeSource"='GPS' THEN latitude ELSE NULL END`,
        `longitude=CASE WHEN "geocodeSource"='GPS' THEN longitude ELSE NULL END`,
      );
    await this.db.$executeRawUnsafe(
      `UPDATE "Prospect" SET ${assignments.join(",")},"updatedAt"=NOW() WHERE id=$1 AND "companyId"=$2`,
      id,
      companyId,
      ...entries.map(([, value]) => value),
    );
  }

  /**
   * Records a visit. Optional `updates` carry the data confirmed in front of the
   * customer (CNPJ, contact, kg/month, stage…), saved together with the report.
   */
  @Post(":id/visits")
  async createVisit(@Param("id") id: string, @Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.actor(request);
    await this.findProspect(actor.companyId, id);
    const input = parseCustomerVisitInput(body);
    const transcript = String(body.factsTranscript ?? "").trim().slice(0, 8000) || null;
    const updates = parseProspectPatch(body.updates && typeof body.updates === "object" ? body.updates : {});
    if (!("stage" in updates)) updates.stage = input.outcome === "SEM_INTERESSE" ? "SEM_INTERESSE" : "VISITADO";
    updates.nextAction = input.nextAction;
    updates.nextActionAt = input.nextActionAt;
    const confirmed = Array.isArray(body.confirmedFields)
      ? body.confirmedFields.map(String).filter((field: string) => field.length <= 40).slice(0, 30)
      : [];
    const visitId = randomUUID();
    await this.db.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO "ProspectVisit"
          (id,"companyId","prospectId","recordedByUserId","recordedByName","visitAt","contactName",
           purpose,outcome,facts,"factsTranscript","nextAction","nextActionAt","confirmedFields","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,NOW())`,
        visitId,
        actor.companyId,
        id,
        actor.id ?? null,
        actor.name,
        input.visitAt,
        input.contactName,
        input.purpose,
        input.outcome,
        input.facts,
        transcript,
        input.nextAction,
        input.nextActionAt,
        JSON.stringify(confirmed),
      );
      await tx.$executeRawUnsafe(
        `UPDATE "Prospect" SET "lastContactAt"=GREATEST(COALESCE("lastContactAt",$3),$3),"updatedAt"=NOW()
          WHERE id=$1 AND "companyId"=$2`,
        id,
        actor.companyId,
        input.visitAt,
      );
    });
    await this.applyPatch(actor.companyId, id, updates);
    return { id: visitId, prospect: await this.findProspect(actor.companyId, id) };
  }

  /** Links the prospect to the customer created from it (stage becomes CLIENTE). */
  @Post(":id/convert")
  async convert(@Param("id") id: string, @Req() request: any, @Body() body: { customerId?: string; taxId?: string }) {
    const actor = await this.actor(request);
    await this.findProspect(actor.companyId, id);
    // Pelo id do cliente recém-criado ou, se o CNPJ já estava cadastrado, pelo CNPJ.
    const taxId = String(body.taxId ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    const customer = body.customerId
      ? await this.db.customer.findFirst({
          where: { id: String(body.customerId), companyId: actor.companyId },
          select: { id: true },
        })
      : taxId.length >= 11
        ? (
            (await this.db.$queryRawUnsafe(
              `SELECT id FROM "Customer" WHERE "companyId"=$1
                 AND upper(regexp_replace(COALESCE("taxId",''),'[^0-9A-Za-z]','','g'))=$2 LIMIT 1`,
              actor.companyId,
              taxId,
            )) as Array<{ id: string }>
          )[0] ?? null
        : null;
    if (!customer) throw new BadRequestException("Cliente não encontrado.");
    await this.db.$executeRawUnsafe(
      `UPDATE "Prospect" SET "customerId"=$3,stage='CLIENTE',"convertedAt"=COALESCE("convertedAt",NOW()),"updatedAt"=NOW()
        WHERE id=$1 AND "companyId"=$2`,
      id,
      actor.companyId,
      customer.id,
    );
    return { ...(await this.findProspect(actor.companyId, id)), customerId: customer.id };
  }

  /**
   * Imports a spreadsheet (.xlsx). With `confirm` absent it only previews.
   * Existing prospects (same name + city) are never overwritten.
   */
  @Post("import")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async import(
    @Req() request: any,
    @UploadedFile() file: { buffer?: Buffer; originalname?: string } | undefined,
    @Body() body: { confirm?: string; state?: string; sheet?: string },
  ) {
    const actor = await this.actor(request);
    if (!file?.buffer?.length) throw new BadRequestException("Envie a planilha (.xlsx).");
    let rows: string[][];
    try {
      rows = readXlsxRows(file.buffer, body.sheet || undefined);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Planilha inválida.");
    }
    const { prospects, skipped, duplicates } = mapProspectSheet(rows, { defaultState: body.state });
    const existingRows: Array<{ importKey: string; needsSuggestion: boolean }> = await this.db.$queryRawUnsafe(
      `SELECT "importKey",("taxId" IS NULL AND "suggestedTaxId" IS NULL) AS "needsSuggestion"
         FROM "Prospect" WHERE "companyId"=$1 AND "importKey"=ANY($2::text[])`,
      actor.companyId,
      prospects.map((p) => p.importKey),
    );
    const existing = new Map(existingRows.map((row) => [row.importKey, row.needsSuggestion]));
    const fresh = prospects.filter((p) => !existing.has(p.importKey));
    // Existing prospects are never overwritten; the only exception is filling
    // a suggested CNPJ where the prospect has no CNPJ and no suggestion yet.
    const suggestions = prospects.filter((p) => p.suggestedTaxId && existing.get(p.importKey) === true);
    const summary = {
      total: prospects.length,
      new: fresh.length,
      alreadyImported: prospects.length - fresh.length,
      suggestionsToFill: suggestions.length,
      duplicatesInFile: duplicates,
      skipped,
      preview: fresh.slice(0, 200),
    };
    if (body.confirm !== "true") return { ...summary, imported: 0, suggestionsFilled: 0 };
    let imported = 0;
    let suggestionsFilled = 0;
    await this.db.$transaction(async (tx: any) => {
      for (const prospect of fresh) imported += await this.insertImported(tx, actor, prospect);
      for (const p of suggestions)
        suggestionsFilled += await tx.$executeRawUnsafe(
          `UPDATE "Prospect" SET "suggestedTaxId"=$3,"suggestedTaxIdConfidence"=$4,"suggestedTaxIdReason"=$5,"updatedAt"=NOW()
            WHERE "companyId"=$1 AND "importKey"=$2 AND "taxId" IS NULL AND "suggestedTaxId" IS NULL`,
          actor.companyId,
          p.importKey,
          p.suggestedTaxId,
          p.suggestedTaxIdConfidence,
          p.suggestedTaxIdReason,
        );
    });
    return { ...summary, preview: [], imported, suggestionsFilled };
  }

  private insertImported(tx: any, actor: { companyId: string; id?: string }, p: ProspectImportRow) {
    return tx.$executeRawUnsafe(
      `INSERT INTO "Prospect"
        (id,"companyId","importKey",name,segment,city,state,district,address,"addressNumber",phone,
         "contactName",profile,"openingHours",potential,"espressoMachine","machineNotes","currentSupplier",
         "monthlyVolumeKg",stage,notes,"createdByUserId","suggestedTaxId","suggestedTaxIdConfidence",
         "suggestedTaxIdReason","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,NOW(),NOW())
       ON CONFLICT ("companyId","importKey") WHERE "importKey" IS NOT NULL DO NOTHING`,
      randomUUID(),
      actor.companyId,
      p.importKey,
      p.name,
      p.segment,
      p.city,
      p.state,
      p.district,
      p.address,
      p.addressNumber,
      p.phone,
      p.contactName,
      p.profile,
      p.openingHours,
      p.potential,
      p.espressoMachine,
      p.machineNotes,
      p.currentSupplier,
      p.monthlyVolumeKg,
      p.stage,
      p.notes,
      actor.id ?? null,
      p.suggestedTaxId,
      p.suggestedTaxIdConfidence,
      p.suggestedTaxIdReason,
    );
  }
}
