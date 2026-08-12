import {
  CoffeeLotStatus,
  CuppingDecisionType,
  CuppingEvaluationStatus,
  CuppingParticipantRole,
  CuppingProtocol,
  CuppingSessionMode,
  CuppingSessionStatus,
  LabSampleStatus,
  LabSampleType,
  PrismaClient,
  UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();
export const LAB_DEMO_TAX_ID = "DEMO-BBOS-LAB-2026";

function assertDevelopmentSeed() {
  if (process.env.NODE_ENV === "production" || process.env.BBOS_ALLOW_DEMO_SEED !== "1")
    throw new Error("Seed DEMO bloqueado. Use exclusivamente o comando seed:lab-demo em ambiente DEV.");
}

const lots = [
  { code: "DEMO-LOT-001", sample: "DEMO-001", variety: "Arábica", origin: "Sul de Minas", type: LabSampleType.ENTRY, status: LabSampleStatus.PENDING, lotStatus: CoffeeLotStatus.QUALITY_REVIEW, notes: "DEMO · Finalidade: Recebimento" },
  { code: "DEMO-LOT-002", sample: "DEMO-002", variety: "Arábica", origin: "Mantiqueira de Minas", type: LabSampleType.CONTROL, status: LabSampleStatus.APPROVED, lotStatus: CoffeeLotStatus.APPROVED, notes: "DEMO · Resultado aprovado" },
  { code: "DEMO-LOT-003", sample: "DEMO-003", variety: "Robusta / Conilon", origin: "Espírito Santo", type: LabSampleType.RETEST, status: LabSampleStatus.PENDING, lotStatus: CoffeeLotStatus.QUALITY_REVIEW, notes: "DEMO · Reanálise solicitada · pontuação anterior 80,00" },
  { code: "DEMO-LOT-004", sample: "DEMO-004", variety: "Microlote raro", origin: "Chapada Diamantina", type: LabSampleType.CONTROL, status: LabSampleStatus.EVALUATED, lotStatus: CoffeeLotStatus.QUALITY_REVIEW, notes: "DEMO · Em análise · pontuação parcial" },
  { code: "DEMO-LOT-005", sample: "DEMO-005", variety: "Blend base", origin: "Cerrado Mineiro", type: LabSampleType.PRE_PRODUCTION, status: LabSampleStatus.BLOCKED, lotStatus: CoffeeLotStatus.BLOCKED, notes: "DEMO · Bloqueado por divergência sensorial" },
  { code: "DEMO-LOT-006", sample: "DEMO-006", variety: "Café especial", origin: "Matas de Minas", type: LabSampleType.ENTRY, status: LabSampleStatus.PENDING, lotStatus: CoffeeLotStatus.QUALITY_REVIEW, notes: "DEMO · Finalidade: Recebimento · Prioridade alta" },
] as const;

const descriptorDefinitions = [
  ["Caramelo", "Doçura", "FLAVOR"], ["Chocolate", "Chocolate/Cacau", "FLAVOR"],
  ["Cítrico", "Frutado", "FLAVOR"], ["Frutas vermelhas", "Frutado", "FLAVOR"],
  ["Floral", "Floral", "AROMA"], ["Doce de leite", "Doçura", "FLAVOR"],
  ["Frutas amarelas", "Frutado", "FLAVOR"], ["Nozes", "Nozes/Cacau", "FLAVOR"],
] as const;

export async function seedLaboratoryDemo(client: PrismaClient) {
  assertDevelopmentSeed();
  const company = await client.company.upsert({
    where: { taxId: LAB_DEMO_TAX_ID },
    update: { name: "DEMO - BBOS Laboratório", tradeName: "DEMO - Laboratório" },
    create: { name: "DEMO - BBOS Laboratório", tradeName: "DEMO - Laboratório", taxId: LAB_DEMO_TAX_ID },
  });
  const coordinator = await client.user.upsert({
    where: { email: "demo-lab-coordinator@bbos.local" },
    update: { companyId: company.id, name: "DEMO - Gestor de Qualidade", role: UserRole.ADMIN, active: true },
    create: { companyId: company.id, name: "DEMO - Gestor de Qualidade", email: "demo-lab-coordinator@bbos.local", passwordHash: "DEMO-NOT-FOR-AUTH", role: UserRole.ADMIN },
  });
  const cupper = await client.user.upsert({
    where: { email: "demo-lab-cupper@bbos.local" },
    update: { companyId: company.id, name: "DEMO - Laboratorista", role: UserRole.INDUSTRIAL, active: true },
    create: { companyId: company.id, name: "DEMO - Laboratorista", email: "demo-lab-cupper@bbos.local", passwordHash: "DEMO-NOT-FOR-AUTH", role: UserRole.INDUSTRIAL },
  });
  const supplier = await client.supplier.upsert({
    where: { id: "DEMO-LAB-SUPPLIER" },
    update: { companyId: company.id, name: "DEMO - Produtores de Café" },
    create: { id: "DEMO-LAB-SUPPLIER", companyId: company.id, name: "DEMO - Produtores de Café", city: "Cidade DEMO", state: "MG" },
  });
  const warehouse = await client.warehouse.upsert({
    where: { companyId_code: { companyId: company.id, code: "DEMO-LAB" } },
    update: { name: "DEMO - Armazém de Qualidade" },
    create: { companyId: company.id, code: "DEMO-LAB", name: "DEMO - Armazém de Qualidade", type: "QUALITY_DEMO" },
  });

  const samples = [];
  for (const [index, definition] of lots.entries()) {
    const lot = await client.coffeeLot.upsert({
      where: { companyId_code: { companyId: company.id, code: definition.code } },
      update: { status: definition.lotStatus, origin: definition.origin, variety: definition.variety },
      create: { companyId: company.id, supplierId: supplier.id, warehouseId: warehouse.id, code: definition.code, origin: definition.origin, harvest: "DEMO-2026/27", variety: definition.variety, initialWeightKg: 100 + index * 10, currentWeightKg: 100 + index * 10, purchaseCost: 1000 + index * 100, landedCost: 1100 + index * 100, status: definition.lotStatus },
    });
    const sample = await client.labSample.upsert({
      where: { companyId_sampleCode: { companyId: company.id, sampleCode: definition.sample } },
      update: { lotId: lot.id, sampleType: definition.type, status: definition.status, notes: definition.notes },
      create: { companyId: company.id, lotId: lot.id, sampleCode: definition.sample, sampleType: definition.type, status: definition.status, notes: definition.notes, createdById: coordinator.id },
    });
    samples.push({ sample, lot });
  }

  const descriptors = new Map<string, string>();
  for (const [name, category, type] of descriptorDefinitions) {
    const descriptor = await client.cuppingDescriptor.upsert({
      where: { companyId_name: { companyId: company.id, name } },
      update: { category, group: category, subgroup: name, type, source: "DEMO", active: true },
      create: { companyId: company.id, name, category, group: category, subgroup: name, type, source: "DEMO" },
    });
    descriptors.set(name, descriptor.id);
  }

  await client.cuppingSession.updateMany({ where: { companyId: company.id, code: "DEMO-CUP-2026-001" }, data: { code: "CUP-2026-001", notes: "DEMO · Sessão oficial finalizada" } });
  const closedSession = await client.cuppingSession.upsert({
    where: { companyId_code: { companyId: company.id, code: "CUP-2026-001" } },
    update: { coordinatorId: coordinator.id, mode: CuppingSessionMode.CUPPING, status: CuppingSessionStatus.CLOSED, protocol: CuppingProtocol.TRADITIONAL_100, protocolVersion: "1.0", closedAt: new Date() },
    create: { companyId: company.id, code: "CUP-2026-001", coordinatorId: coordinator.id, mode: CuppingSessionMode.CUPPING, status: CuppingSessionStatus.CLOSED, protocol: CuppingProtocol.TRADITIONAL_100, protocolVersion: "1.0", startedAt: new Date(Date.now() - 2 * 86400000), closedAt: new Date(Date.now() - 86400000), notes: "DEMO · Sessão oficial finalizada" },
  });
  const activeSession = await client.cuppingSession.upsert({
    where: { companyId_code: { companyId: company.id, code: "DEMO-CUP-2026-002" } },
    update: { coordinatorId: coordinator.id, mode: CuppingSessionMode.TRAINING, status: CuppingSessionStatus.IN_PROGRESS, protocol: CuppingProtocol.TRADITIONAL_100, protocolVersion: "1.0" },
    create: { companyId: company.id, code: "DEMO-CUP-2026-002", coordinatorId: coordinator.id, mode: CuppingSessionMode.TRAINING, status: CuppingSessionStatus.IN_PROGRESS, protocol: CuppingProtocol.TRADITIONAL_100, protocolVersion: "1.0", startedAt: new Date(), notes: "DEMO · Sessão de treinamento em andamento" },
  });
  for (const [position, item] of samples.entries())
    await client.cuppingSessionSample.upsert({ where: { sessionId_sampleId: { sessionId: closedSession.id, sampleId: item.sample.id } }, update: { position }, create: { sessionId: closedSession.id, sampleId: item.sample.id, position } });
  for (const [position, item] of [samples[0]!, samples[3]!, samples[5]!].entries())
    await client.cuppingSessionSample.upsert({ where: { sessionId_sampleId: { sessionId: activeSession.id, sampleId: item.sample.id } }, update: { position }, create: { sessionId: activeSession.id, sampleId: item.sample.id, position } });

  const closedParticipant = await client.cuppingParticipant.upsert({ where: { sessionId_userId: { sessionId: closedSession.id, userId: cupper.id } }, update: { role: CuppingParticipantRole.CUPPER }, create: { sessionId: closedSession.id, userId: cupper.id, role: CuppingParticipantRole.CUPPER } });
  await client.cuppingParticipant.upsert({ where: { sessionId_userId: { sessionId: closedSession.id, userId: coordinator.id } }, update: { role: CuppingParticipantRole.CUPPER }, create: { sessionId: closedSession.id, userId: coordinator.id, role: CuppingParticipantRole.CUPPER } });
  await client.cuppingParticipant.upsert({ where: { sessionId_userId: { sessionId: activeSession.id, userId: cupper.id } }, update: { role: CuppingParticipantRole.CUPPER }, create: { sessionId: activeSession.id, userId: cupper.id, role: CuppingParticipantRole.CUPPER } });

  const evaluationDefinitions = [
    { index: 1, score: 88.25, acidity: "Cítrica", descriptors: ["Caramelo", "Chocolate", "Cítrico"] },
    { index: 2, score: 80, acidity: "Láctica", descriptors: ["Chocolate", "Nozes"] },
    { index: 4, score: 76, acidity: "Málica", descriptors: ["Nozes"] },
  ];
  for (const definition of evaluationDefinitions) {
    const item = samples[definition.index]!;
    const evaluation = await client.cuppingEvaluation.upsert({
      where: { sessionId_sampleId_participantId: { sessionId: closedSession.id, sampleId: item.sample.id, participantId: closedParticipant.id } },
      update: definition.index === 1 ? { fragrance: 8.25, flavor: 8.5, finish: 8.25, acidity: 8.25, body: 8.25, balance: 8.25, uniformity: 10, sweetness: 10, cleanliness: 10, overall: 8.5, totalScore: 88.25, finalizedAt: new Date(), status: CuppingEvaluationStatus.COMPLETED, acidityType: definition.acidity, notes: "DEMO · Amostra 03 · Arábica Natural · Pontuação final 88,25" } : { totalScore: definition.score, status: CuppingEvaluationStatus.COMPLETED, acidityType: definition.acidity, notes: `DEMO · Pontuação final ${definition.score.toFixed(2)}` },
      create: { companyId: company.id, sessionId: closedSession.id, sampleId: item.sample.id, participantId: closedParticipant.id, authorId: cupper.id, fragrance: definition.index === 1 ? 8.25 : 8, flavor: definition.index === 1 ? 8.5 : 8, finish: definition.index === 1 ? 8.25 : 8, acidity: definition.index === 1 ? 8.25 : 8, body: definition.index === 1 ? 8.25 : 8, balance: definition.index === 1 ? 8.25 : 8, sweetness: 10, uniformity: 10, cleanliness: 10, overall: definition.index === 1 ? 8.5 : 8, totalScore: definition.score, finalizedAt: new Date(), acidityType: definition.acidity, notes: definition.index === 1 ? "DEMO · Amostra 03 · Arábica Natural · Pontuação final 88,25" : `DEMO · Pontuação final ${definition.score.toFixed(2)}`, status: CuppingEvaluationStatus.COMPLETED },
    });
    await client.cuppingEvaluationDescriptor.deleteMany({ where: { evaluationId: evaluation.id } });
    await client.cuppingEvaluationDescriptor.createMany({ data: definition.descriptors.map((name) => ({ evaluationId: evaluation.id, descriptorId: descriptors.get(name)! })) });
    await client.sensoryProfile.upsert({
      where: { id: `DEMO-PROFILE-${definition.index + 1}` },
      update: { score: definition.score, descriptors: definition.descriptors, acidityTypes: [definition.acidity], sessionId: closedSession.id, lotId: item.lot.id },
      create: { id: `DEMO-PROFILE-${definition.index + 1}`, companyId: company.id, lotId: item.lot.id, sessionId: closedSession.id, score: definition.score, attributes: { source: "DEMO" }, descriptors: definition.descriptors, acidityTypes: [definition.acidity], notes: "DEMO · Perfil sensorial simulado" },
    });
  }
  const partial = samples[3]!;
  await client.cuppingEvaluation.upsert({
    where: { sessionId_sampleId_participantId: { sessionId: activeSession.id, sampleId: partial.sample.id, participantId: (await client.cuppingParticipant.findUniqueOrThrow({ where: { sessionId_userId: { sessionId: activeSession.id, userId: cupper.id } } })).id } },
    update: { fragrance: 8.25, flavor: 8.5, acidity: 8.25, status: CuppingEvaluationStatus.DRAFT, notes: "DEMO · Avaliação parcial em andamento" },
    create: { companyId: company.id, sessionId: activeSession.id, sampleId: partial.sample.id, participantId: (await client.cuppingParticipant.findUniqueOrThrow({ where: { sessionId_userId: { sessionId: activeSession.id, userId: cupper.id } } })).id, authorId: cupper.id, fragrance: 8.25, flavor: 8.5, acidity: 8.25, status: CuppingEvaluationStatus.DRAFT, notes: "DEMO · Avaliação parcial em andamento" },
  });

  const decisionDefinitions = [
    { id: "DEMO-DECISION-APPROVED", index: 1, decision: CuppingDecisionType.APPROVED, notes: "DEMO · Aprovado para produção" },
    { id: "DEMO-DECISION-RETEST", index: 2, decision: CuppingDecisionType.RETEST_REQUIRED, notes: "DEMO · Reanálise após pontuação 80,00" },
    { id: "DEMO-DECISION-BLOCKED", index: 4, decision: CuppingDecisionType.REJECTED, notes: "DEMO · Bloqueado por divergência sensorial" },
  ];
  for (const item of decisionDefinitions) await client.cuppingDecision.upsert({
    where: { id: item.id },
    update: { decision: item.decision, notes: item.notes, decisionById: coordinator.id },
    create: { id: item.id, companyId: company.id, lotId: samples[item.index]!.lot.id, sessionId: closedSession.id, decision: item.decision, decisionById: coordinator.id, notes: item.notes },
  });

  return { company, samples: samples.length, sessions: 2, decisions: decisionDefinitions.length, descriptors: descriptors.size };
}

if (require.main === module)
  seedLaboratoryDemo(prisma)
    .then((result) => console.log(`Seed DEMO concluído: ${result.samples} amostras, ${result.sessions} sessões, ${result.decisions} decisões e ${result.descriptors} descritores.`))
    .finally(() => prisma.$disconnect());
