import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { CoffeeLotStatus, CuppingDecision, CuppingSessionStatus, Prisma, PrismaClient } from "@bbos/database";
import { AuthService } from "./auth.service";
import { requireSession } from "./auth-context";
import { CUPPING_ATTRIBUTES, scoreCuppingAttributes } from "./cupping-score";

@Controller("cupping")
export class CuppingController {
  private readonly database = new PrismaClient();
  constructor(private readonly auth: AuthService) {}

  @Get("sessions")
  async list(@Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    return this.database.cuppingSession.findMany({
      where: { companyId: actor.companyId },
      include: { evaluations: true, sample: { include: { receipt: { include: { supplier: true, coffeeLot: true, purchase: true } } } } },
      orderBy: { updatedAt: "desc" },
    });
  }

  @Post("sessions")
  async create(@Body() body: { sampleId: string; protocol?: string; generalNotes?: string; participantIds?: string[] }, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const sample = await this.database.greenCoffeeLabSample.findFirst({ where: { id: body.sampleId, receipt: { companyId: actor.companyId } } });
    if (!sample) throw new BadRequestException("Selecione uma amostra válida.");
    const sequence = await this.database.cuppingSession.count({ where: { companyId: actor.companyId } });
    const code = `CUP-${new Date().getFullYear()}-${String(sequence + 1).padStart(6, "0")}`;
    return this.database.cuppingSession.create({ data: { companyId: actor.companyId, sampleId: sample.id, code, protocol: body.protocol?.trim() || "SCA", generalNotes: body.generalNotes?.trim() || undefined, participantIds: body.participantIds ?? [], responsibleId: actor.id, responsibleName: actor.name } });
  }

  @Patch("sessions/:id/evaluation")
  async saveEvaluation(@Param("id") id: string, @Body() body: { attributes: Record<string, unknown>; defects?: unknown; sensoryNotes?: unknown; complete?: boolean }, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const values = Object.entries(body.attributes ?? {}).filter(([key]) => CUPPING_ATTRIBUTES.includes(key as (typeof CUPPING_ATTRIBUTES)[number]));
    if (values.some(([, value]) => value !== null && value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 10))) throw new BadRequestException("Cada atributo deve estar entre 0 e 10.");
    const session = await this.database.cuppingSession.findFirst({ where: { id, companyId: actor.companyId } });
    if (!session) throw new BadRequestException("Sessão não encontrada.");
    const attributes = body.attributes as Prisma.InputJsonValue;
    const defects = body.defects as Prisma.InputJsonValue | undefined;
    const sensoryNotes = body.sensoryNotes as Prisma.InputJsonValue | undefined;
    return this.database.cuppingEvaluation.upsert({ where: { sessionId_evaluatorId: { sessionId: id, evaluatorId: actor.id } }, create: { sessionId: id, evaluatorId: actor.id, evaluatorName: actor.name, attributes, defects, sensoryNotes, score: scoreCuppingAttributes(body.attributes), completedAt: body.complete ? new Date() : undefined }, update: { attributes, defects, sensoryNotes, score: scoreCuppingAttributes(body.attributes), completedAt: body.complete ? new Date() : null } });
  }

  @Post("sessions/:id/decision")
  async decide(@Param("id") id: string, @Body() body: { decision: CuppingDecision; reason?: string }, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    if (!Object.values(CuppingDecision).includes(body.decision)) throw new BadRequestException("Escolha uma decisão válida.");
    if (body.decision === CuppingDecision.REASSESSMENT && !body.reason?.trim()) throw new BadRequestException("Informe o motivo da reavaliação.");
    const session = await this.database.cuppingSession.findFirst({ where: { id, companyId: actor.companyId }, include: { evaluations: true, sample: { include: { receipt: true } } } });
    if (!session) throw new BadRequestException("Sessão não encontrada.");
    if (!session.evaluations.length) throw new BadRequestException("Registre ao menos uma ficha completa antes de decidir.");
    const status = body.decision === CuppingDecision.REASSESSMENT ? CuppingSessionStatus.REASSESSMENT : CuppingSessionStatus.CLOSED;
    const qualityStatus = body.decision === CuppingDecision.APPROVED ? "APPROVED" : body.decision === CuppingDecision.REJECTED ? "REJECTED" : "AWAITING_ANALYSIS";
    return this.database.$transaction(async (transaction) => {
      const updated = await transaction.cuppingSession.update({ where: { id }, data: { status, decision: body.decision, decisionReason: body.reason?.trim() || undefined, decidedById: actor.id, decidedByName: actor.name, decidedAt: new Date() } });
      if (body.decision !== CuppingDecision.REASSESSMENT) {
        await transaction.greenCoffeeReceipt.update({ where: { id: session.sample.receiptId }, data: { qualityStatus: qualityStatus as never, qualityNotes: body.reason?.trim() || undefined } });
        await transaction.coffeeLot.update({ where: { id: session.sample.receipt.coffeeLotId }, data: { status: body.decision === CuppingDecision.APPROVED ? CoffeeLotStatus.APPROVED : CoffeeLotStatus.BLOCKED } });
      }
      return updated;
    });
  }
}
