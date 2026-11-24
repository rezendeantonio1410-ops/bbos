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
    return "1 título, 1 pagamento, 1 movimento; quitação visível somente à Signa";
  });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações aprovadas.`);
process.exitCode = failed.length ? 1 : 0;
