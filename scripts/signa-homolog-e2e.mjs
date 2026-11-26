#!/usr/bin/env node
// Signa portal — authenticated end-to-end checks against an ISOLATED API
// (local or the homologation services on Render) seeded by
// packages/database/prisma/seed-signa-homolog.mjs.
//   SIGNA_E2E_API=http://127.0.0.1:3101/api SIGNA_E2E_PASSWORD=... node scripts/signa-homolog-e2e.mjs
// Refuses the RC1/production hosts. Creates only fictitious data.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Remote tests require the exact RC2 origin from the reviewed Render service.
// Example: SIGNA_E2E_RENDER_ORIGIN=https://bbos-api-signa-rc2-XXXX.onrender.com
// SIGNA_E2E_API must be that origin plus /api. Never use production or RC1.
function classifyTarget(api, expectedOrigin) {
  const local = /^(?:http|https):\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::([0-9]{1,5}))?\/api\/?$/.exec(api);
  if (local && (!local[1] || (Number(local[1]) > 0 && Number(local[1]) <= 65535))) return "local";
  if (/^https:\/\/bbos-api-signa-rc2-[a-z0-9]+\.onrender\.com$/.test(expectedOrigin) &&
      (api === expectedOrigin + "/api" || api === expectedOrigin + "/api/")) return "render";
  return null;
}
function target(api, expectedOrigin) {
  if (/\s/.test(api) || /\s/.test(expectedOrigin)) return null;
  return classifyTarget(api, expectedOrigin);
}

if (process.argv.includes("--test-target-guard")) {
  const cases = [
  [
    "http://127.0.0.1:3101/api",
    "",
    "local"
  ],
  [
    "http://localhost:3101/api/",
    "",
    "local"
  ],
  [
    "http://[::1]:3101/api",
    "",
    "local"
  ],
  [
    "https://bbos-api-signa-rc2-test123.onrender.com/api",
    "https://bbos-api-signa-rc2-test123.onrender.com",
    "render"
  ],
  [
    "https://bbos-api-signa-rc2-test123.onrender.com/api/",
    "https://bbos-api-signa-rc2-test123.onrender.com",
    "render"
  ],
  [
    "https://bbos-api-signa-rc2-test123.onrender.com/api",
    "",
    null
  ],
  [
    "https://bbos-api-signa-rc2-other.onrender.com/api",
    "https://bbos-api-signa-rc2-test123.onrender.com",
    null
  ],
  [
    "https://bbos-api-homolog-8w8f.onrender.com/api",
    "https://bbos-api-signa-rc2-test123.onrender.com",
    null
  ],
  [
    "https://bbos-api-rc1.onrender.com/api",
    "https://bbos-api-rc1.onrender.com",
    null
  ],
  [
    "https://api.bispocoffees.com.br/api",
    "https://api.bispocoffees.com.br",
    null
  ],
  [
    "https://bbos-api-signa-rc2-test123.onrender.com/api?x=1",
    "https://bbos-api-signa-rc2-test123.onrender.com",
    null
  ],
  [
    "https://bbos-api-signa-rc2-test123.onrender.com/api#fragment",
    "https://bbos-api-signa-rc2-test123.onrender.com",
    null
  ],
  [
    "https://bbos-api-signa-rc2-test123.onrender.com:443/api",
    "https://bbos-api-signa-rc2-test123.onrender.com",
    null
  ],
  [
    "http://bbos-api-signa-rc2-test123.onrender.com/api",
    "https://bbos-api-signa-rc2-test123.onrender.com",
    null
  ],
  [
    "https://user@bbos-api-signa-rc2-test123.onrender.com/api",
    "https://bbos-api-signa-rc2-test123.onrender.com",
    null
  ],
  [
    "https://bbos-api-signa-rc2-test123.onrender.com.evil.example/api",
    "https://bbos-api-signa-rc2-test123.onrender.com",
    null
  ],
  [
    "https://bbos-api-signa-rc2-test123.onrender.com/api/../api",
    "https://bbos-api-signa-rc2-test123.onrender.com",
    null
  ],
  [
    "http://127.0.0.1:0/api",
    "",
    null
  ],
  [
    "http://localhost:65536/api",
    "",
    null
  ],
  [
    "http://127.0.0.1.evil.example/api",
    "",
    null
  ],
  [
    "https://bbos-api-signa-rc2-test123.onrender.com/api",
    "https://bbos-api-signa-rc2-test123.onrender.com/",
    null
  ],
  [
    "https://bbos-api-signa-rc2-test123.onrender.com/",
    "https://bbos-api-signa-rc2-test123.onrender.com",
    null
  ],
  [
    "http://localhost:3101/api\n",
    "",
    null
  ]
];
  for (const [api, expectedOrigin, expected] of cases) assert.equal(target(api, expectedOrigin), expected, api);
  console.log(`PASS ${cases.length}/${cases.length} target guard cases (no network)`);
  process.exit(0);
}

const rawApi = process.env.SIGNA_E2E_API ?? "";
const password = process.env.SIGNA_E2E_PASSWORD ?? "";
if (!rawApi || !password) { console.error("Defina SIGNA_E2E_API e SIGNA_E2E_PASSWORD."); process.exit(2); }
const kind = target(rawApi, process.env.SIGNA_E2E_RENDER_ORIGIN ?? "");
if (!kind) { console.error("Recusado: use loopback ou a origem RC2 exata aprovada no Render, com /api."); process.exit(2); }
const local = kind === "local";
const api = rawApi.replace(/\/$/, "");

