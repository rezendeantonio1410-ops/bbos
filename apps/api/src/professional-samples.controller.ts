import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { Prisma, PrismaClient, ProfessionalSampleSource, ProfessionalSampleStatus } from "@bbos/database";
import { AuthService } from "./auth.service";
import { requireSession } from "./auth-context";
import { CUPPING_ATTRIBUTES, scoreCuppingAttributes } from "./cupping-score";

type SampleBody = {
  source?: ProfessionalSampleSource;
  supplierId?: string;
  originUnitId?: string;
  contactName?: string;
  country?: string;
  state?: string;
  municipality?: string;
  region?: string;
  harvest?: string;
  species?: string;
  cultivar?: string;
  process?: string;
  screen?: string;
  informedDefects?: number;
  informedMoisture?: number;
  supplierLotCode?: string;
  receivedAt?: string;
  notes?: string;
  receiptId?: string;
  sourceSampleId?: string;
};

@Controller("professional-samples")
export class ProfessionalSamplesController {
  private readonly db = new PrismaClient();
  constructor(private readonly auth: AuthService) {}

  @Get("options")
  async options(@Req() request: Request) {
    const actor = await requireSession(request, this.auth);
    return this.db.supplier.findMany({ where: { companyId: actor.companyId, active: true }, select: { id: true, name: true, originUnits: { where: { active: true }, select: { id: true, name: true, state: true, municipality: true, coffeeRegion: { select: { name: true } } } } }, orderBy: { name: "asc" } });
  }

  @Get()
  async list(@Req() request: Request, @Query("source") source?: ProfessionalSampleSource, @Query("status") status?: ProfessionalSampleStatus) {
    const actor = await requireSession(request, this.auth);
    return this.db.professionalCoffeeSample.findMany({
      where: { companyId: actor.companyId, source, status },
      include: { supplier: { select: { id: true, name: true } }, originUnit: true, evaluations: true, purchase: { select: { id: true, purchaseNumber: true } }, receipt: { select: { id: true, receiptNumber: true, coffeeLotId: true } }, sourceSample: { select: { id: true, code: true, status: true } } },
      orderBy: { updatedAt: "desc" },
    });
  }

  @Get("approved-for-purchase")
  async approved(@Req() request: Request, @Query("supplierId") supplierId?: string) {
    const actor = await requireSession(request, this.auth);
    return this.db.professionalCoffeeSample.findMany({ where: { companyId: actor.companyId, source: ProfessionalSampleSource.OFFER, status: ProfessionalSampleStatus.APPROVED_FOR_PURCHASE, supplierId }, include: { supplier: { select: { id: true, name: true } }, originUnit: true, evaluations: true }, orderBy: { approvedAt: "desc" } });
  }

  @Get(":id")
  async get(@Param("id") id: string, @Req() request: Request) {
    const actor = await requireSession(request, this.auth);
    const sample = await this.db.professionalCoffeeSample.findFirst({ where: { id, companyId: actor.companyId }, include: { supplier: true, originUnit: { include: { coffeeRegion: true } }, evaluations: true } });
    if (!sample) throw new BadRequestException("Amostra não encontrada.");
    return sample;
  }

  @Post()
  async create(@Body() body: SampleBody, @Req() request: Request) {
    const actor = await requireSession(request, this.auth);
    const source = body.source ?? ProfessionalSampleSource.OFFER;
    if (!Object.values(ProfessionalSampleSource).includes(source)) throw new BadRequestException("Escolha a origem da amostra.");
    if (source === ProfessionalSampleSource.RECEIPT && !body.receiptId) throw new BadRequestException("Vincule o recebimento da amostra.");
    if (body.supplierId && !(await this.db.supplier.findFirst({ where: { id: body.supplierId, companyId: actor.companyId, active: true } }))) throw new BadRequestException("Fornecedor inválido.");
    if (body.originUnitId && !(await this.db.supplierOriginUnit.findFirst({ where: { id: body.originUnitId, supplier: { companyId: actor.companyId }, active: true } }))) throw new BadRequestException("Unidade/fazenda inválida.");
    if (body.receiptId && !(await this.db.greenCoffeeReceipt.findFirst({ where: { id: body.receiptId, companyId: actor.companyId } }))) throw new BadRequestException("Recebimento inválido.");
    const year = new Date().getFullYear();
    const sequence = (await this.db.professionalCoffeeSample.count({ where: { companyId: actor.companyId, createdAt: { gte: new Date(`${year}-01-01`) } } })) + 1;
    const code = `AM-${year}-${String(sequence).padStart(6, "0")}`;
    return this.db.professionalCoffeeSample.create({ data: { companyId: actor.companyId, source, code, status: ProfessionalSampleStatus.RECEIVED, supplierId: body.supplierId, originUnitId: body.originUnitId, contactName: body.contactName?.trim() || undefined, country: body.country?.trim() || undefined, state: body.state?.trim() || undefined, municipality: body.municipality?.trim() || undefined, region: body.region?.trim() || undefined, harvest: body.harvest?.trim() || undefined, species: body.species?.trim() || undefined, cultivar: body.cultivar?.trim() || undefined, process: body.process?.trim() || undefined, screen: body.screen?.trim() || undefined, informedDefects: body.informedDefects, informedMoisture: body.informedMoisture, supplierLotCode: body.supplierLotCode?.trim() || undefined, receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(), notes: body.notes?.trim() || undefined, receiptId: body.receiptId, sourceSampleId: body.sourceSampleId, createdById: actor.id, createdByName: actor.name } });
  }

