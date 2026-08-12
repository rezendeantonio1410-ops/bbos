import { BadRequestException, Injectable, NotFoundException, type OnModuleDestroy } from "@nestjs/common";
import { CoffeeLotStatus, CuppingDecisionType, CuppingEvaluationStatus, CuppingParticipantRole, CuppingSessionMode, CuppingSessionStatus, LabSampleStatus, Prisma, PrismaClient } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { qualityDecisionTransition, sensoryIntelligence } from "@bbos/shared";

const ATTRIBUTES = ["fragrance", "flavor", "acidity", "finish", "body", "balance", "sweetness", "uniformity", "cleanliness"] as const;
const SENSORY_ATTRIBUTES = ["fragrance", "flavor", "acidity", "finish", "body", "balance"] as const;

function validateScore(value: unknown, field: string, minimum: number, maximum: number) {
  if (value === null || value === undefined) return;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum || Math.round(number * 100) % 25 !== 0) throw new BadRequestException(`${field} deve estar entre ${minimum.toFixed(2)} e ${maximum.toFixed(2)}, em incrementos de 0,25.`);
}

@Injectable()
export class LaboratoryService implements OnModuleDestroy {
  readonly database = new PrismaClient();
  onModuleDestroy() { return this.database.$disconnect(); }

  async dashboard() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const [sessions, samples, queue, decisions, profiles] = await Promise.all([
      this.database.cuppingSession.findMany({
        include: {
          coordinator: { select: { id: true, name: true } },
          samples: { include: { sample: true } },
          decisions: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.database.labSample.findMany({
        include: { lot: { include: { supplier: { select: { id: true, name: true } } } } },
        orderBy: { createdAt: "asc" },
        take: 200,
      }),
      this.database.labSample.findMany({
        where: { status: { in: [LabSampleStatus.PENDING, LabSampleStatus.ASSIGNED] } },
        select: {
          id: true,
          sampleCode: true,
          sampleType: true,
          status: true,
          createdAt: true,
          lotId: true,
          lot: {
            select: {
              code: true,
              origin: true,
              variety: true,
              receivedAt: true,
              supplier: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 200,
      }),
      this.database.cuppingDecision.findMany({
        where: { decisionAt: { gte: month } },
        include: {
          decisionBy: { select: { id: true, name: true } },
          lot: { select: { id: true, code: true } },
          session: { select: { id: true, code: true } },
        },
        orderBy: { decisionAt: "desc" },
        take: 100,
      }),
      this.database.sensoryProfile.findMany({
        include: { lot: { include: { supplier: { select: { id: true, name: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    const terminalSessionStatuses: CuppingSessionStatus[] = [CuppingSessionStatus.CLOSED, CuppingSessionStatus.CANCELLED];
    const analysisSampleStatuses: LabSampleStatus[] = [LabSampleStatus.ASSIGNED, LabSampleStatus.EVALUATED, LabSampleStatus.CONSOLIDATED];
    const activeSessions = sessions.filter((item) => !terminalSessionStatuses.includes(item.status));
    const intelligence = sensoryIntelligence(profiles.map((profile) => ({
      sessionId: profile.sessionId,
      score: profile.score == null ? null : Number(profile.score),
      descriptors: Array.isArray(profile.descriptors) ? profile.descriptors.filter((item): item is string => typeof item === "string") : [],
      acidityTypes: Array.isArray(profile.acidityTypes) ? profile.acidityTypes.filter((item): item is string => typeof item === "string") : [],
    })));
    const decidedLotIds = new Set(decisions.map((item) => item.lotId));
    const awaitingDecision = samples.filter(
      (item) =>
        (item.status === LabSampleStatus.EVALUATED || item.status === LabSampleStatus.CONSOLIDATED) &&
        !decidedLotIds.has(item.lotId),
    ).length;
    return {
      receivedToday: samples.filter((item) => item.createdAt >= today).length,
      awaitingProof: queue.filter((item) => item.status === LabSampleStatus.PENDING).length,
      inAnalysis: samples.filter((item) => analysisSampleStatuses.includes(item.status)).length,
      approved: decisions.filter((item) => item.decision === CuppingDecisionType.APPROVED || item.decision === CuppingDecisionType.APPROVED_WITH_OBSERVATION).length,
      pending: decisions.filter((item) => item.decision === CuppingDecisionType.RETEST_REQUIRED).length + awaitingDecision,
      queue,
      activeSession: activeSessions[0] ?? null,
      sessions: sessions.slice(0, 8),
      decisions: {
        approved: decisions.filter((item) => item.decision === CuppingDecisionType.APPROVED || item.decision === CuppingDecisionType.APPROVED_WITH_OBSERVATION).length,
        retest: decisions.filter((item) => item.decision === CuppingDecisionType.RETEST_REQUIRED).length,
        blocked: decisions.filter((item) => item.decision === CuppingDecisionType.REJECTED).length,
        awaiting: awaitingDecision,
        recent: decisions.slice(0, 8),
      },
      sensory: intelligence,
    };
  }

  listSessions() { return this.database.cuppingSession.findMany({ include: { samples: { include: { sample: { include: { lot: true } } } }, participants: { include: { user: { select: { id: true, name: true } } } } }, orderBy: { createdAt: "desc" } }); }

  async createSample(input: { companyId: string; lotId: string; sampleCode: string; sampleType?: "ENTRY" | "CONTROL" | "RETEST" | "PRE_PRODUCTION" | "OTHER"; createdById: string; notes?: string }) {
    const lot = await this.database.coffeeLot.findUnique({ where: { id: input.lotId } });
    if (!lot) throw new NotFoundException("Lote não encontrado.");
    return this.database.labSample.create({ data: { companyId: input.companyId, lotId: input.lotId, sampleCode: input.sampleCode, sampleType: input.sampleType, createdById: input.createdById, notes: input.notes } });
  }

  async createSession(input: { companyId: string; code: string; coordinatorId: string; sampleIds?: string[]; protocol?: "TRADITIONAL_100" | "CVA_EXPERIENCE"; protocolVersion?: string; notes?: string; mode?: CuppingSessionMode }) {
    const mode = input.mode ?? CuppingSessionMode.CUPPING;
    if (!Object.values(CuppingSessionMode).includes(mode)) throw new BadRequestException("Modo de sessão inválido.");
    const token = randomUUID().replaceAll("-", "");
    return this.database.cuppingSession.create({ data: { companyId: input.companyId, code: input.code, coordinatorId: input.coordinatorId, mode, protocol: input.protocol ?? "TRADITIONAL_100", protocolVersion: input.protocolVersion ?? "1.0", notes: input.notes, accessToken: token, accessExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), samples: input.sampleIds?.length ? { create: input.sampleIds.map((sampleId, position) => ({ sampleId, position })) } : undefined }, include: { samples: true } });
  }

  async updateSessionMode(sessionId: string, mode: CuppingSessionMode) {
    if (!Object.values(CuppingSessionMode).includes(mode)) throw new BadRequestException("Modo de sessão inválido.");
    const session = await this.database.cuppingSession.findUnique({ where: { id: sessionId }, include: { evaluations: { select: { id: true, status: true } } } });
    if (!session) throw new NotFoundException("Sessão de cupping não encontrada.");
    if (session.status !== CuppingSessionStatus.DRAFT || session.evaluations.length > 0) throw new BadRequestException("O modo só pode ser alterado enquanto a sessão estiver em rascunho.");
    return this.database.cuppingSession.update({ where: { id: sessionId }, data: { mode } });
  }

  async getSession(id: string, revealScores = false) {
    const session = await this.database.cuppingSession.findUnique({ where: { id }, include: { samples: { include: { sample: { include: { lot: true } } } }, participants: { include: { user: { select: { id: true, name: true, email: true, preferredCuppingChannel: true } }, invitations: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, expiresAt: true, usedAt: true, revokedAt: true, createdAt: true } } } }, evaluations: { include: { descriptors: { include: { descriptor: true } }, descriptorSelections: true, cupEvaluations: { include: { defect: true } } } } } });
    if (!session) throw new NotFoundException("Sessão de cupping não encontrada.");
    if (revealScores || session.status === CuppingSessionStatus.CONSOLIDATING || session.status === CuppingSessionStatus.CLOSED) return session;
    return { ...session, evaluations: session.evaluations.map((evaluation) => ({ id: evaluation.id, sampleId: evaluation.sampleId, participantId: evaluation.participantId, savedAt: evaluation.savedAt, descriptors: evaluation.descriptors })) };
  }

  addParticipant(sessionId: string, input: { userId: string; role?: CuppingParticipantRole }) { return this.database.cuppingParticipant.create({ data: { sessionId, userId: input.userId, role: input.role ?? CuppingParticipantRole.CUPPER } }); }

  async saveEvaluation(sessionId: string, input: { companyId: string; sampleId: string; participantId: string; authorId: string; values: Record<string, number | null>; acidityType?: string; notes?: string; descriptorIds?: string[]; cupStates?: Record<string, boolean[]>; autosaveVersion?: number; submitted?: boolean }) {
    const session = await this.database.cuppingSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status === CuppingSessionStatus.CLOSED || session.status === CuppingSessionStatus.CANCELLED) throw new BadRequestException("Sessão encerrada não aceita avaliações.");
    const participant = await this.database.cuppingParticipant.findFirst({ where: { id: input.participantId, sessionId } });
    if (!participant) throw new BadRequestException("Provador não pertence a esta sessão.");
    const sample = await this.database.cuppingSessionSample.findFirst({ where: { sessionId, sampleId: input.sampleId } });
    if (!sample) throw new BadRequestException("Amostra não pertence a esta sessão.");
    SENSORY_ATTRIBUTES.forEach((attribute) => validateScore(input.values[attribute], attribute, 6, 10));
    ["sweetness", "uniformity", "cleanliness"].forEach((attribute) => validateScore(input.values[attribute], attribute, 0, 10));
    if (input.cupStates) Object.entries(input.cupStates).forEach(([key, cups]) => { if (!["sweetness", "uniformity", "cleanliness"].includes(key) || !Array.isArray(cups) || cups.length !== 5 || cups.some((cup) => typeof cup !== "boolean")) throw new BadRequestException("Cada item base deve possuir exatamente cinco xícaras válidas."); });
    const descriptorIds = input.descriptorIds ?? [];
    if (descriptorIds.length) { const descriptors = await this.database.cuppingDescriptor.findMany({ where: { id: { in: descriptorIds }, companyId: input.companyId, active: true }, select: { id: true } }); if (descriptors.length !== descriptorIds.length) throw new BadRequestException("Descritor sensorial inválido ou inativo."); }
    const data: Prisma.CuppingEvaluationUncheckedCreateInput = { companyId: input.companyId, sessionId, sampleId: input.sampleId, participantId: input.participantId, authorId: input.authorId, fragrance: input.values.fragrance ?? undefined, flavor: input.values.flavor ?? undefined, finish: input.values.finish ?? undefined, acidity: input.values.acidity ?? undefined, body: input.values.body ?? undefined, balance: input.values.balance ?? undefined, sweetness: input.values.sweetness ?? undefined, uniformity: input.values.uniformity ?? undefined, cleanliness: input.values.cleanliness ?? undefined, acidityType: input.acidityType, notes: input.notes, cupStates: input.cupStates as Prisma.InputJsonValue | undefined, status: input.submitted ? CuppingEvaluationStatus.COMPLETED : CuppingEvaluationStatus.DRAFT, autosaveVersion: input.autosaveVersion ?? 1 };
    return this.database.$transaction(async (tx) => {
      if (session.status === CuppingSessionStatus.DRAFT) await tx.cuppingSession.update({ where: { id: sessionId }, data: { status: CuppingSessionStatus.IN_PROGRESS, startedAt: new Date() } });
      const evaluation = await tx.cuppingEvaluation.upsert({ where: { sessionId_sampleId_participantId: { sessionId, sampleId: input.sampleId, participantId: input.participantId } }, create: data, update: { ...data, autosaveVersion: input.autosaveVersion ?? { increment: 1 } } });
      if (input.descriptorIds) { await tx.cuppingEvaluationDescriptor.deleteMany({ where: { evaluationId: evaluation.id } }); if (input.descriptorIds.length) await tx.cuppingEvaluationDescriptor.createMany({ data: input.descriptorIds.map((descriptorId) => ({ evaluationId: evaluation.id, descriptorId })) }); }
      await tx.labSample.update({ where: { id: input.sampleId }, data: { status: LabSampleStatus.EVALUATED } });
      return { evaluation, idempotent: false, submitted: input.submitted === true };
    });
  }

  async createDescriptor(input: { companyId: string; name: string; type: string; group: string; subgroup: string; parentId?: string; source?: string }) {
    if (!input.name?.trim() || !input.group?.trim() || !input.subgroup?.trim()) throw new BadRequestException("Nome, grupo e subgrupo são obrigatórios.");
    return this.database.cuppingDescriptor.create({ data: { companyId: input.companyId, name: input.name.trim(), category: input.group.trim(), type: input.type || "FLAVOR", group: input.group.trim(), subgroup: input.subgroup.trim(), parentId: input.parentId, source: "CUSTOM_BBOS" } });
  }

  async consolidate(sessionId: string) {
    const session = await this.database.cuppingSession.findUnique({ where: { id: sessionId }, include: { samples: true, participants: true, evaluations: { include: { descriptors: { include: { descriptor: true } } } } } });
    if (!session) throw new NotFoundException("Sessão não encontrada.");
    const evaluations = session.evaluations;
    if (!evaluations.length) throw new BadRequestException("Não há avaliações para consolidar.");
    const expected = session.samples.length * session.participants.length;
    if (session.participants.length === 0 || evaluations.length < expected) throw new BadRequestException(`Ainda faltam ${Math.max(expected - evaluations.length, 0)} avaliações para consolidar.`);
    const averages = Object.fromEntries(ATTRIBUTES.map((key) => [key, Number((evaluations.reduce((sum, row) => sum + (Number(row[key]) || 0), 0) / evaluations.length).toFixed(2))]));
    const descriptors = new Map<string, number>();
    evaluations.forEach((row) => row.descriptors.forEach(({ descriptor }) => descriptors.set(descriptor.name, (descriptors.get(descriptor.name) ?? 0) + 1)));
    return this.database.cuppingSession.update({ where: { id: sessionId }, data: { status: CuppingSessionStatus.CONSOLIDATING }, include: { evaluations: true } }).then((updated) => ({ session: updated, averages, recurringDescriptors: [...descriptors.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })) }));
  }

  async decide(sessionId: string, input: { lotId: string; companyId: string; decision: CuppingDecisionType; decisionById: string; notes?: string; averages?: Record<string, number>; descriptors?: string[] }) {
    const transition = qualityDecisionTransition(input.decision);
    if (transition.requiresReason && !input.notes?.trim()) throw new BadRequestException("A decisão selecionada exige motivo ou observação.");
    return this.database.$transaction(async (tx) => {
      const decision = await tx.cuppingDecision.create({ data: { companyId: input.companyId, lotId: input.lotId, sessionId, decision: input.decision, decisionById: input.decisionById, notes: input.notes } });
      const approved = input.decision === CuppingDecisionType.APPROVED || input.decision === CuppingDecisionType.APPROVED_WITH_OBSERVATION;
      await tx.coffeeLot.update({ where: { id: input.lotId }, data: { status: transition.lotStatus as CoffeeLotStatus } });
      await tx.labSample.updateMany({ where: { sessions: { some: { sessionId } } }, data: { status: transition.sampleStatus as LabSampleStatus } });
      if (approved) await tx.sensoryProfile.create({ data: { companyId: input.companyId, lotId: input.lotId, sessionId, score: input.averages ? Object.values(input.averages).reduce((sum, value) => sum + value, 0) / Math.max(Object.values(input.averages).length, 1) : undefined, attributes: input.averages ?? {}, acidityTypes: [], descriptors: input.descriptors ?? [], notes: input.notes } });
      await tx.cuppingSession.update({ where: { id: sessionId }, data: { status: CuppingSessionStatus.CLOSED, closedAt: new Date() } });
      return decision;
    });
  }

  async getByToken(token: string, participantId?: string) {
    const session = await this.database.cuppingSession.findUnique({ where: { accessToken: token } });
    if (!session || !session.accessExpiresAt || session.accessExpiresAt < new Date()) throw new NotFoundException("Link de cupping expirado ou inválido.");
    const [samples, descriptors, participants] = await Promise.all([
      this.database.cuppingSessionSample.findMany({ where: { sessionId: session.id }, include: { sample: { include: { lot: true } } }, orderBy: { position: "asc" } }),
      this.database.cuppingDescriptor.findMany({ where: { companyId: session.companyId, active: true }, orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
      this.database.cuppingParticipant.findMany({ where: { sessionId: session.id }, include: { user: { select: { id: true, name: true } } } }),
    ]);
    if (participantId && !participants.some((participant) => participant.id === participantId)) throw new BadRequestException("Provador não pertence a esta sessão.");
    const evaluation = participantId ? await this.database.cuppingEvaluation.findFirst({ where: { sessionId: session.id, participantId }, include: { descriptors: { include: { descriptor: true } } } }) : null;
    return { id: session.id, companyId: session.companyId, code: session.code, protocol: session.protocol, mode: session.mode, status: session.status, expiresAt: session.accessExpiresAt, samples, descriptors, participants, participantId: participantId ?? null, evaluation };
  }
}
