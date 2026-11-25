import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { prisma } from "@bbos/database";
import { AuthService } from "./auth.service";
import {
  CONTRACT_STATUS,
  ExportInputError,
  parseExportBuyer,
  parseExportContract,
  parseExportSample,
  parseSampleEvaluation,
  parseSampleStep,
  sampleAlert,
  stepEffects,
  trackingUrl,
  type SampleStatus,
} from "./export-input";

const weightLabel = (grams: number) =>
  grams >= 1000 ? `${(grams / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg` : `${grams} g`;

const EXPORT_ROLES = new Set(["ADMIN", "EXECUTIVE", "FINANCE", "INDUSTRIAL"]);

const BUYER_COLUMNS = `b.id,b.name,b.country,b.city,b."legalRepresentative",b."contactName",b.email,b.phone,b.messenger,b.language,b.currency,b.incoterm,
  b."taxId",b.address,b.status,b.notes,b."createdAt",b."updatedAt"`;
const SAMPLE_COLUMNS = `s.id,s."buyerId",b.name AS "buyerName",b.country AS "buyerCountry",b.city AS "buyerCity",
  b."contactName" AS "buyerContact",s.reference,s."proformaNumber",s."declaredValue"::float AS "declaredValue",
  s."declaredCurrency",s."shippedByName",s."coffeeType",s."lotReference",s."weightGrams",s."scaScore"::float AS "scaScore",
  s.carrier,s."trackingCode",s."shippingCost"::float AS "shippingCost",s.status,s."sentAt",s."deliveredAt",
  s."responseDueAt",s."responseDays",s.result,s."buyerScore"::float AS "buyerScore",s.feedback,s."contractId",
  c.code AS "contractCode",s.notes,s."createdAt",s."updatedAt",
  (SELECT MAX(e."occurredAt") FROM "ExportSampleEvent" e WHERE e."sampleId"=s.id) AS "lastEventAt"`;
const CONTRACT_COLUMNS = `c.id,c."buyerId",b.name AS "buyerName",b.country AS "buyerCountry",c.code,c.product,
  c."quantityKg"::float AS "quantityKg",c."unitPrice"::float AS "unitPrice",c."priceUnit",c.currency,c.incoterm,
  to_char(c."shipmentFrom",'YYYY-MM-DD') AS "shipmentFrom",to_char(c."shipmentTo",'YYYY-MM-DD') AS "shipmentTo",
  c.status,c.notes,c."createdAt",c."updatedAt"`;

/**
 * Export area (separate from the domestic market): foreign buyers, samples
 * sent abroad with a step-by-step tracking timeline, and export contracts.
 */
@Controller("exports")
export class ExportsController {
  private readonly db: any = prisma;

