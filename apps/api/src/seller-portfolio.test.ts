import assert from "node:assert/strict";
import test from "node:test";
import { buildPortfolio, classifyCustomer, portfolioAlerts, whatsappNumber, type PortfolioCustomerRow } from "./seller-portfolio";

const now = new Date("2026-11-27T15:00:00Z");
const base: PortfolioCustomerRow = {
  id: "c", name: "Cliente", phone: "(43) 99999-0000", creditStatus: "APPROVED", paymentTerms: "14 dias",
  createdAt: "2026-09-01T12:00:00Z", orderDates: [], revenue90: 0, lastOrderAmount: null,
  overdueAmount: 0, overdueSince: null, lastVisitAt: null,
};

test("situação: cobrança vem antes de tudo", () => {
  assert.equal(classifyCustomer({ ...base, orderDates: ["2026-11-18T12:00:00Z"], overdueAmount: 720 }, now).status, "COBRANCA");
});

test("situação: cliente novo só depois de 3 dias sem pedido", () => {
  assert.equal(classifyCustomer({ ...base, createdAt: "2026-11-26T12:00:00Z" }, now).status, "EM_DIA");
  assert.equal(classifyCustomer({ ...base, createdAt: "2026-11-20T12:00:00Z" }, now).status, "NOVO");
});

test("situação: 1 pedido esfria com 21+ dias e avisa recompra a partir de 18", () => {
  assert.equal(classifyCustomer({ ...base, orderDates: ["2026-11-03T12:00:00Z"] }, now).status, "ESFRIANDO");
  assert.equal(classifyCustomer({ ...base, orderDates: ["2026-11-08T12:00:00Z"] }, now).status, "RECOMPRA");
  assert.equal(classifyCustomer({ ...base, orderDates: ["2026-11-18T12:00:00Z"] }, now).status, "EM_DIA");
});

test("situação: com 3+ pedidos usa o ritmo do cliente", () => {
  const every10 = ["2026-10-28T12:00:00Z", "2026-11-07T12:00:00Z", "2026-11-17T12:00:00Z"];
  const info = classifyCustomer({ ...base, orderDates: every10 }, now);
  assert.equal(info.rhythm, 10);
  assert.equal(info.status, "RECOMPRA");
  assert.equal(classifyCustomer({ ...base, orderDates: ["2026-10-08T12:00:00Z", "2026-10-18T12:00:00Z", "2026-10-28T12:00:00Z"] }, now).status, "ESFRIANDO");
});

test("carteira: tarefas por prioridade, resumo e avisos sem cobrança", () => {
  const p = buildPortfolio([
    { ...base, id: "a", name: "Em Dia", orderDates: ["2026-11-23T12:00:00Z"], revenue90: 5020 },
    { ...base, id: "b", name: "Devendo", orderDates: ["2026-11-18T12:00:00Z"], revenue90: 720, overdueAmount: 720, overdueSince: "2026-11-25T12:00:00Z" },
    { ...base, id: "c", name: "Novo", createdAt: "2026-11-20T12:00:00Z" },
    { ...base, id: "d", name: "Frio", orderDates: ["2026-11-03T12:00:00Z"], revenue90: 208, lastOrderAmount: 208 },
  ], now);
  assert.deepEqual(p.tasks.map((t) => t.status), ["COBRANCA", "NOVO", "ESFRIANDO"]);
  assert.match(p.tasks[0]!.title, /Devendo · R\$\s?720 vencido/);
  assert.equal(p.summary.revenue90, 5948);
  assert.equal(p.summary.buyers90, 3);
  assert.equal(p.summary.withoutVisit, 4);
  assert.deepEqual(portfolioAlerts(p).map((a) => a.type), ["SALES_PORTFOLIO_NOVO:c", "SALES_PORTFOLIO_ESFRIANDO:d"]);
});

test("número de WhatsApp", () => {
  assert.equal(whatsappNumber("(43) 99999-0000"), "5543999990000");
  assert.equal(whatsappNumber("+55 43 99999-0000"), "5543999990000");
  assert.equal(whatsappNumber("123"), null);
});
