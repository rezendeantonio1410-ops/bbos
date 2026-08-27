import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { CuppingParticipantInviteStatus, CuppingParticipantStatus, CuppingPublicKind, CuppingPublicStatus, Prisma, PrismaClient } from "@bbos/database";
import { createHash, randomBytes } from "node:crypto";
import * as QRCode from "qrcode";
import { AuthService } from "./auth.service";
import { Public } from "./auth.guard";
import { requireSession } from "./auth-context";
import { CUPPING_ATTRIBUTES, scoreCuppingAttributes } from "./cupping-score";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
};

@Controller("cupping-public")
export class CuppingPublicController {
  private readonly db = new PrismaClient();
  constructor(private readonly auth: AuthService) {}

  @Get("sessions")
  async list(@Req() request: Request) {
    const actor = await requireSession(request, this.auth);
    return this.db.cuppingPublicSession.findMany({ where: { companyId: actor.companyId }, include: { participants: { select: { id: true, name: true, status: true, joinedAt: true, completedAt: true } }, professionalSample: { select: { code: true, status: true } } }, orderBy: { createdAt: "desc" } });
  }

  @Post("sessions")
  async create(@Body() body: { kind: CuppingPublicKind; professionalSampleId?: string; referenceProfile?: unknown }, @Req() request: Request) {
    const actor = await requireSession(request, this.auth);
    if (!Object.values(CuppingPublicKind).includes(body.kind)) throw new BadRequestException("Escolha o tipo de sessão.");
    if (body.kind === CuppingPublicKind.PROFESSIONAL && body.professionalSampleId) {
      const sample = await this.db.professionalCoffeeSample.findFirst({ where: { id: body.professionalSampleId, companyId: actor.companyId } });
      if (!sample) throw new BadRequestException("Amostra profissional inválida.");
    }
    const sequence = (await this.db.cuppingPublicSession.count({ where: { companyId: actor.companyId, kind: body.kind } })) + 1;
    const prefix = body.kind === CuppingPublicKind.TRAINING ? "TR" : "CU";
    const code = `${prefix}-${new Date().getFullYear()}-${String(sequence).padStart(6, "0")}`;
    const token = randomBytes(32).toString("base64url");
    const baseUrl = process.env.WEB_URL || `${request.protocol}://${request.get("host")}`;
    const publicUrl = `${baseUrl.replace(/\/$/, "")}/cupping/mobile/invite/${token}`;
    const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, { errorCorrectionLevel: "M", margin: 2, width: 320 });
    const session = await this.db.cuppingPublicSession.create({ data: { companyId: actor.companyId, kind: body.kind, code, status: CuppingPublicStatus.OPEN, tokenHash: hashToken(token), professionalSampleId: body.professionalSampleId, referenceProfile: body.referenceProfile as Prisma.InputJsonValue | undefined, createdById: actor.id, createdByName: actor.name, openedAt: new Date() }, include: { participants: true } });
    return { ...session, publicUrl, qrCodeDataUrl, rawToken: undefined };
  }

  @Get("sessions/:id/panel")
  async panel(@Param("id") id: string, @Req() request: Request) {
    const actor = await requireSession(request, this.auth);
    const session = await this.db.cuppingPublicSession.findFirst({ where: { id, companyId: actor.companyId }, include: { participants: { select: { id: true, name: true, status: true, joinedAt: true, completedAt: true } }, professionalSample: true } });
    if (!session) throw new BadRequestException("Sessão não encontrada.");
    return { ...session, counts: { total: session.participants.length, joined: session.participants.filter((item) => item.status !== CuppingParticipantStatus.JOINED).length, completed: session.participants.filter((item) => item.status === CuppingParticipantStatus.COMPLETED).length } };
  }

  @Post("sessions/:id/close")
  async close(@Param("id") id: string, @Req() request: Request) {
    const actor = await requireSession(request, this.auth);
    const session = await this.db.cuppingPublicSession.findFirst({ where: { id, companyId: actor.companyId } });
    if (!session) throw new BadRequestException("Sessão não encontrada.");
    return this.db.cuppingPublicSession.update({ where: { id }, data: { status: CuppingPublicStatus.CLOSED, closedAt: new Date() } });
  }

  @Get("sessions/:id/comparison")
  async comparison(@Param("id") id: string, @Req() request: Request) {
    const actor = await requireSession(request, this.auth);
    const session = await this.db.cuppingPublicSession.findFirst({ where: { id, companyId: actor.companyId }, include: { participants: { include: { evaluation: true } } } });
    if (!session) throw new BadRequestException("Sessão não encontrada.");
    if (session.status !== CuppingPublicStatus.CLOSED) throw new BadRequestException("A comparação será liberada após o encerramento.");
    const completed = session.participants.filter((participant) => participant.evaluation?.completedAt);
    const averages = Object.fromEntries(CUPPING_ATTRIBUTES.map((attribute) => {
      const values = completed.map((participant) => Number((participant.evaluation?.attributes as Record<string, unknown> | null)?.[attribute])).filter(Number.isFinite);
      return [attribute, values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null];
    }));
    return {
      sessionId: session.id,
      code: session.code,
      kind: session.kind,
      reference: session.referenceProfile,
      averages,
      participants: completed.map((participant) => ({ id: participant.id, name: participant.name, score: participant.evaluation?.score, attributes: participant.evaluation?.attributes })),
    };
  }

  @Public()
  @Get("public/:token")
  async publicSession(@Param("token") token: string) {
    const session = await this.db.cuppingPublicSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { professionalSample: { select: { code: true, supplier: { select: { name: true } }, originUnit: { select: { name: true } }, harvest: true, species: true, cultivar: true, process: true } } } });
    if (!session || session.status !== CuppingPublicStatus.OPEN || (session.tokenExpiresAt && session.tokenExpiresAt < new Date())) throw new BadRequestException("Esta sessão não está disponível.");
    return { id: session.id, code: session.code, kind: session.kind, status: session.status, sample: session.professionalSample };
  }

  /** Safe resolver used by new Laboratory QR links. It exposes only the
   * participant-facing session identity; source metadata remains server-side. */
  @Public()
  @Get("public/:token/mobile")
  async mobileInvite(@Param("token") token: string) {
    const participantInvite = await this.db.cuppingParticipantInvite.findUnique({ where: { tokenHash: hashToken(token) }, include: { session: { include: { samples: { orderBy: { position: "asc" } }, evaluations: true } } } });
    if (participantInvite) {
      if (participantInvite.status !== CuppingParticipantInviteStatus.ACTIVE || (participantInvite.expiresAt && participantInvite.expiresAt < new Date())) throw new BadRequestException("Este convite não está disponível.");
      const session = participantInvite.session;
      const next = session.samples.find((sample) => !session.evaluations.some((evaluation) => evaluation.evaluatorId === participantInvite.participantId && evaluation.sessionSampleId === sample.id && evaluation.completedAt));
      await this.db.cuppingParticipantInvite.update({ where: { id: participantInvite.id }, data: { lastUsedAt: new Date() } });
      if (!next) return { completed: true, sessionId: session.id, participantId: participantInvite.participantId, mode: "V1" };
      return { sessionId: session.id, participantId: participantInvite.participantId, sessionSampleId: next.id, blindCode: next.blindCode, displayCode: next.blindCode || `Amostra ${String(next.position).padStart(2, "0")}`, mode: "V1" };
    }
    const session = await this.db.cuppingPublicSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { professionalSample: { select: { code: true } } } });
    if (!session || session.status !== CuppingPublicStatus.OPEN || (session.tokenExpiresAt && session.tokenExpiresAt < new Date())) throw new BadRequestException("Este convite não está disponível.");
    return { sessionId: session.id, code: session.code, sample: session.professionalSample ? { displayCode: session.professionalSample.code } : null, mode: session.kind };
  }

  @Public()
  @Post("public/:token/join")
  async join(@Param("token") token: string, @Body() body: { name: string; phone: string; institution?: string }) {
    const session = await this.db.cuppingPublicSession.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!session || session.status !== CuppingPublicStatus.OPEN) throw new BadRequestException("Esta sessão não está disponível.");
    const name = body.name?.trim();
    const phone = normalizePhone(body.phone ?? "");
    if (!name) throw new BadRequestException("Informe seu nome completo.");
    if (phone.length < 12) throw new BadRequestException("Informe um telefone ou WhatsApp válido.");
    const participant = await this.db.cuppingParticipant.upsert({ where: { sessionId_normalizedPhone: { sessionId: session.id, normalizedPhone: phone } }, create: { sessionId: session.id, name, phone, normalizedPhone: phone, institution: body.institution?.trim() || undefined, status: CuppingParticipantStatus.IN_PROGRESS }, update: { name, phone, institution: body.institution?.trim() || undefined, status: CuppingParticipantStatus.IN_PROGRESS } });
    return { participantId: participant.id, sessionId: session.id, status: participant.status };
  }

  @Public()
  @Get("public/:token/participant/:participantId")
  async participant(@Param("token") token: string, @Param("participantId") participantId: string) {
    const session = await this.db.cuppingPublicSession.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!session || session.status === CuppingPublicStatus.CANCELLED) throw new BadRequestException("Sessão não encontrada.");
    const participant = await this.db.cuppingParticipant.findFirst({ where: { id: participantId, sessionId: session.id }, include: { evaluation: true } });
    if (!participant) throw new BadRequestException("Participante não encontrado.");
    return { id: participant.id, name: participant.name, status: participant.status, evaluation: participant.evaluation };
  }

  @Public()
  @Patch("public/:token/participant/:participantId/evaluation")
  async saveEvaluation(@Param("token") token: string, @Param("participantId") participantId: string, @Body() body: { attributes: Record<string, unknown>; descriptors?: unknown; sensoryMap?: unknown; complete?: boolean }) {
    const session = await this.db.cuppingPublicSession.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!session || session.status !== CuppingPublicStatus.OPEN || (session.tokenExpiresAt && session.tokenExpiresAt < new Date())) throw new BadRequestException("Esta sessão não está disponível.");
    const participant = await this.db.cuppingParticipant.findFirst({ where: { id: participantId, sessionId: session.id } });
    if (!participant) throw new BadRequestException("Participante não encontrado.");
    const values = Object.entries(body.attributes ?? {}).filter(([key]) => CUPPING_ATTRIBUTES.includes(key as (typeof CUPPING_ATTRIBUTES)[number]));
    if (values.some(([, value]) => value !== null && value !== undefined && value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 10))) throw new BadRequestException("Cada atributo deve estar entre 0 e 10.");
    const attributes = body.attributes as Prisma.InputJsonValue;
    const evaluation = await this.db.cuppingParticipantEvaluation.upsert({ where: { participantId }, create: { participantId, attributes, descriptors: body.descriptors as Prisma.InputJsonValue | undefined, sensoryMap: body.sensoryMap as Prisma.InputJsonValue | undefined, score: scoreCuppingAttributes(body.attributes), completedAt: body.complete ? new Date() : undefined }, update: { attributes, descriptors: body.descriptors as Prisma.InputJsonValue | undefined, sensoryMap: body.sensoryMap as Prisma.InputJsonValue | undefined, score: scoreCuppingAttributes(body.attributes), completedAt: body.complete ? new Date() : null } });
    await this.db.cuppingParticipant.update({ where: { id: participantId }, data: { status: body.complete ? CuppingParticipantStatus.COMPLETED : CuppingParticipantStatus.IN_PROGRESS, completedAt: body.complete ? new Date() : null } });
    return evaluation;
  }
}