const results = [];
async function check(name, fn) {
  try { const detail = await fn(); results.push({ name, ok: true, detail }); console.log(`PASS ${name}${detail ? ` — ${detail}` : ""}`); }
  catch (error) { results.push({ name, ok: false, detail: error.message }); console.log(`FAIL ${name} — ${error.message}`); }
}

async function login(email) {
  const response = await fetch(`${api}/auth/login`, { method: "POST", redirect: "error", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  assert.equal(response.status, 201, `login ${email}: HTTP ${response.status}`);
  const cookie = (response.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  assert.ok(cookie, "sem cookie de sessão");
  return cookie;
}
function client(cookie) {
  return async (path, { method = "GET", body } = {}) => {
    const response = await fetch(`${api}/partner-portal${path}`, {
      method, redirect: "error", headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: response.status, json, headers: response.headers };
  };
}
function cnpj(seed) {
  let base = String(seed).padStart(8, "0").slice(-8) + "0001";
  for (const weights of [[5,4,3,2,9,8,7,6,5,4,3,2],[6,5,4,3,2,9,8,7,6,5,4,3,2]]) {
    const rest = base.split("").reduce((a, d, i) => a + Number(d) * weights[i], 0) % 11;
    base += rest < 2 ? 0 : 11 - rest;
  }
  return base;
}
function readyDate(daysAhead = 12) {
  const date = new Date(Date.now() + daysAhead * 86400000);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

const run = Date.now() % 100000000;
const signaCookie = await login("signa@homolog.test");
const otherCookie = await login("outro@homolog.test");
const signa = client(signaCookie);
const other = client(otherCookie);
// Fail closed BEFORE any fictitious customer, draft or order is written.
async function assertFixture(client, cookie, expectedPartnerId, expectedUserId) {
  const response = await fetch(`${api}/auth/me`, { redirect: "error", headers: { cookie } });
  assert.equal(response.status, 200, "Não foi possível validar a sessão de homologação");
  const session = await response.json();
  assert.equal(session?.user?.id === expectedUserId, true, "Recusado: usuário não é a fixture esperada");
  assert.equal(session?.user?.companyId === "homolog-co", true, "Recusado: empresa não é a fixture de homologação");
  assert.equal(session?.user?.role, "PARTNER");
  const result = await client("/summary");
  assert.equal(result.status, 200, "Não foi possível validar a identidade de homologação");
  assert.equal(result.json?.partner?.id === expectedPartnerId, true, "Recusado: parceiro não é a fixture esperada");
  assert.equal(result.json?.partner?.portalAccessLevel, "DISTRIBUTOR");
}
await assertFixture(signa, signaCookie, "homolog-partner-signa", "homolog-user-signa");
await assertFixture(other, otherCookie, "homolog-partner-other", "homolog-user-other");
console.log("PASS identidade das duas fixtures isoladas confirmada antes de qualquer gravação");

let options, recipients, endCustomer, draft, order;

await check("sem sessão é recusado", async () => {
  const response = await fetch(`${api}/partner-portal/summary`, { redirect: "error" });
  assert.ok([401, 403].includes(response.status), `HTTP ${response.status}`);
  return `HTTP ${response.status}`;
});
await check("catálogo exclusivo Signa com 12 SKUs e preços Reserva", async () => {
  const r = await signa("/order-options"); assert.equal(r.status, 200, JSON.stringify(r.json));
  options = r.json;
  const products = options.products ?? options.variants ?? [];
  assert.equal(products.length, 12, `recebidos ${products.length}`);
  const reserva = products.filter((p) => /RAR-WLR/.test(p.sku ?? "")).map((p) => Number(p.catalogPrice ?? p.unitPrice ?? p.price)).sort((a, b) => a - b);
  assert.deepEqual(reserva, [38, 76.8, 148]);
  return `${products.length} produtos`;
});
await check("outro distribuidor não vê nomes nem preços exclusivos da Signa", async () => {
  const r = await other("/order-options"); assert.equal(r.status, 200);
  const products = r.json.products ?? r.json.variants ?? [];
  const signaPrices = new Map((options.products ?? options.variants ?? []).map((p) => [p.productVariantId ?? p.id, Number(p.catalogPrice)]));
  assert.equal(products.some((p) => p.catalogPrice !== undefined && p.line === "Reserva"), false, "nomes/preços do catálogo Signa visíveis");
  assert.equal((r.json.customers ?? []).some((c) => /signa/i.test(c.name ?? "")), false, "cliente de preço Signa visível");
  assert.equal(JSON.stringify(r.json).includes("Rodrigo"), false, "destinatário fiscal Signa visível");
  return `${products.length} produtos da tabela geral de distribuidores; preços Signa ${signaPrices.size}`;
});
await check("destinatários fiscais Signa: CNPJ e CPF", async () => {
  const r = await signa("/billing-recipients"); assert.equal(r.status, 200);
  recipients = r.json.recipients; assert.equal(r.json.enabled, true);
  assert.deepEqual(recipients.map((x) => x.documentType).sort(), ["CNPJ", "CPF"]);
  const o = await other("/billing-recipients"); assert.equal(o.json.enabled, false);
  return recipients.map((x) => x.name).join(", ");
});

const taxId = cnpj(run);
const address = { postalCode: "86010010", street: "Rua Homologação", number: "100", district: "Centro", complement: "", city: "Londrina", state: "PR" };
await check("cadastro comercial com CNPJ e CEP grava no banco", async () => {
  const r = await signa("/end-customers", { method: "POST", body: { name: `Cafeteria Teste ${run}`, taxId, ...address, email: "", phone: "", notes: "" } });
  assert.ok([200, 201].includes(r.status), `HTTP ${r.status} ${JSON.stringify(r.json)}`);
  endCustomer = r.json;
  const list = await signa("/end-customers");
  const found = (list.json.customers ?? []).find((c) => c.id === endCustomer.id);
  assert.ok(found, "não listado");
  assert.equal(found.name, `Cafeteria Teste ${run}`);
  assert.equal(found.taxId, taxId);
  for (const [field, value] of Object.entries(address)) {
    if (field !== "complement") assert.equal(found[field], value, `campo comercial ${field} não persistido`);
  }
  return endCustomer.id;
});
await check("CNPJ inválido é recusado", async () => {
  const r = await signa("/end-customers", { method: "POST", body: { name: "Inválido", taxId: "11111111111111", ...address } });
  assert.equal(r.status, 400, `HTTP ${r.status}`);
});
await check("CNPJ duplicado (com pontuação) retorna 409", async () => {
  const formatted = taxId.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  const r = await signa("/end-customers", { method: "POST", body: { name: "Duplicado", taxId: formatted, ...address } });
  assert.equal(r.status, 409, `HTTP ${r.status}`);
});
await check("5 cadastros simultâneos do mesmo CNPJ → 1 gravado", async () => {
  const concurrent = cnpj(run + 1);
  const responses = await Promise.all(Array.from({ length: 5 }, (_, i) =>
    signa("/end-customers", { method: "POST", body: { name: `Concorrente ${i}`, taxId: concurrent, ...address } })));
  const statuses = responses.map((r) => r.status).sort();
  assert.equal(statuses.filter((s) => s === 200 || s === 201).length, 1, statuses.join(","));
  assert.equal(statuses.filter((s) => s === 409).length, 4, statuses.join(","));
  return statuses.join(",");
});
await check("edição parcial preserva campos obrigatórios", async () => {
  const r = await signa(`/end-customers/${endCustomer.id}`, { method: "PATCH", body: { complement: "Sala 2" } });
  assert.equal(r.status, 200, `HTTP ${r.status} ${JSON.stringify(r.json)}`);
  assert.equal(r.json.complement, "Sala 2"); assert.equal(r.json.street, "Rua Homologação"); assert.equal(r.json.taxId, taxId);
  const freshCookie = await login("signa@homolog.test");
  const fresh = client(freshCookie);
  await assertFixture(fresh, freshCookie, "homolog-partner-signa", "homolog-user-signa");
  const reopened = await fresh("/end-customers");
  assert.equal(reopened.status, 200);
  const saved = reopened.json.customers.find((item) => item.id === endCustomer.id);
  assert.ok(saved, "cliente ausente em nova sessão");
  assert.equal(saved.complement, "Sala 2");
  assert.equal(saved.taxId, taxId);
  assert.equal(saved.name, `Cafeteria Teste ${run}`);
  for (const [field, value] of Object.entries(address)) {
    if (field !== "complement") assert.equal(saved[field], value, `edição alterou ${field}`);
  }
});
await check("outro distribuidor não lê nem edita o cliente Signa", async () => {
  const list = await other("/end-customers");
  assert.equal((list.json.customers ?? []).some((c) => c.id === endCustomer.id), false);
  const r = await other(`/end-customers/${endCustomer.id}`, { method: "PATCH", body: { street: "Invasão" } });
  assert.ok([403, 404].includes(r.status), `HTTP ${r.status}`);
  return `PATCH HTTP ${r.status}`;
});

const products = () => (options.products ?? options.variants ?? []);
const pricingCustomerId = () => options.customers?.[0]?.id ?? recipients.find((x) => x.documentType === "CNPJ").id;
const items = () => products().slice(0, 2).map((p, i) => ({ productVariantId: p.productVariantId ?? p.id, quantity: i + 1 }));
await check("rascunho na conta: criar, versão otimista e privacidade", async () => {
  const payload = { customerId: pricingCustomerId(), partnerEndCustomerId: endCustomer.id, items: items(), deliveryMode: "PICKUP", notes: "rascunho homolog" };
  const created = await signa("/order-drafts", { method: "POST", body: { payload } });
  assert.ok([200, 201].includes(created.status), `HTTP ${created.status} ${JSON.stringify(created.json)}`);
  draft = created.json;
  const list = await signa("/order-drafts");
  assert.match(list.headers.get("cache-control") ?? "", /no-store/);
  const updated = await signa(`/order-drafts/${draft.id}`, { method: "PATCH", body: { version: draft.version, payload: { ...payload, notes: "v2" } } });
  assert.equal(updated.status, 200, `HTTP ${updated.status}`);
  const stale = await signa(`/order-drafts/${draft.id}`, { method: "PATCH", body: { version: draft.version, payload } });
  assert.equal(stale.status, 409, `versão antiga HTTP ${stale.status}`);
  const foreign = await other(`/order-drafts/${draft.id}`);
  assert.ok([403, 404].includes(foreign.status), `outro parceiro HTTP ${foreign.status}`);
  const foreignPatch = await other(`/order-drafts/${draft.id}`, { method: "PATCH", body: { version: updated.json.version, payload: { ...payload, notes: "Alteração indevida CI" } } });
  assert.ok([403, 404, 409].includes(foreignPatch.status), `PATCH outro parceiro HTTP ${foreignPatch.status}`);
  const staleDelete = await signa(`/order-drafts/${draft.id}`, { method: "DELETE", body: { version: draft.version } });
  assert.equal(staleDelete.status, 409, `DELETE versão antiga HTTP ${staleDelete.status}`);
  const foreignDelete = await other(`/order-drafts/${draft.id}`, { method: "DELETE", body: { version: updated.json.version } });
  assert.ok([403, 404, 409].includes(foreignDelete.status), `DELETE outro parceiro HTTP ${foreignDelete.status}`);
  const preserved = await signa(`/order-drafts/${draft.id}`);
  assert.equal(preserved.status, 200);
  assert.equal(preserved.json.version, updated.json.version, "tentativa rejeitada não pode incrementar a versão");
  assert.deepEqual(preserved.json.payload, updated.json.payload, "tentativa rejeitada não pode alterar o conteúdo");
  const removed = await signa(`/order-drafts/${draft.id}`, { method: "DELETE", body: { version: updated.json.version } });
  assert.ok([200, 204].includes(removed.status), `DELETE HTTP ${removed.status}`);
  return `versão ${updated.json.version}`;
});

const orderBody = () => ({
  partnerEndCustomerId: endCustomer.id, customerId: pricingCustomerId(),
  billingRecipientId: recipients.find((x) => x.documentType === "CNPJ").id,
  items: items(), deliveryMode: "PICKUP", carrierName: "", paymentType: "CASH",
  expectedDeliveryDate: readyDate(), customerReference: `HOMOLOG-${run}`, notes: "Pedido de homologação",
});
await check("pedido idempotente: envio, repetição e conteúdo divergente", async () => {
  const key = randomUUID();
  const body = orderBody();
  const first = await signa("/orders", { method: "POST", body: { ...body, submissionKey: key } });
  assert.ok([200, 201].includes(first.status), `HTTP ${first.status} ${JSON.stringify(first.json)}`);
  order = first.json;
  const id = order.id ?? order.order?.id;
  const replay = await signa("/orders", { method: "POST", body: { ...body, submissionKey: key } });
  assert.ok([200, 201].includes(replay.status), `replay HTTP ${replay.status}`);
  assert.equal(replay.json.id ?? replay.json.order?.id, id); assert.equal(replay.json.replayed, true);
  const divergent = await signa("/orders", { method: "POST", body: { ...body, notes: "outro conteúdo", submissionKey: key } });
  assert.equal(divergent.status, 409, `divergente HTTP ${divergent.status}`);
  return `pedido ${order.orderNumber ?? order.code ?? id}`;
});
await check("10 envios simultâneos com a mesma chave → 1 pedido", async () => {
  const key = randomUUID();
  const body = { ...orderBody(), customerReference: `HOMOLOG-CONC-${run}` };
  const responses = await Promise.all(Array.from({ length: 10 }, () => signa("/orders", { method: "POST", body: { ...body, submissionKey: key } })));
  const ids = new Set(responses.filter((r) => r.status < 300).map((r) => r.json.id ?? r.json.order?.id));
  const statuses = responses.map((r) => r.status);
  assert.equal(ids.size, 1, `ids distintos: ${ids.size}; status ${statuses.join(",")}`);
  assert.ok(statuses.every((s) => s < 300 || s === 409), statuses.join(","));
  return statuses.join(",");
});
await check("outro distribuidor não cria pedido com cliente Signa", async () => {
  const r = await other("/orders", { method: "POST", body: { ...orderBody(), submissionKey: randomUUID() } });
  assert.ok([400, 403, 404].includes(r.status), `HTTP ${r.status}`);
  return `HTTP ${r.status}`;
});
// A competing request with different contents must never be accepted or
// overwrite the committed order. Exercise only against disposable CI fixtures.
if (local && process.env.CI === "true") {
  await check("mesma chave com payloads divergentes em concorrência: um vencedor e um conflito", async () => {
    assert.ok(results.every((r) => r.ok), "pré-condições falharam");
    const submissionKey = randomUUID();
    const common = { ...orderBody(), submissionKey, customerReference: `HOMOLOG-MIXED-${run}` };
    const bodies = ["A", "B"].map((suffix) => ({ ...common, notes: `Concorrência fictícia ${suffix}` }));
    const attempts = await Promise.all(bodies.map((body) => signa("/orders", { method: "POST", body })));
    const accepted = attempts.map((r, i) => ({ r, i })).filter(({ r }) => [200, 201].includes(r.status));
    assert.equal(accepted.length, 1, "exatamente um payload deve ser aceito");
    const { r: winner, i } = accepted[0];
    assert.equal(attempts[1 - i].status, 409);
    const id = winner.json.id ?? winner.json.order?.id;
    assert.ok(id);
    const repeat = await signa("/orders", { method: "POST", body: bodies[i] });
    assert.ok([200, 201].includes(repeat.status));
    assert.equal(repeat.json.id ?? repeat.json.order?.id, id);
    assert.equal(repeat.json.replayed, true);
    const conflict = await signa("/orders", { method: "POST", body: bodies[1 - i] });
    assert.equal(conflict.status, 409);
    const detail = await signa(`/orders/${id}/detail`);
    assert.equal(detail.status, 200);
    return "1 aceito, 1 conflito; replay do vencedor preserva ID";
  });
}

// Fiscal selection and DANFE access only on the disposable CI API.
if (local && process.env.CI === "true") {
  await check("destinatário fiscal CNPJ/CPF separado do cliente comercial; DANFE indisponível sem autorização", async () => {
    assert.ok(results.every((r) => r.ok), "pré-condições falharam");
    const corporate = recipients.find((x) => x.documentType === "CNPJ");
    const personal = recipients.find((x) => x.documentType === "CPF");
    assert.ok(corporate && personal && corporate.id !== personal.id);
    const originalId = order?.id ?? order?.order?.id;
    assert.ok(originalId);
    const invalid = await signa("/orders", { method: "POST", body: {
      ...orderBody(), billingRecipientId: endCustomer.id, submissionKey: randomUUID(),
      customerReference: `HOMOLOG-FISCAL-INVALID-${run}`,
    } });
    assert.equal(invalid.status, 400, "cliente comercial não pode ser destinatário fiscal");
    const cpf = await signa("/orders", { method: "POST", body: {
      ...orderBody(), billingRecipientId: personal.id, submissionKey: randomUUID(),
      customerReference: `HOMOLOG-FISCAL-CPF-${run}`,
    } });
    assert.ok([200, 201].includes(cpf.status), `pedido CPF HTTP ${cpf.status}`);
    const cpfId = cpf.json.id ?? cpf.json.order?.id;
    assert.ok(cpfId && cpfId !== originalId);
    const summary = await signa("/summary");
    assert.equal(summary.status, 200);
    const cnpjRow = summary.json.partnerOrders.find((x) => x.id === originalId);
    const cpfRow = summary.json.partnerOrders.find((x) => x.id === cpfId);
    assert.ok(cnpjRow && cpfRow);
    assert.equal(cnpjRow.billingRecipientName, corporate.name);
    assert.equal(cpfRow.billingRecipientName, personal.name);
    for (const row of [cnpjRow, cpfRow]) {
      assert.equal(row.endCustomerName, endCustomer.name);
      assert.equal(row.invoiceStatus, null, "pedido não deve emitir NF-e automaticamente");
      assert.notEqual(row.invoicePdfAvailable, true);
      const invoice = await signa(`/orders/${row.id}/invoice/pdf`);
      assert.equal(invoice.status, 404, "DANFE sem autorização deve ficar indisponível");
      const foreignInvoice = await other(`/orders/${row.id}/invoice/pdf`);
      assert.ok([403, 404].includes(foreignInvoice.status));
      const foreignDetail = await other(`/orders/${row.id}/detail`);
      assert.ok([403, 404].includes(foreignDetail.status));
    }
    const a = await signa(`/orders/${originalId}/detail`);
    const b = await signa(`/orders/${cpfId}/detail`);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const priceSnapshot = (r) => r.json.items.map((x) => [x.sku, Number(x.quantity), Number(x.unitPrice), Number(x.totalAmount)]).sort((x,y) => String(x[0]).localeCompare(String(y[0])));
    assert.ok(a.json.items.length > 0);
    assert.deepEqual(priceSnapshot(a), priceSnapshot(b), "escolha fiscal não pode alterar preço exclusivo");
    assert.equal(Number(cnpjRow.totalAmount), Number(cpfRow.totalAmount));
    const commercial = await signa("/end-customers");
    assert.equal(commercial.status, 200);
    const saved = commercial.json.customers.find((x) => x.id === endCustomer.id);
    assert.ok(saved);
    assert.equal(saved.taxId, taxId);
    assert.equal(saved.name, endCustomer.name);
    return "CNPJ/CPF separados; preço preservado; DANFE não autorizado bloqueado";
  });
}

await check("painel, histórico e relatórios carregam", async () => {
  for (const path of ["/summary", "/end-customer-history", "/commercial-reports"]) {
    const r = await signa(path); assert.equal(r.status, 200, `${path} HTTP ${r.status}`);
  }
});

await check("pedido novo não simula pagamento e não aparece no financeiro de outro parceiro", async () => {
  const id = order?.id ?? order?.order?.id;
  assert.ok(id, "pedido de homologação ausente");
  const own = await signa("/summary");
  assert.equal(own.status, 200);
  assert.ok(Array.isArray(own.json.partnerOrders));
  const row = own.json.partnerOrders.find((x) => x.id === id);
  assert.ok(row, "pedido não visível ao parceiro de origem");
  for (const field of ["receivableStatus", "receivableAmount", "openAmount", "paymentDate", "dueDate"]) {
    assert.equal(row[field], null, `campo financeiro ${field} indevidamente preenchido`);
  }
  assert.notEqual(row.billingAvailable, true, "cobrança sem título autorizada");
  const foreign = await other("/summary");
  assert.equal(foreign.status, 200);
  assert.ok(Array.isArray(foreign.json.partnerOrders));
  assert.equal(foreign.json.partnerOrders.some((x) => x.id === id), false, "pedido de outro parceiro exposto");
});

await check("Pix de título existente: leitura repetida, acesso privado e ausência de baixa", async () => {
  // Fixed seed fixture in the isolated database only. Do not log QR/copyPaste:
  // the current static Pix key belongs to Bispo and must never be paid in tests.
  // Only GitHub Actions loopback may exercise its payload; Render must deny it.
  const fixture = "/orders/homolog-order-pix/pix";
  const readTitle = async () => {
    const summary = await signa("/summary");
    assert.equal(summary.status, 200);
    const row = summary.json.partnerOrders.find((item) => item.id === "homolog-order-pix");
    assert.ok(row, "Título fictício ausente no financeiro");
    return { status: row.receivableStatus, amount: Number(row.receivableAmount), open: Number(row.openAmount), paidAt: row.paymentDate, due: row.dueDate };
  };
  const titleBefore = await readTitle();
  assert.equal(titleBefore.status, "OPEN");
  assert.equal(titleBefore.amount, 76.8);
  assert.equal(titleBefore.open, 76.8);
  assert.equal(titleBefore.paidAt, null);
  const first = await signa(fixture);
  const ciStaticPix = local && process.env.GITHUB_ACTIONS === "true" && !process.env.RENDER;
  if (ciStaticPix) {
    assert.equal(first.status, 200, "Pix da fixture indisponível");
    assert.match(first.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(first.json.orderCode, "H-PIX-0001");
    assert.equal(first.json.amountCents, 7680);
    assert.equal(first.json.openCents, 7680);
    assert.match(first.json.dueDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(typeof first.json.copyPaste === "string" && first.json.copyPaste.startsWith("000201"), "BR Code ausente");
    assert.ok(typeof first.json.qrSvg === "string" && first.json.qrSvg.includes("<svg"), "QR ausente");
    const again = await signa(fixture);
    assert.equal(again.status, 200);
    assert.equal(again.json.openCents, 7680, "consulta alterou saldo");
    assert.equal(again.json.copyPaste === first.json.copyPaste, true, "consulta alterou BR Code");
  } else {
    // Outside disposable CI, a fictitious company must NEVER return a payable QR.
    assert.equal(first.status, 400, "Pix real não pode estar disponível na homologação");
    assert.match(String(first.json?.message ?? ""), /chave Pix desta empresa/i);
    assert.ok(!first.json?.copyPaste && !first.json?.qrSvg, "payload Pix indevido");
    const again = await signa(fixture);
    assert.equal(again.status, 400, "Pix habilitado indevidamente em nova consulta");
    assert.ok(!again.json?.copyPaste && !again.json?.qrSvg, "payload Pix indevido");
  }
  const foreign = await other(fixture);
  assert.ok([403, 404].includes(foreign.status), "Pix de outro parceiro acessível");
  const id = order?.id ?? order?.order?.id;
  assert.ok(id, "pedido de homologação ausente");
  const noTitle = await signa(`/orders/${id}/pix`);
  assert.equal(noTitle.status, 400, "Pix liberado sem título");
  assert.deepEqual(await readTitle(), titleBefore, "Consultas Pix não podem alterar o título financeiro");
});

// Financial mutation probes run ONLY in the local disposable CI database.
// Never send a settlement request to Render (even to homologation).
if (local && process.env.CI === "true") {
  await check("parceiro não pode acessar nem executar baixas financeiras internas", async () => {
    const snapshot = async () => {
      const r = await signa("/summary");
      assert.equal(r.status, 200);
      const row = r.json.partnerOrders.find((x) => x.id === "homolog-order-pix");
      assert.ok(row, "título fictício ausente");
      return { status: row.receivableStatus, amount: row.receivableAmount, open: row.openAmount, paidAt: row.paymentDate, due: row.dueDate };
    };
    const before = await snapshot();
    assert.equal(before.status, "OPEN");
    const probes = [
      ["GET", "/finance/receivables"],
      ["GET", "/finance/reconciliation/summary"],
      ["GET", "/sales-orders/homolog-order-pix/manual-pix"],
      ["POST", "/finance/receivables/homolog-ar-pix/payments", { financialAccountId: "homolog-denied-account", amount: 76.8, method: "PIX", idempotencyKey: randomUUID() }],
      ["POST", "/sales-orders/homolog-order-pix/manual-pix/confirm", { financialAccountId: "homolog-denied-account", reference: "DENIED-CI-ONLY" }],
      ["POST", "/finance/reconciliation-assisted/homolog-denied-item/settle", {}],
      ["POST", "/finance/reconciliation/safe-auto-match", { financialAccountId: "homolog-denied-account", mode: "APPLY" }],
    ];
    for (const cookie of [signaCookie, otherCookie]) {
      for (const [method, path, body] of probes) {
        const response = await fetch(`${api}${path}`, {
          method, redirect: "error",
          headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) },
          body: body ? JSON.stringify(body) : undefined,
        });
        assert.equal(response.status, 403, `${method} ${path}: acesso financeiro deve ser proibido`);
        await response.text();
      }
    }
    assert.deepEqual(await snapshot(), before, "tentativa de baixa alterou título fictício");
    return "14 acessos negados; título preservado";
  });
}


 // Positive receipt test: no bank, provider, or fiscal calls. Never run against
 // Render; use only the disposable CI database and verify the admin fixture.
if (local && process.env.CI === "true") {
  let receiptContext;
  await check("baixa administrativa fictícia: uma única baixa e reflexo no portal", async () => {
    assert.ok(results.every((r) => r.ok), "verificações anteriores falharam; baixa de teste cancelada");
    const adminCookie = await login("admin@homolog.test");
    const me = await fetch(`${api}/auth/me`, { redirect: "error", headers: { cookie: adminCookie } });
    assert.equal(me.status, 200);
    const session = await me.json();
    assert.equal(session?.user?.id === "homolog-user-admin", true);
    assert.equal(session?.user?.companyId === "homolog-co", true);
    assert.equal(session?.user?.role, "ADMIN");
    const internal = async (path, body) => {
      const response = await fetch(`${api}${path}`, {
        method: body === undefined ? "GET" : "POST", redirect: "error",
        headers: { cookie: adminCookie, ...(body === undefined ? {} : { "content-type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, json: await response.json() };
    };
    const titles = async () => {
      const r = await internal("/finance/receivables");
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.json));
      const matches = r.json.filter((x) => x.salesOrderId === "homolog-order-pix");
      assert.equal(matches.length, 1, "pedido deve ter exatamente um título");
      assert.equal(matches[0].id, "homolog-ar-pix");
      assert.equal(matches[0].companyId, "homolog-co");
      return matches[0];
    };
    const before = await titles();
    assert.equal(before.status, "OPEN");
    assert.equal(Number(before.openAmount), 76.8);
    assert.equal(before.payments.length, 0);
    const account = await internal("/finance/accounts", {
      name: `Conta fictícia CI ${randomUUID()}`, type: "OTHER", currency: "BRL", openingBalance: 0,
    });
    assert.ok([200, 201].includes(account.status), `conta HTTP ${account.status}`);
    assert.equal(account.json.companyId, "homolog-co");
    assert.ok(account.json.id);
    const paymentPath = "/finance/receivables/homolog-ar-pix/payments";
    const payload = { financialAccountId: account.json.id, amount: 76.8, method: "PIX",
      paidAt: new Date().toISOString(), idempotencyKey: randomUUID(), notes: "Simulação CI sem transferência bancária" };
    const first = await internal(paymentPath, payload);
    assert.ok([200, 201].includes(first.status), `baixa HTTP ${first.status}`);
    assert.equal(first.json.idempotent, false);
    assert.ok(first.json.payment?.id);
    const replay = await internal(paymentPath, payload);
    assert.ok([200, 201].includes(replay.status), `repetição HTTP ${replay.status}`);
    assert.equal(replay.json.idempotent, true);
    assert.equal(replay.json.payment?.id, first.json.payment.id);
    const extra = await internal(paymentPath, { ...payload, idempotencyKey: randomUUID() });
    assert.equal(extra.status, 400, "segunda baixa de título quitado deve ser recusada");
    const after = await titles();
    assert.equal(after.status, "PAID");
    assert.equal(Number(after.amount), 76.8);
    assert.equal(Number(after.openAmount), 0);
    assert.ok(after.paymentDate);
    assert.equal(after.payments.length, 1);
    assert.equal(after.payments[0].id, first.json.payment.id);
    const finance = await internal("/finance/summary");
    assert.equal(finance.status, 200);
    const movements = finance.json.transactions.filter((x) => x.financialAccountId === account.json.id);
    assert.equal(movements.length, 1);
    assert.equal(movements[0].paymentId, first.json.payment.id);
    assert.equal(movements[0].type, "RECEIPT");
    assert.equal(Number(movements[0].amount), 76.8);
    const own = await signa("/summary");
    assert.equal(own.status, 200);
    const row = own.json.partnerOrders.find((x) => x.id === "homolog-order-pix");
    assert.ok(row);
    assert.equal(row.receivableStatus, "PAID");
    assert.equal(Number(row.openAmount), 0);
    assert.equal(new Date(row.paymentDate).toISOString(), new Date(after.paymentDate).toISOString());
    assert.equal(row.pixAvailable, false);
    const foreign = await other("/summary");
    assert.equal(foreign.status, 200);
    assert.equal(foreign.json.partnerOrders.some((x) => x.id === "homolog-order-pix"), false);
    receiptContext = { internal, titles, accountId: account.json.id, movement: movements[0], paymentId: first.json.payment.id };
    return "1 título, 1 pagamento, 1 movimento; quitação visível somente à Signa";
  });

  await check("extrato CSV fictício: importação e conciliação de recebimento sem duplicidade", async () => {
    assert.ok(receiptContext, "baixa fictícia anterior não foi validada");
    const { internal, titles, accountId, movement, paymentId } = receiptContext;
    const before = await titles();
    assert.equal(before.status, "PAID");
    assert.equal(before.payments.length, 1);
    assert.ok(movement.id);
    const externalId = "CI-ONLY-" + randomUUID();
    const date = new Date(movement.occurredAt).toISOString().slice(0, 10);
    const statement = {
      financialAccountId: accountId, format: "CSV", fileName: "extrato-ficticio-ci.csv",
      content: ["data;descricao;valor;id", date + ";Recebimento fictício CI;76,80;" + externalId].join("\n"),
    };
    const imported = await internal("/finance/reconciliation/import", statement);
    assert.ok([200, 201].includes(imported.status), `importação HTTP ${imported.status}`);
    assert.equal(imported.json.imported, 1);
    assert.equal(imported.json.duplicates, 0);
    const reimported = await internal("/finance/reconciliation/import", statement);
    assert.ok([200, 201].includes(reimported.status));
    assert.equal(reimported.json.imported, 0);
    assert.equal(reimported.json.duplicates, 1);
    const bankPath = "/finance/reconciliation/bank-transactions?financialAccountId=" + encodeURIComponent(accountId);
    const bankBefore = await internal(bankPath);
    assert.equal(bankBefore.status, 200);
    assert.equal(bankBefore.json.length, 1);
    const bank = bankBefore.json[0];
    assert.equal(bank.externalId, externalId);
    assert.equal(bank.reconciliationStatus, "PENDING");
    assert.equal(bank.reconciliationItem.status, "PENDING");
    assert.equal(bank.reconciliationItem.financialTransactionId, null);
    const matchPath = "/finance/reconciliation/" + bank.reconciliationItem.id + "/match";
    const match = await internal(matchPath, { financialTransactionId: movement.id });
    assert.ok([200, 201].includes(match.status), `conciliação HTTP ${match.status}`);
    assert.equal(match.json.idempotent, false);
    assert.equal(match.json.item.status, "MATCHED");
    assert.equal(Number(match.json.item.matchedAmount), 76.8);
    assert.equal(Number(match.json.item.difference), 0);
    const repeated = await internal(matchPath, { financialTransactionId: movement.id });
    assert.ok([200, 201].includes(repeated.status));
    assert.equal(repeated.json.idempotent, true);
    const bankAfter = await internal(bankPath);
    assert.equal(bankAfter.status, 200);
    assert.equal(bankAfter.json.length, 1);
    assert.equal(bankAfter.json[0].reconciliationStatus, "MATCHED");
    assert.equal(bankAfter.json[0].reconciliationItem.financialTransactionId, movement.id);
    const reconciliation = await internal("/finance/reconciliation?financialAccountId=" + encodeURIComponent(accountId));
    assert.equal(reconciliation.status, 200);
    assert.equal(reconciliation.json.length, 1);
    assert.equal(reconciliation.json[0].events.filter((event) => event.action === "MATCHED").length, 1);
    const after = await titles();
    assert.equal(after.status, "PAID");
    assert.equal(Number(after.openAmount), 0);
    assert.equal(after.paymentDate, before.paymentDate);
    assert.equal(after.payments.length, 1);
    assert.equal(after.payments[0].id, paymentId);
    const finance = await internal("/finance/summary");
    assert.equal(finance.status, 200);
    const movements = finance.json.transactions.filter((x) => x.financialAccountId === accountId);
    assert.equal(movements.length, 1);
    assert.equal(movements[0].id, movement.id);
    const portal = await signa("/summary");
    assert.equal(portal.status, 200);
    const row = portal.json.partnerOrders.find((x) => x.id === "homolog-order-pix");
    assert.ok(row);
    assert.equal(row.receivableStatus, "PAID");
    assert.equal(Number(row.openAmount), 0);
    assert.equal(new Date(row.paymentDate).toISOString(), new Date(after.paymentDate).toISOString());
    assert.equal(row.pixAvailable, false);
    return "1 crédito, 1 conciliação, 1 evento MATCHED, 1 pagamento e 1 movimento financeiro";
  });
}

// Recover a server-side draft from a fresh session and prove that competing
// edits cannot overwrite the winning version. Disposable CI database only.
if (local && process.env.CI === "true") {
  await check("rascunho recuperado em nova sessão; duas edições simultâneas preservam a vencedora", async () => {
    assert.ok(results.every((r) => r.ok), "pré-condições falharam");
    const payload = {
      customerId: pricingCustomerId(), partnerEndCustomerId: endCustomer.id,
      billingRecipientId: recipients.find((x) => x.documentType === "CNPJ").id,
      items: items(), deliveryMode: "PICKUP", notes: "Recuperação fictícia CI",
    };
    const created = await signa("/order-drafts", { method: "POST", body: { payload } });
    assert.ok([200, 201].includes(created.status));
    const initial = created.json;
    assert.ok(initial.id);
    const path = "/order-drafts/" + encodeURIComponent(initial.id);
    const freshCookie = await login("signa@homolog.test");
    const fresh = client(freshCookie);
    await assertFixture(fresh, freshCookie, "homolog-partner-signa", "homolog-user-signa");
    const list = await fresh("/order-drafts");
    assert.equal(list.status, 200);
    assert.match(list.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(list.json.drafts.filter((x) => x.id === initial.id).length, 1);
    const recovered = await fresh(path);
    assert.equal(recovered.status, 200);
    assert.match(recovered.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(recovered.json.version, initial.version);
    assert.deepEqual(recovered.json.payload, initial.payload);
    assert.equal(recovered.json.payload.partnerEndCustomerId, payload.partnerEndCustomerId);
    assert.equal(recovered.json.payload.billingRecipientId, payload.billingRecipientId);
    assert.deepEqual(recovered.json.payload.items, payload.items);
    const edits = ["Edição concorrente A", "Edição concorrente B"];
    const attempts = await Promise.all(edits.map((notes) => fresh(path, {
      method: "PATCH", body: { version: initial.version, payload: { ...payload, notes } },
    })));
    assert.deepEqual(attempts.map((x) => x.status).sort((a, b) => a - b), [200, 409]);
    const winner = attempts.find((x) => x.status === 200).json;
    assert.equal(winner.version, initial.version + 1);
    assert.ok(edits.includes(winner.payload.notes));
    const persisted = await fresh(path);
    assert.equal(persisted.status, 200);
    assert.equal(persisted.json.version, winner.version);
    assert.deepEqual(persisted.json.payload, winner.payload);
    const foreignList = await other("/order-drafts");
    if (foreignList.status === 200) {
      assert.equal(foreignList.json.drafts.some((x) => x.id === initial.id), false);
    } else {
      assert.ok([403, 404].includes(foreignList.status));
    }
    const removed = await fresh(path, { method: "DELETE", body: { version: winner.version } });
    assert.ok([200, 204].includes(removed.status));
    assert.equal((await fresh(path)).status, 404);
    const finalList = await fresh("/order-drafts");
    assert.equal(finalList.status, 200);
    assert.equal(finalList.json.drafts.some((x) => x.id === initial.id), false);
    return "nova sessão recuperou o payload; 1 edição aceita, 1 conflito; exclusão confirmada";
  });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações aprovadas.`);
process.exitCode = failed.length ? 1 : 0;
