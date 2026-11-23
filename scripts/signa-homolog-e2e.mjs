#!/usr/bin/env node
// Signa portal — authenticated end-to-end checks against an ISOLATED API
// (local or the homologation services on Render) seeded by
// packages/database/prisma/seed-signa-homolog.mjs.
//   SIGNA_E2E_API=http://127.0.0.1:3101/api SIGNA_E2E_PASSWORD=... node scripts/signa-homolog-e2e.mjs
// Refuses the RC1/production hosts. Creates only fictitious data.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const api = (process.env.SIGNA_E2E_API ?? "").replace(/\/$/, "");
const password = process.env.SIGNA_E2E_PASSWORD ?? "";
if (!api || !password) { console.error("Defina SIGNA_E2E_API e SIGNA_E2E_PASSWORD."); process.exit(2); }
// Deny by default: a production alias/custom domain must never be accepted.
let endpoint;
try { endpoint = new URL(api); } catch { console.error("Recusado: URL inválida."); process.exit(2); }
const local = ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname) && ["http:", "https:"].includes(endpoint.protocol);
const renderHomolog = endpoint.origin === "https://bbos-api-homolog-8w8f.onrender.com";
if ((!local && !renderHomolog) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !["", "/", "/api"].includes(endpoint.pathname)) {
  console.error("Recusado: use exclusivamente a API isolada de homologação ou loopback."); process.exit(2);
}

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
const signa = client(await login("signa@homolog.test"));
const other = client(await login("outro@homolog.test"));
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
  assert.ok(found, "não listado"); assert.equal(found.postalCode, "86010010"); assert.equal(found.city, "Londrina");
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
  const staleDelete = await signa(`/order-drafts/${draft.id}`, { method: "DELETE", body: { version: draft.version } });
  assert.equal(staleDelete.status, 409, `DELETE versão antiga HTTP ${staleDelete.status}`);
  const foreignDelete = await other(`/order-drafts/${draft.id}`, { method: "DELETE", body: { version: updated.json.version } });
  assert.ok([403, 404, 409].includes(foreignDelete.status), `DELETE outro parceiro HTTP ${foreignDelete.status}`);
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
  const fixture = "/orders/homolog-order-pix/pix";
  const first = await signa(fixture);
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
  const foreign = await other(fixture);
  assert.ok([403, 404].includes(foreign.status), "Pix de outro parceiro acessível");
  const id = order?.id ?? order?.order?.id;
  assert.ok(id, "pedido de homologação ausente");
  const noTitle = await signa(`/orders/${id}/pix`);
  assert.equal(noTitle.status, 400, "Pix liberado sem título");
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações aprovadas.`);
process.exitCode = failed.length ? 1 : 0;