  constructor(private readonly auth: AuthService) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    if (!EXPORT_ROLES.has(String(actor.role))) throw new ForbiddenException("Exportações não liberadas para este perfil.");
    return actor;
  }

  private parse<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      if (error instanceof ExportInputError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  /** Two samples cannot share a shipment reference (e.g. BC-BR-0001). */
  private uniqueReference(error: any): never {
    const code = error?.code === "P2010" ? error?.meta?.code : error?.code;
    if (code === "23505") throw new BadRequestException("Já existe uma amostra com essa referência de envio.");
    throw error;
  }

  private decorate(sample: any) {
    return {
      ...sample,
      trackingUrl: trackingUrl(sample.carrier, sample.trackingCode),
      alert: sampleAlert({ status: sample.status, responseDueAt: sample.responseDueAt, lastEventAt: sample.lastEventAt }),
    };
  }

  private async buyer(companyId: string, id: string) {
    const rows = await this.db.$queryRawUnsafe(
      `SELECT ${BUYER_COLUMNS} FROM "ExportBuyer" b WHERE b.id=$1 AND b."companyId"=$2`, id, companyId);
    if (!rows[0]) throw new NotFoundException("Cliente externo não encontrado.");
    return rows[0];
  }

  private async sample(companyId: string, id: string) {
    const rows = await this.db.$queryRawUnsafe(
      `SELECT ${SAMPLE_COLUMNS} FROM "ExportSample" s JOIN "ExportBuyer" b ON b.id=s."buyerId"
         LEFT JOIN "ExportContract" c ON c.id=s."contractId"
        WHERE s.id=$1 AND s."companyId"=$2`, id, companyId);
    if (!rows[0]) throw new NotFoundException("Amostra não encontrada.");
    return rows[0];
  }

  private async addEvent(sampleId: string, status: string, note: string | null, at: Date, by: string | null) {
    await this.db.$executeRawUnsafe(
      `INSERT INTO "ExportSampleEvent" (id,"sampleId",status,note,"occurredAt","recordedByName") VALUES ($1,$2,$3,$4,$5,$6)`,
      randomUUID(), sampleId, status, note, at, by);
  }

  @Get("overview")
  async overview(@Req() request: any) {
    const actor = await this.actor(request);
    const samples = (await this.db.$queryRawUnsafe(
      `SELECT ${SAMPLE_COLUMNS} FROM "ExportSample" s JOIN "ExportBuyer" b ON b.id=s."buyerId"
         LEFT JOIN "ExportContract" c ON c.id=s."contractId"
        WHERE s."companyId"=$1 AND s."createdAt" > NOW() - interval '365 days'`, actor.companyId)).map((s: any) => this.decorate(s));
    const evaluated = samples.filter((s: any) => s.result === "APPROVED" || s.result === "REJECTED");
    const contracts = await this.db.$queryRawUnsafe(
      `SELECT status, COUNT(*)::int n FROM "ExportContract" WHERE "companyId"=$1 GROUP BY status`, actor.companyId);
    return {
      inTransit: samples.filter((s: any) => ["SENT", "IN_TRANSIT", "CUSTOMS"].includes(s.status)).length,
      awaitingAnswer: samples.filter((s: any) => s.status === "DELIVERED").length,
      approvalRate: evaluated.length ? evaluated.filter((s: any) => s.result === "APPROVED").length / evaluated.length : null,
      evaluated: evaluated.length,
      becameContract: samples.filter((s: any) => s.contractId).length,
      openContracts: contracts.filter((c: any) => ["NEGOTIATING", "SIGNED"].includes(c.status)).reduce((sum: number, c: any) => sum + c.n, 0),
      alerts: samples.filter((s: any) => s.alert).map((s: any) => ({ id: s.id, buyerName: s.buyerName, lotReference: s.lotReference, ...s.alert })),
    };
  }

  // ── Foreign buyers ──────────────────────────────────────────────
  @Get("buyers")
  async buyers(@Req() request: any) {
    const actor = await this.actor(request);
    return this.db.$queryRawUnsafe(
      `SELECT ${BUYER_COLUMNS},
              (SELECT COUNT(*)::int FROM "ExportSample" s WHERE s."buyerId"=b.id) AS "sampleCount",
              (SELECT COUNT(*)::int FROM "ExportContract" c WHERE c."buyerId"=b.id) AS "contractCount"
         FROM "ExportBuyer" b WHERE b."companyId"=$1 ORDER BY b.status, b.name LIMIT 1000`, actor.companyId);
  }

  @Post("buyers")
  async createBuyer(@Req() request: any, @Body() body: Record<string, unknown>) {
    const actor = await this.actor(request);
    const b = this.parse(() => parseExportBuyer(body ?? {}));
    const id = randomUUID();
    await this.db.$executeRawUnsafe(
      `INSERT INTO "ExportBuyer" (id,"companyId",name,country,city,"contactName",email,phone,language,currency,incoterm,"taxId",address,status,notes,"createdByUserId","legalRepresentative",messenger)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      id, actor.companyId, b.name, b.country, b.city, b.contactName, b.email, b.phone, b.language, b.currency,
      b.incoterm, b.taxId, b.address, b.status, b.notes, actor.id ?? null, b.legalRepresentative, b.messenger);
    return this.buyer(actor.companyId, id);
  }

  @Patch("buyers/:id")
  async updateBuyer(@Param("id") id: string, @Req() request: any, @Body() body: Record<string, unknown>) {
    const actor = await this.actor(request);
    const current = await this.buyer(actor.companyId, id);
    const b = this.parse(() => parseExportBuyer({ ...current, ...(body ?? {}) }));
    await this.db.$executeRawUnsafe(
      `UPDATE "ExportBuyer" SET name=$3,country=$4,city=$5,"contactName"=$6,email=$7,phone=$8,language=$9,currency=$10,
              incoterm=$11,"taxId"=$12,address=$13,status=$14,notes=$15,"legalRepresentative"=$16,messenger=$17,"updatedAt"=NOW()
        WHERE id=$1 AND "companyId"=$2`,
      id, actor.companyId, b.name, b.country, b.city, b.contactName, b.email, b.phone, b.language, b.currency,
      b.incoterm, b.taxId, b.address, b.status, b.notes, b.legalRepresentative, b.messenger);
    return this.buyer(actor.companyId, id);
  }

  // ── Samples ─────────────────────────────────────────────────────
  @Get("samples")
  async samples(@Req() request: any) {
    const actor = await this.actor(request);
    const rows = await this.db.$queryRawUnsafe(
      `SELECT ${SAMPLE_COLUMNS} FROM "ExportSample" s JOIN "ExportBuyer" b ON b.id=s."buyerId"
         LEFT JOIN "ExportContract" c ON c.id=s."contractId"
        WHERE s."companyId"=$1 ORDER BY s."createdAt" DESC LIMIT 500`, actor.companyId);
    return rows.map((row: any) => this.decorate(row));
  }

  @Get("samples/:id")
  async sampleDetail(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    const sample = this.decorate(await this.sample(actor.companyId, id));
    const events = await this.db.$queryRawUnsafe(
      `SELECT id,status,note,source,"occurredAt","recordedByName" FROM "ExportSampleEvent"
        WHERE "sampleId"=$1 ORDER BY "occurredAt" ASC, "createdAt" ASC`, id);
    return { ...sample, events };
  }

  @Post("samples")
  async createSample(@Req() request: any, @Body() body: Record<string, unknown>) {
    const actor = await this.actor(request);
    const s = this.parse(() => parseExportSample(body ?? {}));
    await this.buyer(actor.companyId, s.buyerId);
    const id = randomUUID();
    await this.db.$executeRawUnsafe(
      `INSERT INTO "ExportSample" (id,"companyId","buyerId","coffeeType","lotReference","weightGrams","scaScore",carrier,
              "trackingCode","shippingCost","responseDays",notes,"createdByUserId",reference,"proformaNumber","declaredValue",
              "declaredCurrency","shippedByName")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      id, actor.companyId, s.buyerId, s.coffeeType, s.lotReference, s.weightGrams, s.scaScore, s.carrier,
      s.trackingCode, s.shippingCost, s.responseDays, s.notes, actor.id ?? null, s.reference, s.proformaNumber,
      s.declaredValue, s.declaredCurrency, s.shippedByName).catch((error: any) => this.uniqueReference(error));
    await this.addEvent(id, "PREPARED", `${weightLabel(s.weightGrams)} · ${s.lotReference}`, new Date(), actor.name ?? null);
    return this.sampleDetail(id, request);
  }

  @Patch("samples/:id")
  async updateSample(@Param("id") id: string, @Req() request: any, @Body() body: Record<string, unknown>) {
    const actor = await this.actor(request);
    const current = await this.sample(actor.companyId, id);
    const s = this.parse(() => parseExportSample({ ...current, ...(body ?? {}) }));
    await this.db.$executeRawUnsafe(
      `UPDATE "ExportSample" SET "lotReference"=$3,"weightGrams"=$4,"scaScore"=$5,carrier=$6,"trackingCode"=$7,
              "shippingCost"=$8,"responseDays"=$9,notes=$10,"coffeeType"=$11,reference=$12,"proformaNumber"=$13,
              "declaredValue"=$14,"declaredCurrency"=$15,"shippedByName"=$16,"updatedAt"=NOW()
        WHERE id=$1 AND "companyId"=$2`,
      id, actor.companyId, s.lotReference, s.weightGrams, s.scaScore, s.carrier, s.trackingCode,
      s.shippingCost, s.responseDays, s.notes, s.coffeeType, s.reference, s.proformaNumber, s.declaredValue,
      s.declaredCurrency, s.shippedByName).catch((error: any) => this.uniqueReference(error));
    return this.sampleDetail(id, request);
  }

  /** A new step of the journey: sent, in transit, customs, delivered… */
  @Post("samples/:id/steps")
  async addStep(@Param("id") id: string, @Req() request: any, @Body() body: Record<string, unknown>) {
    const actor = await this.actor(request);
    const current = await this.sample(actor.companyId, id);
    if (current.status === "EVALUATED") throw new BadRequestException("Esta amostra já foi avaliada.");
    const step = this.parse(() => parseSampleStep(body ?? {}));
    const effects = stepEffects(step.status as SampleStatus, step.occurredAt, current.responseDays ?? 7);
    const sets = Object.keys(effects).map((field, index) => `"${field}"=$${index + 4}`);
    await this.db.$executeRawUnsafe(
      `UPDATE "ExportSample" SET status=$3${sets.length ? "," + sets.join(",") : ""},"updatedAt"=NOW() WHERE id=$1 AND "companyId"=$2`,
      id, actor.companyId, step.status, ...Object.values(effects));
    await this.addEvent(id, step.status, step.note, step.occurredAt, actor.name ?? null);
    return this.sampleDetail(id, request);
  }

  @Post("samples/:id/evaluation")
  async evaluate(@Param("id") id: string, @Req() request: any, @Body() body: Record<string, unknown>) {
    const actor = await this.actor(request);
    await this.sample(actor.companyId, id);
    const e = this.parse(() => parseSampleEvaluation(body ?? {}));
    await this.db.$executeRawUnsafe(
      `UPDATE "ExportSample" SET status='EVALUATED',result=$3,"buyerScore"=$4,feedback=$5,"updatedAt"=NOW() WHERE id=$1 AND "companyId"=$2`,
      id, actor.companyId, e.result, e.buyerScore, e.feedback);
    const label = { APPROVED: "Aprovada", REJECTED: "Recusada", NEEDS_ANOTHER: "Pediu outra amostra" }[e.result];
    await this.addEvent(id, "EVALUATED", [label, e.buyerScore !== null ? `nota ${e.buyerScore}` : null, e.feedback].filter(Boolean).join(" · "), new Date(), actor.name ?? null);
    return this.sampleDetail(id, request);
  }

  // ── Contracts ───────────────────────────────────────────────────
  @Get("contracts")
  async contracts(@Req() request: any) {
    const actor = await this.actor(request);
    return this.db.$queryRawUnsafe(
      `SELECT ${CONTRACT_COLUMNS} FROM "ExportContract" c JOIN "ExportBuyer" b ON b.id=c."buyerId"
        WHERE c."companyId"=$1 ORDER BY c."createdAt" DESC LIMIT 500`, actor.companyId);
  }

  @Post("contracts")
  async createContract(@Req() request: any, @Body() body: Record<string, unknown>) {
    const actor = await this.actor(request);
    const c = this.parse(() => parseExportContract(body ?? {}));
    await this.buyer(actor.companyId, c.buyerId);
    const year = new Date().getFullYear();
    const [{ n }] = await this.db.$queryRawUnsafe(
      `SELECT COUNT(*)::int + 1 AS n FROM "ExportContract" WHERE "companyId"=$1 AND code LIKE $2`, actor.companyId, `CT-${year}-%`);
    const code = `CT-${year}-${String(n).padStart(3, "0")}`;
    const id = randomUUID();
    await this.db.$executeRawUnsafe(
      `INSERT INTO "ExportContract" (id,"companyId","buyerId",code,product,"quantityKg","unitPrice","priceUnit",currency,incoterm,
              "shipmentFrom","shipmentTo",status,notes,"createdByUserId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12::date,$13,$14,$15)`,
      id, actor.companyId, c.buyerId, code, c.product, c.quantityKg, c.unitPrice, c.priceUnit, c.currency, c.incoterm,
      c.shipmentFrom, c.shipmentTo, c.status, c.notes, actor.id ?? null);
    if (c.sampleId)
      await this.db.$executeRawUnsafe(
        `UPDATE "ExportSample" SET "contractId"=$3,"updatedAt"=NOW() WHERE id=$1 AND "companyId"=$2 AND "buyerId"=$4`,
        c.sampleId, actor.companyId, id, c.buyerId);
    const rows = await this.db.$queryRawUnsafe(
      `SELECT ${CONTRACT_COLUMNS} FROM "ExportContract" c JOIN "ExportBuyer" b ON b.id=c."buyerId" WHERE c.id=$1`, id);
    return rows[0];
  }

  @Patch("contracts/:id")
  async updateContract(@Param("id") id: string, @Req() request: any, @Body() body: { status?: string; notes?: string }) {
    const actor = await this.actor(request);
    const status = String(body?.status ?? "").toUpperCase();
    if (!(CONTRACT_STATUS as readonly string[]).includes(status)) throw new BadRequestException("Situação do contrato inválida.");
    const updated = await this.db.$executeRawUnsafe(
      `UPDATE "ExportContract" SET status=$3,notes=COALESCE($4,notes),"updatedAt"=NOW() WHERE id=$1 AND "companyId"=$2`,
      id, actor.companyId, status, typeof body?.notes === "string" ? body.notes.slice(0, 2000) : null);
    if (!updated) throw new NotFoundException("Contrato não encontrado.");
    const rows = await this.db.$queryRawUnsafe(
      `SELECT ${CONTRACT_COLUMNS} FROM "ExportContract" c JOIN "ExportBuyer" b ON b.id=c."buyerId" WHERE c.id=$1`, id);
    return rows[0];
  }
}
