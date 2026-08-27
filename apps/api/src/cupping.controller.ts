import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { CoffeeLotStatus, CuppingDecision, CuppingSessionStatus, Prisma, PrismaClient } from "@bbos/database";
import { createHash, randomBytes } from "node:crypto";
import * as QRCode from "qrcode";
import { AuthService } from "./auth.service";
import { requireSession } from "./auth-context";
import { CUPPING_ATTRIBUTES, scoreCuppingAttributes } from "./cupping-score";

const hashParticipantInvite = (token: string) => createHash("sha256").update(token).digest("hex");

@Controller("cupping")
export class CuppingController {
  private readonly database = new PrismaClient();
  constructor(private readonly auth: AuthService) {}

  /** Issue a participant-scoped invite for the authenticated V1 flow. */
  @Post("sessions/:id/participants/:participantId/invite")
  async createParticipantInvite(@Param("id") id: string, @Param("participantId") participantId: string, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const session = await this.database.cuppingSession.findFirst({ where: { id, companyId: actor.companyId }, include: { samples: { orderBy: { position: "asc" } }, evaluations: true } });
    if (!session) throw new BadRequestException("Sessão não encontrada.");
    const participantIds = Array.isArray(session.participantIds) ? session.participantIds.filter((value): value is string => typeof value === "string") : [];
    const knownParticipant = participantIds.includes(participantId) || session.evaluations.some((evaluation) => evaluation.evaluatorId === participantId);
    if (!knownParticipant) throw new BadRequestException("Participante não pertence a esta sessão.");
    const rawToken = randomBytes(32).toString("base64url");
    const invite = await this.database.cuppingParticipantInvite.upsert({
      where: { sessionId_participantId: { sessionId: id, participantId } },
      create: { companyId: actor.companyId, sessionId: id, participantId, tokenHash: hashParticipantInvite(rawToken) },
      update: { tokenHash: hashParticipantInvite(rawToken), status: "ACTIVE", revokedAt: null, lastUsedAt: null },
    });
    const baseUrl = process.env.WEB_URL || `${req.protocol}://${req.get("host")}`;
    const url = `${baseUrl.replace(/\/$/, "")}/cupping/mobile/invite/${rawToken}`;
    return { id: invite.id, sessionId: id, participantId, url, qrCodeDataUrl: await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 320 }) };
  }

  @Post("sessions/:id/participants/:participantId/invite/revoke")
  async revokeParticipantInvite(@Param("id") id: string, @Param("participantId") participantId: string, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const invite = await this.database.cuppingParticipantInvite.findFirst({ where: { sessionId: id, participantId, companyId: actor.companyId } });
    if (!invite) throw new BadRequestException("Convite não encontrado.");
    return this.database.cuppingParticipantInvite.update({ where: { id: invite.id }, data: { status: "REVOKED", revokedAt: new Date() }, select: { id: true, status: true, revokedAt: true } });
  }

  @Get("sessions")
  async list(@Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    return this.database.cuppingSession.findMany({
      where: { companyId: actor.companyId },
      include: { evaluations: true, sample: { include: { receipt: { include: { supplier: true, coffeeLot: true, purchase: true } } } } },
      orderBy: { updatedAt: "desc" },
    });
  }

  @Get("participants")
  async participants(@Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    return this.database.user.findMany({ where: { companyId: actor.companyId, active: true }, select: { id: true, name: true, role: true, avatarUrl: true }, orderBy: { name: "asc" } });
  }

  @Post("sessions")
  async create(@Body() body: { sampleId: string; sampleIds?: string[]; protocol?: string; generalNotes?: string; participantIds?: string[] }, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const sample = await this.database.greenCoffeeLabSample.findFirst({ where: { id: body.sampleId, receipt: { companyId: actor.companyId } } });
    if (!sample) throw new BadRequestException("Selecione uma amostra válida.");
    const sequence = await this.database.cuppingSession.count({ where: { companyId: actor.companyId } });
    const code = `CUP-${new Date().getFullYear()}-${String(sequence + 1).padStart(6, "0")}`;
    const session = await this.database.cuppingSession.create({ data: { companyId: actor.companyId, sampleId: sample.id, code, protocol: body.protocol?.trim() || "SCA", protocolVersion: "v1", generalNotes: body.generalNotes?.trim() || undefined, participantIds: body.participantIds ?? [], responsibleId: actor.id, responsibleName: actor.name } });
    await this.database.cuppingSessionSample.create({ data: { sessionId: session.id, sourceType: "GREEN_COFFEE_LAB_SAMPLE", sourceId: sample.id, sampleId: sample.id, position: 1 } });
    for (const [index, sampleId] of [...new Set((body.sampleIds ?? []).filter((id) => id && id !== sample.id))].entries()) {
      const extra = await this.database.greenCoffeeLabSample.findFirst({ where: { id: sampleId, receipt: { companyId: actor.companyId } } });
      if (extra) await this.database.cuppingSessionSample.create({ data: { sessionId: session.id, sourceType: "GREEN_COFFEE_LAB_SAMPLE", sourceId: extra.id, sampleId: extra.id, position: index + 2 } });
    }
    return session;
  }

  /**
   * Compatibility adapter for the laboratory UI. The current domain model
   * intentionally keeps one primary sample per CuppingSession; these
   * endpoints expose it as a collection so callers can migrate to a
   * multi-sample session without creating a second cupping engine.
  */
  @Get("sessions/:id/samples")
  async listSessionSamples(@Param("id") id: string, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const session = await this.database.cuppingSession.findFirst({
      where: { id, companyId: actor.companyId },
      include: { sample: { include: { receipt: { include: { supplier: true, coffeeLot: true } } } }, samples: { include: { sample: { include: { receipt: { include: { supplier: true, coffeeLot: true } } } }, professionalSample: { include: { supplier: true, originUnit: true } } } } },
    });
    if (!session) throw new BadRequestException("Sessão não encontrada.");
    return session.samples.length ? session.samples.sort((a, b) => a.position - b.position).map((entry) => ({ ...(entry.sample ?? entry.professionalSample), sourceType: entry.sourceType, sourceId: entry.sourceId, professionalSampleId: entry.professionalSampleId, position: entry.position, blindCode: entry.blindCode })) : [session.sample];
  }

  @Post("sessions/:id/samples")
  async addSessionSample(@Param("id") id: string, @Body() body: { sampleId?: string; sourceType?: string; sourceId?: string; position?: number; blindCode?: string }, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const sourceType = body.sourceType ?? "GREEN_COFFEE_LAB_SAMPLE";
    const sourceId = body.sourceId ?? body.sampleId;
    if (!sourceId || !["GREEN_COFFEE_LAB_SAMPLE", "PROFESSIONAL_COFFEE_SAMPLE"].includes(sourceType)) throw new BadRequestException("Informe uma amostra válida.");
    const session = await this.database.cuppingSession.findFirst({ where: { id, companyId: actor.companyId }, include: { sample: true } });
    if (!session) throw new BadRequestException("Sessão não encontrada.");
    const sample = sourceType === "GREEN_COFFEE_LAB_SAMPLE" ? await this.database.greenCoffeeLabSample.findFirst({ where: { id: sourceId, receipt: { companyId: actor.companyId } }, include: { receipt: { include: { supplier: true, coffeeLot: true } } } }) : null;
    const professional = sourceType === "PROFESSIONAL_COFFEE_SAMPLE" ? await this.database.professionalCoffeeSample.findFirst({ where: { id: sourceId, companyId: actor.companyId }, include: { supplier: true, originUnit: true } }) : null;
    if (!sample && !professional) throw new BadRequestException("Amostra não encontrada.");
    await this.database.cuppingSessionSample.upsert({
      where: { sessionId_sourceType_sourceId: { sessionId: id, sourceType, sourceId } },
      create: { sessionId: id, sourceType, sourceId, sampleId: sample?.id, professionalSampleId: professional?.id, position: body.position ?? 1, blindCode: body.blindCode?.trim() || undefined },
      update: { position: body.position ?? 1, blindCode: body.blindCode?.trim() || undefined },
    });
    return sample ?? professional;
  }

  /** Resolve a sample in the session while enforcing company and ownership. */
  @Get("sessions/:id/samples/:sampleId")
  async resolveSessionSample(@Param("id") id: string, @Param("sampleId") sampleId: string, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const session = await this.database.cuppingSession.findFirst({
      where: { id, companyId: actor.companyId, OR: [{ sampleId }, { samples: { some: { sourceId: sampleId } } }] },
      include: { sample: { include: { receipt: { include: { supplier: true, coffeeLot: true } } } }, samples: { where: { sourceId: sampleId }, include: { sample: { include: { receipt: { include: { supplier: true, coffeeLot: true } } } }, professionalSample: { include: { supplier: true, originUnit: true } } } } },
    });
    if (!session) throw new BadRequestException("Amostra não pertence a esta sessão.");
    return session.samples[0]?.professionalSample ?? session.samples[0]?.sample ?? session.sample;
  }

  @Get("sessions/:id/progress")
  async progress(@Param("id") id: string, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const session = await this.database.cuppingSession.findFirst({ where: { id, companyId: actor.companyId }, include: { samples: { orderBy: { position: "asc" } }, evaluations: true } });
    if (!session) throw new BadRequestException("Sessão não encontrada.");
    const participantIds = Array.isArray(session.participantIds) ? session.participantIds.filter((value): value is string => typeof value === "string") : [...new Set(session.evaluations.map((item) => item.evaluatorId))];
    const matrix = participantIds.flatMap((participantId) => session.samples.map((sample) => {
      const evaluation = session.evaluations.find((item) => item.evaluatorId === participantId && item.sessionSampleId === sample.id);
      return { participantId, sessionSampleId: sample.id, state: evaluation?.completedAt ? "COMPLETED" : evaluation ? "IN_PROGRESS" : "NOT_STARTED" };
    }));
    const completed = matrix.filter((item) => item.state === "COMPLETED").length;
    return { sessionId: id, total: matrix.length, completed, inProgress: matrix.filter((item) => item.state === "IN_PROGRESS").length, notStarted: matrix.filter((item) => item.state === "NOT_STARTED").length, percent: matrix.length ? Math.round(completed / matrix.length * 100) : 0, matrix };
  }

  @Get("sessions/:id/results")
  async results(@Param("id") id: string, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const session = await this.database.cuppingSession.findFirst({ where: { id, companyId: actor.companyId }, include: { samples: { orderBy: { position: "asc" }, include: { sample: { include: { receipt: { include: { coffeeLot: true } } } }, professionalSample: true } }, evaluations: { orderBy: { updatedAt: "desc" } } } });
    if (!session) throw new BadRequestException("Sessão não encontrada.");
    return { session: { id: session.id, code: session.code, protocol: session.protocol, sessionDate: session.sessionDate, status: session.status }, samples: session.samples.map((sample) => { const evaluations = session.evaluations.filter((item) => item.sessionSampleId === sample.id); return { id: sample.id, position: sample.position, code: sample.blindCode || sample.sample?.sampleNumber || sample.professionalSample?.code || `Amostra ${sample.position}`, lotCode: sample.sample?.receipt?.coffeeLot?.code || null, evaluations, completed: evaluations.filter((item) => item.completedAt).length, average: evaluations.filter((item) => item.completedAt && item.score != null).length ? Number((evaluations.filter((item) => item.completedAt && item.score != null).reduce((sum, item) => sum + Number(item.score), 0) / evaluations.filter((item) => item.completedAt && item.score != null).length).toFixed(2)) : null }; }) };
  }

  @Get("history")
  async history(@Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    return this.database.cuppingEvaluation.findMany({ where: { session: { companyId: actor.companyId }, completedAt: { not: null } }, orderBy: { completedAt: "desc" }, include: { session: { select: { id: true, code: true, protocol: true, sessionDate: true } }, sessionSample: { include: { sample: { include: { receipt: { include: { coffeeLot: true } } } }, professionalSample: { select: { code: true } } } } } });
  }

  @Get("sessions/:id/next-sample")
  async nextSample(@Param("id") id: string, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const session = await this.database.cuppingSession.findFirst({ where: { id, companyId: actor.companyId }, include: { samples: { orderBy: { position: "asc" } }, evaluations: true } });
    if (!session) throw new BadRequestException("Sessão não encontrada.");
    const next = session.samples.find((sample) => !session.evaluations.some((item) => item.evaluatorId === actor.id && item.sessionSampleId === sample.id && item.completedAt));
    return next ? { sessionSampleId: next.id, sourceType: next.sourceType, sourceId: next.sourceId, blindCode: next.blindCode, position: next.position } : { completed: true };
  }

  @Patch("sessions/:id/evaluation")
  async saveEvaluation(@Param("id") id: string, @Body() body: { attributes: Record<string, unknown>; defects?: unknown; sensoryNotes?: unknown; complete?: boolean; sessionSampleId?: string }, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const values = Object.entries(body.attributes ?? {}).filter(([key]) => CUPPING_ATTRIBUTES.includes(key as (typeof CUPPING_ATTRIBUTES)[number]));
    if (values.some(([, value]) => value !== null && value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 10))) throw new BadRequestException("Cada atributo deve estar entre 0 e 10.");
    const session = await this.database.cuppingSession.findFirst({ where: { id, companyId: actor.companyId }, include: { samples: { orderBy: { position: "asc" } } } });
    if (!session) throw new BadRequestException("Sessão não encontrada.");
    const sessionSampleId = body.sessionSampleId ?? session.samples[0]?.id;
    if (!sessionSampleId || !session.samples.some((item) => item.id === sessionSampleId)) throw new BadRequestException("A amostra não pertence a esta sessão.");
    const attributes = body.attributes as Prisma.InputJsonValue;
    const defects = body.defects as Prisma.InputJsonValue | undefined;
    const sensoryNotes = body.sensoryNotes as Prisma.InputJsonValue | undefined;
    return this.database.cuppingEvaluation.upsert({ where: { sessionId_sessionSampleId_evaluatorId: { sessionId: id, sessionSampleId, evaluatorId: actor.id } }, create: { sessionId: id, sessionSampleId, evaluatorId: actor.id, evaluatorName: actor.name, attributes, defects, sensoryNotes, score: scoreCuppingAttributes(body.attributes), completedAt: body.complete ? new Date() : undefined }, update: { attributes, defects, sensoryNotes, score: scoreCuppingAttributes(body.attributes), completedAt: body.complete ? new Date() : null } });
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