  @Patch(":id/evaluation")
  async evaluate(@Param("id") id: string, @Body() body: { attributes: Record<string, unknown>; descriptors?: unknown; sensoryMap?: unknown; defects?: number; moisture?: number; screen?: string; notes?: string; complete?: boolean }, @Req() request: Request) {
    const actor = await requireSession(request, this.auth);
    const sample = await this.db.professionalCoffeeSample.findFirst({ where: { id, companyId: actor.companyId } });
    if (!sample) throw new BadRequestException("Amostra não encontrada.");
    const values = Object.entries(body.attributes ?? {}).filter(([key]) => CUPPING_ATTRIBUTES.includes(key as (typeof CUPPING_ATTRIBUTES)[number]));
    if (values.some(([, value]) => value !== null && value !== undefined && value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 10))) throw new BadRequestException("Cada atributo deve estar entre 0 e 10.");
    const attributes = body.attributes as Prisma.InputJsonValue;
    const evaluation = await this.db.professionalSampleEvaluation.upsert({ where: { sampleId_evaluatorId: { sampleId: id, evaluatorId: actor.id } }, create: { sampleId: id, evaluatorId: actor.id, evaluatorName: actor.name, attributes, descriptors: body.descriptors as Prisma.InputJsonValue | undefined, sensoryMap: body.sensoryMap as Prisma.InputJsonValue | undefined, defects: body.defects, moisture: body.moisture, screen: body.screen?.trim() || undefined, notes: body.notes?.trim() || undefined, score: scoreCuppingAttributes(body.attributes), completedAt: body.complete ? new Date() : undefined }, update: { attributes, descriptors: body.descriptors as Prisma.InputJsonValue | undefined, sensoryMap: body.sensoryMap as Prisma.InputJsonValue | undefined, defects: body.defects, moisture: body.moisture, screen: body.screen?.trim() || undefined, notes: body.notes?.trim() || undefined, score: scoreCuppingAttributes(body.attributes), completedAt: body.complete ? new Date() : null } });
    if (body.complete && sample.status === ProfessionalSampleStatus.RECEIVED) await this.db.professionalCoffeeSample.update({ where: { id }, data: { status: ProfessionalSampleStatus.EVALUATED } });
    return evaluation;
  }

  @Post(":id/approve-for-purchase")
  async approveForPurchase(@Param("id") id: string, @Req() request: Request) {
    const actor = await requireSession(request, this.auth);
    const sample = await this.db.professionalCoffeeSample.findFirst({ where: { id, companyId: actor.companyId, source: ProfessionalSampleSource.OFFER }, include: { evaluations: true } });
    if (!sample) throw new BadRequestException("Amostra de oferta não encontrada.");
    if (!sample.evaluations.some((evaluation) => evaluation.completedAt)) throw new BadRequestException("Conclua o cupping profissional antes de aprovar a amostra para compra.");
    return this.db.professionalCoffeeSample.update({ where: { id }, data: { status: ProfessionalSampleStatus.APPROVED_FOR_PURCHASE, approvedById: actor.id, approvedByName: actor.name, approvedAt: new Date() } });
  }

  @Post(":id/receiving")
  async createReceiving(@Param("id") id: string, @Body() body: { receiptId: string }, @Req() request: Request) {
    const actor = await requireSession(request, this.auth);
    const source = await this.db.professionalCoffeeSample.findFirst({ where: { id, companyId: actor.companyId, source: ProfessionalSampleSource.OFFER, status: ProfessionalSampleStatus.APPROVED_FOR_PURCHASE } });
    const receipt = await this.db.greenCoffeeReceipt.findFirst({ where: { id: body.receiptId, companyId: actor.companyId }, include: { supplier: true } });
    if (!source || !receipt) throw new BadRequestException("Amostra aprovada e recebimento são obrigatórios.");
    const existing = await this.db.professionalCoffeeSample.findFirst({ where: { receiptId: receipt.id } });
    if (existing) return existing;
    const year = new Date().getFullYear();
    const sequence = (await this.db.professionalCoffeeSample.count({ where: { companyId: actor.companyId, createdAt: { gte: new Date(`${year}-01-01`) } } })) + 1;
    return this.db.professionalCoffeeSample.create({ data: { companyId: actor.companyId, source: ProfessionalSampleSource.RECEIPT, code: `AM-${year}-${String(sequence).padStart(6, "0")}`, status: ProfessionalSampleStatus.RECEIVED, supplierId: receipt.supplierId, contactName: source.contactName, country: receipt.country, state: receipt.state, municipality: receipt.municipality, region: receipt.origin, harvest: receipt.harvest, species: receipt.species, cultivar: receipt.variety, process: receipt.process, screen: receipt.screen, informedDefects: receipt.defects, informedMoisture: receipt.moisturePercent, supplierLotCode: receipt.supplierLotCode, receivedAt: receipt.confirmedAt, notes: receipt.notes, purchaseId: receipt.purchaseId ?? undefined, receiptId: receipt.id, sourceSampleId: source.id, createdById: actor.id, createdByName: actor.name } });
  }

  @Get(":id/comparison")
  async comparison(@Param("id") id: string, @Req() request: Request) {
    const actor = await requireSession(request, this.auth);
    const sample = await this.db.professionalCoffeeSample.findFirst({ where: { id, companyId: actor.companyId }, include: { evaluations: true, derivedSamples: { include: { evaluations: true } } } });
    if (!sample) throw new BadRequestException("Amostra não encontrada.");
    const received = sample.derivedSamples[0];
    return { offer: sample, receiving: received ?? null };
  }
}
