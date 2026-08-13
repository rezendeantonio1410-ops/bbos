import assert from "node:assert/strict";
import test from "node:test";
import { LaboratoryService } from "../dist/laboratory.service.js";

const baseInput = {
  companyId: "company-1",
  code: "CUP-2026-100",
  coordinatorId: "user-coordinator",
  participantUserIds: ["user-coordinator", "user-cupper"],
  sampleIds: ["sample-1"],
  protocol: "TRADITIONAL_100",
  protocolVersion: "1.0",
  mode: "CUPPING",
};

function sessionHarness(options = {}) {
  const committed = {
    samples: [{ id: "sample-1", companyId: options.sampleCompanyId ?? "company-1", status: options.sampleStatus ?? "PENDING", sessions: options.activeSession ? [{ sessionId: "active-1" }] : [] }],
    sessions: [],
  };
  const database = {
    $transaction: async (callback) => {
      const staged = structuredClone(committed);
      const tx = {
        company: { findUnique: async () => options.invalidCompany ? null : { id: "company-1" } },
        user: {
          findFirst: async ({ where }) => options.invalidCoordinator || where.id !== "user-coordinator" ? null : { id: "user-coordinator" },
          findMany: async () => options.invalidParticipant ? [{ id: "user-coordinator" }] : [{ id: "user-coordinator" }, { id: "user-cupper" }],
        },
        labSample: {
          findMany: async ({ where }) => staged.samples.filter((sample) => where.id.in.includes(sample.id)),
          updateMany: async ({ where, data }) => {
            let count = 0;
            staged.samples = staged.samples.map((sample) => {
              if (where.id.in.includes(sample.id) && sample.companyId === where.companyId && sample.status === where.status) { count += 1; return { ...sample, ...data }; }
              return sample;
            });
            return { count };
          },
        },
        cuppingSession: {
          create: async ({ data }) => {
            if (options.failSessionCreate) throw new Error("falha simulada ao criar sessão");
            const session = { id: "session-1", status: "DRAFT", ...data };
            staged.sessions.push(session);
            return { ...session, samples: data.samples.create, participants: data.participants.create };
          },
        },
      };
      const result = await callback(tx);
      committed.samples = staged.samples;
      committed.sessions = staged.sessions;
      return result;
    },
  };
  const service = new LaboratoryService();
  service.database = database;
  return { service, committed };
}

test("contexto retorna usuários ativos autorizados e somente amostras pendentes livres", async () => {
  const service = new LaboratoryService();
  service.database = {
    company: {
      findFirst: async ({ where }) => {
        assert.equal(where.users.some.active, true);
        assert.ok(where.users.some.role.in.includes("ADMIN"));
        return { id: "company-1", name: "BBOS Demo", tradeName: "BBOS" };
      },
    },
    user: {
      findMany: async ({ where }) => {
        assert.equal(where.companyId, "company-1");
        assert.equal(where.active, true);
        assert.ok(where.role.in.includes("INDUSTRIAL"));
        return [{ id: "user-cupper", name: "Provador", email: "provador@demo.local", role: "INDUSTRIAL", preferredCuppingChannel: "QR" }];
      },
    },
    labSample: {
      findMany: async ({ where }) => {
        assert.equal(where.companyId, "company-1");
        assert.equal(where.status, "PENDING");
        assert.ok(where.sessions.none.session.status.in.includes("IN_PROGRESS"));
        return [{ id: "sample-1", sampleCode: "DEMO-001", status: "PENDING", companyId: "company-1" }];
      },
    },
  };

  const context = await service.sessionContext();
  assert.equal(context.company.id, "company-1");
  assert.deepEqual(context.users.map((user) => user.id), ["user-cupper"]);
  assert.deepEqual(context.samples.map((sample) => sample.sampleCode), ["DEMO-001"]);
  assert.equal(context.defaultProtocol, "TRADITIONAL_100");
  assert.equal(context.protocolVersion, "1.0");
});

