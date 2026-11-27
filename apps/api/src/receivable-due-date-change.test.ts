import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDueDateChange } from "./receivable-due-date-change";

const now = new Date("2026-11-27T23:30:00Z"); // 20h30 em São Paulo, dia 27

test("aceita data de hoje em diante, gravada ao meio-dia UTC", () => {
  const today = parseDueDateChange({ dueDate: "2026-11-27", reason: "Cliente pediu para pagar hoje à noite" }, now);
  assert.equal(today.dueDate.toISOString(), "2026-11-27T12:00:00.000Z");
  assert.equal(parseDueDateChange({ dueDate: "2026-12-15", reason: "  Nova data   combinada por telefone " }, now).reason, "Nova data combinada por telefone");
});

test("recusa passado, data inválida, longe demais, sem motivo ou campos extras", () => {
  assert.throws(() => parseDueDateChange({ dueDate: "2026-11-26", reason: "Combinado com o cliente" }, now), /passado/);
  assert.throws(() => parseDueDateChange({ dueDate: "2026-02-30", reason: "Combinado com o cliente" }, now), /inválida/);
  assert.throws(() => parseDueDateChange({ dueDate: "2027-06-30", reason: "Combinado com o cliente" }, now), /180 dias/);
  assert.throws(() => parseDueDateChange({ dueDate: "2026-12-15", reason: "curto" }, now), /motivo/);
  assert.throws(() => parseDueDateChange({ dueDate: "2026-12-15", reason: "Combinado com o cliente", amount: 1 }, now), /não permitidos/);
});

test("rota: só José ou Suzi, trava boleto emitido e grava histórico", () => {
  const source = readFileSync(join(__dirname, "sales-orders.controller.ts"), "utf8");
  const start = source.indexOf('@Patch(":id/due-date")');
  assert.ok(start > 0);
  const body = source.slice(start, source.indexOf("@Post()", start));
  assert.match(body, /isDesignatedTermCreditApprover/);
  assert.match(body, /ReceivableBoleto/);
  assert.match(body, /SalesOrderEditAudit/);
  assert.match(body, /FOR UPDATE/);
  assert.doesNotMatch(body, /SET[^`]*(amount|"openAmount")\s*=/);
});
