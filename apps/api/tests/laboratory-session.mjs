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
