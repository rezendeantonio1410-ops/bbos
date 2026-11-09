import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { parseCustomerVisitInput } from "./customer-visit-input";

test("normaliza um relato de visita com próxima ação", () => {
  const result = parseCustomerVisitInput({
    visitAt: "2026-11-09T10:30:00-03:00",
    contactName: "  Maria  ",
    purpose: "NEGOCIACAO",
    outcome: "COTACAO",
    facts: "  Cliente pediu proposta para 20 kg por mês.  ",
    nextAction: "  Enviar proposta comercial  ",
    nextActionAt: "2026-11-10T09:00:00-03:00",
  });

  assert.equal(result.contactName, "Maria");
  assert.equal(result.facts, "Cliente pediu proposta para 20 kg por mês.");
  assert.equal(result.nextAction, "Enviar proposta comercial");
  assert.equal(result.visitAt.toISOString(), "2026-11-09T13:30:00.000Z");
});

test("rejeita data de próxima ação sem a descrição da tarefa", () => {
  assert.throws(
    () =>
      parseCustomerVisitInput({
        visitAt: "2026-11-09T10:30:00-03:00",
        purpose: "POS_VENDA",
        outcome: "ACOMPANHAR",
        facts: "Cliente recebeu os produtos.",
        nextActionAt: "2026-11-10T09:00:00-03:00",
      }),
    BadRequestException,
  );
});

test("rejeita objetivo fora do vocabulário comercial", () => {
  assert.throws(
    () =>
      parseCustomerVisitInput({
        visitAt: "2026-11-09T10:30:00-03:00",
        purpose: "QUALQUER_COISA",
        outcome: "ACOMPANHAR",
        facts: "Registro inválido.",
      }),
    /Objetivo da visita inválido/,
  );
});

test("consulta e gravação de visitas permanecem no escopo da empresa", () => {
  const source = readFileSync(
    join(__dirname, "customers.controller.ts"),
    "utf8",
  );
  assert.match(source, /WHERE v\."companyId"=\$1/);
  assert.match(
    source,
    /where: \{ id, companyId: actor\.companyId, active: true \}/,
  );
  assert.match(source, /actor\.companyId,[\s\S]*actor\.id \?\? null/);
});
