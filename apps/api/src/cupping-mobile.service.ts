import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  type OnModuleDestroy,
} from "@nestjs/common";
import {
  CuppingCupAttribute,
  CuppingDefectSeverity,
  CuppingDescriptorContext,
  CuppingEvaluationStatus,
  CuppingParticipantStatus,
  CuppingProtocol,
  CuppingSessionStatus,
  Prisma,
  PrismaClient,
} from "@bbos/database";
import {
  canEditCuppingEvaluation,
  canReopenCuppingEvaluation,
  isValidCuppingScore,
  buildCuppingSessionProgress,
  nextPendingCuppingSample,
  Traditional100ScoringEngine,
  validateCleanCup,
  validateCleanCupState,
  type CuppingAttribute,
} from "@bbos/shared";
import { createHash, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { CuppingInvitationDeliveryService } from "./cupping-invitation-delivery.service";

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const technicalMap = {
  fragranceAroma: "fragrance",
  flavor: "flavor",
  aftertaste: "finish",
  acidity: "acidity",
  body: "body",
  balance: "balance",
  overall: "overall",
} as const;
type CupInput = {
  attribute: "UNIFORMITY" | "SWEETNESS" | "CLEAN_CUP";
  cupNumber: number;
  selected: boolean;
  defectType?: string;
  defectSeverity?: "TAINT" | "FAULT";
  defectDescription?: string;
  notes?: string;
};
type SelectionInput = {
  context: keyof typeof CuppingDescriptorContext | "FRAGRANCE";
  family: string;
  subfamily?: string;
  descriptor?: string;
  level: number;
  intensity: number;
  imageKey?: string;
};
const descriptorContext = (context: SelectionInput["context"]) =>
  context === "FRAGRANCE"
    ? CuppingDescriptorContext.AROMA
    : context as CuppingDescriptorContext;

@Injectable()
export class CuppingMobileService implements OnModuleDestroy {
  readonly database = new PrismaClient();
  private readonly logger = new Logger(CuppingMobileService.name);
  private readonly traditional100 = new Traditional100ScoringEngine();
  constructor(private readonly delivery: CuppingInvitationDeliveryService) {}
  onModuleDestroy() {
    return this.database.$disconnect();
  }

  private async assertManager(userId: string | undefined, companyId: string) {
    const actor = userId
      ? await this.database.user.findUnique({ where: { id: userId } })
      : null;
    if (
      !actor ||
      !canReopenCuppingEvaluation(actor.role, actor.companyId === companyId)
    )
      throw new ForbiddenException(
        "Ação restrita ao responsável autorizado do laboratório.",
      );
  }

  async release(sessionId: string, participantIds?: string[], userId?: string) {
    const session = await this.database.cuppingSession.findUnique({
      where: { id: sessionId },
      include: { participants: { include: { user: true } } },
    });
    if (!session) throw new NotFoundException("Sessão não encontrada.");
    await this.assertManager(userId, session.companyId);
    const participants = participantIds?.length
      ? session.participants.filter((item) => participantIds.includes(item.id))
      : session.participants;
    if (!participants.length)
      throw new BadRequestException(
        "Adicione ao menos um provador antes de liberar.",
      );
    const appUrl = process.env.PUBLIC_WEB_URL ?? "http://localhost:3000";
    const invitations = [];
    for (const participant of participants) {
      await this.database.cuppingInvitation.updateMany({
        where: { participantId: participant.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const token = randomBytes(32).toString("base64url");
      const invitation = await this.database.cuppingInvitation.create({
        data: {
          sessionId,
          participantId: participant.id,
          tokenHash: hash(token),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await this.database.cuppingParticipant.update({
        where: { id: participant.id },
        data: { status: CuppingParticipantStatus.INVITED },
      });
      const link = `${appUrl}/cupping/mobile/invite/${token}`;
      const qrCode = await QRCode.toDataURL(link, { margin: 1, width: 240 });
      const channel = participant.user.preferredCuppingChannel;
      const delivery =
        channel === "EMAIL"
          ? await this.delivery.sendEmail({
              email: participant.user.email,
              link,
            })
          : channel === "SMS"
            ? await this.delivery.sendSms({
                phone: participant.user.phoneE164,
                link,
              })
            : channel === "WHATSAPP"
              ? await this.delivery.sendWhatsapp({
                  phone: participant.user.phoneE164,
                  link,
                })
              : null;
      invitations.push({
        id: invitation.id,
        participantId: participant.id,
        participant: participant.user.name,
        channel,
        expiresAt: invitation.expiresAt,
        link,
        qrCode,
        delivery,
      });
    }
    await this.database.cuppingSession.update({
      where: { id: sessionId },
      data: {
        status: CuppingSessionStatus.OPEN,
        startedAt: session.startedAt ?? new Date(),
      },
    });
    return invitations;
  }

  async revoke(invitationId: string, userId?: string) {
    const invitation = await this.database.cuppingInvitation.findUnique({
      where: { id: invitationId },
      include: { session: true },
    });
    if (!invitation) throw new NotFoundException("Convite não encontrado.");
    await this.assertManager(userId, invitation.session.companyId);
    return this.database.cuppingInvitation.update({
      where: { id: invitationId },
      data: { revokedAt: new Date() },
    });
  }

  private async invitation(token: string, sessionId?: string) {
    const tokenFingerprint = token ? `${token.slice(0, 6)}…${token.slice(-4)}` : "ausente";
    this.logger.debug(`invite lookup token=${tokenFingerprint} session=${sessionId ?? "não informada"}`);
    if (!token) throw new UnauthorizedException("Convite obrigatório.");
    const invitation = await this.database.cuppingInvitation.findUnique({
      where: { tokenHash: hash(token) },
      include: { participant: { include: { user: true } }, session: true },
    });
    if (!invitation) {
      this.logger.warn(`invite not found token=${tokenFingerprint}`);
      throw new UnauthorizedException("Convite inválido.");
    }
    this.logger.debug(`invite found id=${invitation.id} session=${invitation.sessionId} participant=${invitation.participantId} expires=${invitation.expiresAt.toISOString()} revoked=${Boolean(invitation.revokedAt)}`);
    if (invitation.revokedAt) throw new ForbiddenException("Convite revogado.");
    if (invitation.expiresAt <= new Date())
      throw new GoneException(
        "Este convite expirou. Solicite um novo acesso ao responsável pelo laboratório.",
      );
    if (sessionId && invitation.sessionId !== sessionId)
      throw new ForbiddenException("Este convite pertence a outra sessão.");
    return invitation;
  }

  async accept(token: string) {
    const invitation = await this.invitation(token);
    await this.database.cuppingInvitation.update({
      where: { id: invitation.id },
      data: { usedAt: invitation.usedAt ?? new Date() },
    });
    await this.database.cuppingParticipant.update({
      where: { id: invitation.participantId },
      data: {
        status: CuppingParticipantStatus.IN_PROGRESS,
        startedAt: invitation.participant.startedAt ?? new Date(),
      },
    });
    return {
      sessionId: invitation.sessionId,
      participantId: invitation.participantId,
      participantName: invitation.participant.user.name,
      accessToken: token,
    };
  }

  async context(sessionId: string, token: string) {
    const invitation = await this.invitation(token, sessionId);
    const session = await this.database.cuppingSession.findUnique({
      where: { id: sessionId },
      include: {
        samples: {
          include: { sample: { include: { lot: true } } },
          orderBy: { position: "asc" },
        },
        evaluations: {
          where: { participantId: invitation.participantId },
          include: {
            descriptorSelections: true,
            cupEvaluations: { include: { defect: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException("Sessão não encontrada.");
    const progress = buildCuppingSessionProgress(
      session.samples.map((item) => item.sampleId),
      [invitation.participantId],
      session.evaluations,
    );
    return {
      session,
      progress,
      participant: {
        id: invitation.participantId,
        name: invitation.participant.user.name,
      },
      invitationExpiresAt: invitation.expiresAt,
    };
  }

  async save(
    sessionId: string,
    sampleId: string,
    token: string,
    input: {
      scores?: Partial<Record<CuppingAttribute, number>>;
      stageData?: Record<string, unknown>;
      selections?: SelectionInput[];
      cups?: CupInput[];
      affectiveMemory?: string;
      finalImpression?: string;
      acidityType?: string;
      bodyType?: string;
      aftertastePersistence?: string;
    },
  ) {
    const invitation = await this.invitation(token, sessionId);
    const membership = await this.database.cuppingSessionSample.findUnique({
      where: { sessionId_sampleId: { sessionId, sampleId } },
    });
    if (!membership) throw new ForbiddenException("Amostra fora desta sessão.");
    const existing = await this.database.cuppingEvaluation.findUnique({
      where: {
        sessionId_sampleId_participantId: {
          sessionId,
          sampleId,
          participantId: invitation.participantId,
        },
      },
    });
    if (existing && !canEditCuppingEvaluation(existing.status))
      throw new ForbiddenException(
        "Avaliação finalizada. Solicite reabertura ao responsável.",
      );
    for (const [key, value] of Object.entries(input.scores ?? {})) {
      if (["uniformity", "sweetness", "cleanCup"].includes(key)) {
        if (!Number.isInteger(value) || value! < 0 || value! > 10 || value! % 2)
          throw new BadRequestException(
            `${key} deve variar de 0 a 10 em passos de 2.`,
          );
      } else if (!isValidCuppingScore(value))
        throw new BadRequestException(
          `${key} deve estar entre 6,00 e 10,00 em passos de 0,25.`,
        );
    }
    if (input.cups) {
      for (const attribute of Object.values(CuppingCupAttribute))
        if (
          input.cups.filter((cup) => cup.attribute === attribute).length !== 5
        )
          throw new BadRequestException(
            "Cada grupo deve possuir exatamente cinco xícaras.",
          );
      const clean = input.cups.filter(
        (cup) => cup.attribute === CuppingCupAttribute.CLEAN_CUP,
      );
      if (!validateCleanCup(clean))
        throw new BadRequestException(
          "Toda xícara limpa desmarcada exige um defeito.",
        );
    }
    const scoreData: Record<string, number> = {};
    for (const [clientKey, dbKey] of Object.entries(technicalMap))
      if (input.scores?.[clientKey as CuppingAttribute] != null)
        scoreData[dbKey] = input.scores[clientKey as CuppingAttribute]!;
    if (input.scores?.uniformity != null)
      scoreData.uniformity = input.scores.uniformity;
    if (input.scores?.sweetness != null)
      scoreData.sweetness = input.scores.sweetness;
    if (input.scores?.cleanCup != null)
      scoreData.cleanliness = input.scores.cleanCup;
    return this.database.$transaction(async (tx) => {
      await tx.cuppingSession.updateMany({
        where: { id: sessionId, status: CuppingSessionStatus.OPEN },
        data: { status: CuppingSessionStatus.IN_PROGRESS },
      });
      const evaluation = await tx.cuppingEvaluation.upsert({
        where: {
          sessionId_sampleId_participantId: {
            sessionId,
            sampleId,
            participantId: invitation.participantId,
          },
        },
        update: {
          ...scoreData,
          stageData: input.stageData as Prisma.InputJsonValue | undefined,
          affectiveMemory: input.affectiveMemory?.slice(0, 300),
          finalImpression: input.finalImpression?.slice(0, 300),
          acidityType: input.acidityType,
          bodyType: input.bodyType,
          aftertastePersistence: input.aftertastePersistence,
          autosaveVersion: { increment: 1 },
        },
        create: {
          companyId: invitation.session.companyId,
          sessionId,
          sampleId,
          participantId: invitation.participantId,
          authorId: invitation.participant.userId,
          ...scoreData,
          stageData: input.stageData as Prisma.InputJsonValue | undefined,
          affectiveMemory: input.affectiveMemory?.slice(0, 300),
          finalImpression: input.finalImpression?.slice(0, 300),
          acidityType: input.acidityType,
          bodyType: input.bodyType,
          aftertastePersistence: input.aftertastePersistence,
        },
      });
      if (input.selections) {
        await tx.cuppingDescriptorSelection.deleteMany({
          where: {
            evaluationId: evaluation.id,
            context: {
              in: [
                ...new Set(
                  input.selections.map(
                    (item) => descriptorContext(item.context),
                  ),
                ),
              ],
            },
          },
        });
        await tx.cuppingDescriptorSelection.createMany({
          data: input.selections.map((item) => ({
            evaluationId: evaluation.id,
            context: descriptorContext(item.context),
            family: item.family,
            subfamily: item.subfamily,
            descriptor: item.descriptor,
            level: item.level,
            intensity: Math.min(5, Math.max(1, item.intensity)),
            imageKey: item.imageKey,
          })),
        });
      }
      if (input.cups)
        for (const cup of input.cups) {
          const savedCup = await tx.cuppingCupEvaluation.upsert({
            where: {
              evaluationId_attribute_cupNumber: {
                evaluationId: evaluation.id,
                attribute: cup.attribute as CuppingCupAttribute,
                cupNumber: cup.cupNumber,
              },
            },
            update: { selected: cup.selected, notes: cup.notes },
            create: {
              evaluationId: evaluation.id,
              attribute: cup.attribute as CuppingCupAttribute,
              cupNumber: cup.cupNumber,
              selected: cup.selected,
              notes: cup.notes,
            },
          });
          if (cup.selected)
            await tx.cuppingCupDefect.deleteMany({
              where: { cupEvaluationId: savedCup.id },
            });
          else if (cup.defectType && cup.defectSeverity)
            await tx.cuppingCupDefect.upsert({
              where: { cupEvaluationId: savedCup.id },
              update: {
                defectType: cup.defectType,
                defectSeverity: cup.defectSeverity as CuppingDefectSeverity,
                defectDescription: cup.defectDescription,
                notes: cup.notes,
              },
              create: {
                cupEvaluationId: savedCup.id,
                defectType: cup.defectType,
                defectSeverity: cup.defectSeverity as CuppingDefectSeverity,
                defectDescription: cup.defectDescription,
                notes: cup.notes,
              },
            });
        }
      return evaluation;
    });
  }

  async finalize(sessionId: string, sampleId: string, token: string) {
    const invitation = await this.invitation(token, sessionId);
    const evaluation = await this.database.cuppingEvaluation.findUnique({
      where: {
        sessionId_sampleId_participantId: {
          sessionId,
          sampleId,
          participantId: invitation.participantId,
        },
      },
      include: { cupEvaluations: { include: { defect: true } } },
    });
    if (!evaluation)
      throw new BadRequestException("Avaliação ainda não iniciada.");
    const scores = {
      fragranceAroma: Number(evaluation.fragrance),
      flavor: Number(evaluation.flavor),
      aftertaste: Number(evaluation.finish),
      acidity: Number(evaluation.acidity),
      body: Number(evaluation.body),
      balance: Number(evaluation.balance),
      uniformity: Number(evaluation.uniformity),
      sweetness: Number(evaluation.sweetness),
      cleanCup: Number(evaluation.cleanliness),
      overall: Number(evaluation.overall),
    };
    if (invitation.session.protocol !== CuppingProtocol.TRADITIONAL_100)
      throw new BadRequestException(
        "CVA_EXPERIENCE ainda não possui motor de cálculo ativo.",
      );
    const clean = evaluation.cupEvaluations
      .filter((cup) => cup.attribute === CuppingCupAttribute.CLEAN_CUP)
      .map((cup) => ({
        selected: cup.selected,
        defectType: cup.defect?.defectType,
        defectSeverity: cup.defect?.defectSeverity,
        defectDescription: cup.defect?.defectDescription ?? undefined,
      }));
    if (!validateCleanCupState(scores.cleanCup, clean))
      throw new BadRequestException(
        "Defeitos de xícara limpa precisam ser preenchidos.",
      );
    const defects = evaluation.cupEvaluations
      .filter(
        (cup) =>
          cup.attribute === CuppingCupAttribute.CLEAN_CUP &&
          !cup.selected &&
          cup.defect,
      )
      .map((cup) => ({
        cupNumber: cup.cupNumber,
        defectType: cup.defect!.defectType,
        defectSeverity: cup.defect!.defectSeverity,
        defectDescription: cup.defect!.defectDescription ?? undefined,
      }));
    const result = this.traditional100.calculate({
      attributes: scores,
      defects,
    });
    return this.database.$transaction(async (tx) => {
      await tx.cuppingEvaluation.update({
        where: { id: evaluation.id },
        data: {
          rawScore: result.rawScore,
          defectPenalty: result.defectPenalty,
          finalScore: result.finalScore,
          totalScore: result.finalScore,
          status: CuppingEvaluationStatus.COMPLETED,
          finalizedAt: new Date(),
        },
      });
      const [memberships, evaluations, participantCount] = await Promise.all([
        tx.cuppingSessionSample.findMany({
          where: { sessionId },
          orderBy: { position: "asc" },
          select: { sampleId: true },
        }),
        tx.cuppingEvaluation.findMany({
          where: { sessionId, participantId: invitation.participantId },
          select: { sampleId: true, participantId: true, status: true },
        }),
        tx.cuppingParticipant.count({ where: { sessionId } }),
      ]);
      const sampleIds = memberships.map((item) => item.sampleId);
      const nextSampleId = nextPendingCuppingSample(
        sampleIds,
        invitation.participantId,
        evaluations,
        sampleId,
      );
      const allCompleted = nextSampleId === null;
      const sampleCompleted = await tx.cuppingEvaluation.count({
        where: { sessionId, sampleId, status: CuppingEvaluationStatus.COMPLETED },
      });
      if (sampleCompleted === participantCount)
        await tx.labSample.update({
          where: { id: sampleId },
          data: { status: "EVALUATED" },
        });
      await tx.cuppingParticipant.update({
        where: { id: invitation.participantId },
        data: allCompleted
          ? { status: CuppingParticipantStatus.COMPLETED, completedAt: new Date() }
          : { status: CuppingParticipantStatus.IN_PROGRESS, completedAt: null },
      });
      return { ...result, navigation: { nextSampleId, allCompleted } };
    });
  }

  async reopen(evaluationId: string, userId?: string) {
    const [evaluation, actor] = await Promise.all([
      this.database.cuppingEvaluation.findUnique({
        where: { id: evaluationId },
      }),
      userId ? this.database.user.findUnique({ where: { id: userId } }) : null,
    ]);
    if (
      !evaluation ||
      !actor ||
      !canReopenCuppingEvaluation(
        actor.role,
        evaluation.companyId === actor.companyId,
      )
    )
      throw new ForbiddenException(
        "Somente responsável autorizado pode reabrir a avaliação.",
      );
    return this.database.cuppingEvaluation.update({
      where: { id: evaluationId },
      data: {
        status: CuppingEvaluationStatus.DRAFT,
        reopenedAt: new Date(),
        reopenedById: actor.id,
        finalizedAt: null,
      },
    });
  }
}