test("fluxo válido cria sessão, participantes e muda PENDING para ASSIGNED", async () => {
  const { service, committed } = sessionHarness();
  const session = await service.createSession(baseInput);
  assert.equal(session.protocol, "TRADITIONAL_100");
  assert.equal(session.samples.length, 1);
  assert.equal(session.participants.length, 2);
  assert.equal(committed.samples[0].status, "ASSIGNED");
  assert.equal(committed.sessions.length, 1);
});

test("coordenador inválido rejeita criação", async () => {
  const { service, committed } = sessionHarness({ invalidCoordinator: true });
  await assert.rejects(() => service.createSession(baseInput), /Coordenador inválido/);
  assert.equal(committed.sessions.length, 0);
  assert.equal(committed.samples[0].status, "PENDING");
});

test("empresa inválida rejeita criação", async () => {
  const { service, committed } = sessionHarness({ invalidCompany: true });
  await assert.rejects(() => service.createSession(baseInput), /Empresa inválida/);
  assert.equal(committed.sessions.length, 0);
});

test("participante inválido ou de outra empresa rejeita criação", async () => {
  const { service, committed } = sessionHarness({ invalidParticipant: true });
  await assert.rejects(() => service.createSession(baseInput), /provadores são inválidos/);
  assert.equal(committed.sessions.length, 0);
});

test("amostra de outra empresa rejeita criação", async () => {
  const { service, committed } = sessionHarness({ sampleCompanyId: "company-2" });
  await assert.rejects(() => service.createSession(baseInput), /pertencem a outra empresa/);
  assert.equal(committed.samples[0].status, "PENDING");
});

test("amostra vinculada a sessão ativa rejeita novo vínculo", async () => {
  const { service, committed } = sessionHarness({ activeSession: true });
  await assert.rejects(() => service.createSession(baseInput), /sessão ativa/);
  assert.equal(committed.sessions.length, 0);
  assert.equal(committed.samples[0].status, "PENDING");
});

test("falha após atribuição faz rollback completo", async () => {
  const { service, committed } = sessionHarness({ failSessionCreate: true });
  await assert.rejects(() => service.createSession(baseInput), /falha simulada/);
  assert.equal(committed.sessions.length, 0);
  assert.equal(committed.samples[0].status, "PENDING");
});

test("protocolo diferente de TRADITIONAL_100 é bloqueado", async () => {
  const { service } = sessionHarness();
  await assert.rejects(() => service.createSession({ ...baseInput, protocol: "CVA_EXPERIENCE" }), /Somente o protocolo TRADITIONAL_100/);
});

function consolidationHarness(evaluations) {
  const service = new LaboratoryService();
  service.database = {
    cuppingSession: {
      findUnique: async () => ({
        id: "session-1",
        samples: [{ sampleId: "sample-1" }, { sampleId: "sample-2" }],
        participants: [{ id: "participant-1" }],
        evaluations,
      }),
      update: async ({ data }) => ({ id: "session-1", ...data }),
    },
  };
  return service;
}

const completedEvaluation = (sampleId, status = "COMPLETED") => ({
  sampleId,
  participantId: "participant-1",
  status,
  fragrance: 8,
  flavor: 8,
  acidity: 8,
  finish: 8,
  body: 8,
  balance: 8,
  sweetness: 10,
  uniformity: 10,
  cleanliness: 10,
  descriptors: [],
});

test("consolidação não conta rascunho como avaliação concluída", async () => {
  const service = consolidationHarness([
    completedEvaluation("sample-1"),
    completedEvaluation("sample-2", "DRAFT"),
  ]);
  await assert.rejects(() => service.consolidate("session-1"), /1 avaliações concluídas/);
});

test("consolidação mantém resultados separados por amostra", async () => {
  const service = consolidationHarness([
    completedEvaluation("sample-1"),
    { ...completedEvaluation("sample-2"), fragrance: 9 },
  ]);
  const result = await service.consolidate("session-1");
  assert.equal(result.samples.length, 2);
  assert.equal(result.samples[0].averages.fragrance, 8);
  assert.equal(result.samples[1].averages.fragrance, 9);
});
