import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { CuppingTrainingLevel, CuppingTrainingStatus, Prisma, PrismaClient } from "@bbos/database";
import { AuthService } from "./auth.service";
import { requireSession } from "./auth-context";
import { CUPPING_ATTRIBUTES, scoreCuppingAttributes } from "./cupping-score";

@Controller("cupping-training")
export class CuppingTrainingController {
  private readonly database = new PrismaClient();
  constructor(private readonly auth: AuthService) {}

  @Get("sessions")
  async list(@Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    return this.database.cuppingTrainingSession.findMany({ where: { companyId: actor.companyId }, include: { evaluations: true }, orderBy: { updatedAt: "desc" } });
  }

  @Post("sessions")
  async create(@Body() body: { title: string; sampleName: string; level?: CuppingTrainingLevel; lesson?: string }, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    if (!body.title?.trim() || !body.sampleName?.trim()) throw new BadRequestException("Informe o nome da sessão e da amostra.");
    const count = await this.database.cuppingTrainingSession.count({ where: { companyId: actor.companyId } });
    return this.database.cuppingTrainingSession.create({ data: { companyId: actor.companyId, code: `TRAIN-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`, title: body.title.trim(), sampleName: body.sampleName.trim(), level: body.level ?? CuppingTrainingLevel.DISCOVERY, lesson: body.lesson?.trim() || undefined, createdById: actor.id, createdByName: actor.name } });
  }

  @Patch("sessions/:id/evaluation")
  async saveEvaluation(@Param("id") id: string, @Body() body: { attributes: Record<string, unknown>; descriptors?: unknown; sensoryMap?: unknown; complete?: boolean }, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const session = await this.database.cuppingTrainingSession.findFirst({ where: { id, companyId: actor.companyId } });
    if (!session) throw new BadRequestException("Sessão de treinamento não encontrada.");
    const values = CUPPING_ATTRIBUTES.map((key) => body.attributes?.[key]).filter((value) => value !== "" && value !== null && value !== undefined).map(Number);
    if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 10)) throw new BadRequestException("Cada atributo deve estar entre 0 e 10.");
    const attributes = body.attributes as Prisma.InputJsonValue;
    return this.database.cuppingTrainingEvaluation.upsert({ where: { sessionId_participantId: { sessionId: id, participantId: actor.id } }, create: { sessionId: id, participantId: actor.id, participantName: actor.name, attributes, descriptors: body.descriptors as Prisma.InputJsonValue | undefined, sensoryMap: body.sensoryMap as Prisma.InputJsonValue | undefined, score: scoreCuppingAttributes(body.attributes), completedAt: body.complete ? new Date() : undefined }, update: { attributes, descriptors: body.descriptors as Prisma.InputJsonValue | undefined, sensoryMap: body.sensoryMap as Prisma.InputJsonValue | undefined, score: scoreCuppingAttributes(body.attributes), completedAt: body.complete ? new Date() : null } });
  }

  @Post("sessions/:id/complete")
  async complete(@Param("id") id: string, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const session = await this.database.cuppingTrainingSession.findFirst({ where: { id, companyId: actor.companyId }, include: { evaluations: true } });
    if (!session) throw new BadRequestException("Sessão de treinamento não encontrada.");
    if (!session.evaluations.some((evaluation) => evaluation.participantId === actor.id && evaluation.completedAt)) throw new BadRequestException("Conclua sua ficha antes de fechar o treinamento.");
    return this.database.cuppingTrainingSession.update({ where: { id }, data: { status: CuppingTrainingStatus.COMPLETED, completedAt: new Date() } });
  }
}
