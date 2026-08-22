#!/usr/bin/env node

const baseUrl = (process.env.BBOS_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const apiBaseUrl = (process.env.BBOS_API_URL || "").replace(/\/$/, "");
const timeoutMs = Number(process.env.BBOS_SMOKE_TIMEOUT_MS || 12000);
const retryDelays = [0, 1000, 2000, 4000];
let cookie = "";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const elapsed = (startedAt) => `${Date.now() - startedAt} ms`;

function statusLabel(status) {
  if (status >= 200 && status < 300) return "PASS";
  return `FAIL (HTTP ${status})`;
}

async function request(path, options = {}, { retry = true, base = baseUrl } = {}) {
  let lastError;
  for (let attempt = 0; attempt < (retry ? retryDelays.length : 1); attempt += 1) {
    if (attempt) await sleep(retryDelays[attempt]);
    const startedAt = Date.now();
    const headers = new Headers(options.headers || {});
    if (cookie) headers.set("cookie", cookie);
    try {
      const response = await fetch(`${base}${path}`, {
        ...options,
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
      const setCookie = setCookies[0] || response.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
      if (retry && [502, 503, 504].includes(response.status) && attempt < retryDelays.length - 1) continue;
      return { response, duration: elapsed(startedAt) };
    } catch (error) {
      lastError = error;
      if (!retry || attempt === retryDelays.length - 1) break;
    }
  }
  return { error: lastError, duration: "timeout" };
}

function printResult(name, result) {
  const detail = result.detail ? ` — ${result.detail}` : "";
  console.log(`${name.padEnd(20, ".")} ${result.status}${detail}${result.duration ? ` (${result.duration})` : ""}`);
}

async function check(name, path, { authenticated = false, base = baseUrl } = {}) {
  const result = await request(path, {}, { base });
  if (result.error) {
    const message = result.error?.name === "TimeoutError" ? "timeout" : "indisponível";
    printResult(name, { status: "FAIL", detail: message, duration: result.duration });
    return false;
  }
  const { response, duration } = result;
  if (response.status === 401 || response.status === 403) {
    printResult(name, { status: authenticated ? "FAIL" : "SKIP", detail: authenticated ? "sessão recusada" : "sessão não configurada", duration });
    return !authenticated;
  }
  printResult(name, { status: statusLabel(response.status), duration });
  return response.ok;
}

async function main() {
  console.log("BBOS SMOKE TEST");
  console.log("────────────────────────");
  console.log(`Base URL: ${baseUrl}`);
  let passed = 0;
  let total = 0;
  const publicChecks = [
    ["Web", "/"],
    ["API Health", "/api/health"],
  ];
  for (const [name, path] of publicChecks) {
    total += 1;
    if (await check(name, path)) passed += 1;
  }
  if (apiBaseUrl) {
    total += 1;
    if (await check("API Health direct", "/api/health", { base: apiBaseUrl })) passed += 1;
  }

  const email = process.env.BBOS_SMOKE_EMAIL;
  const password = process.env.BBOS_SMOKE_PASSWORD;
  let authenticated = false;
  if (email && password) {
    total += 1;
    const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) }, { retry: false });
    if (login.error) printResult("Auth", { status: "FAIL", detail: "indisponível", duration: login.duration });
    else {
      authenticated = login.response.ok;
      printResult("Auth", { status: statusLabel(login.response.status), duration: login.duration });
    }
    if (authenticated) {
      total += 1;
      if (await check("Session", "/api/auth/me", { authenticated: true })) passed += 1;
      if (login.response.ok) passed += 1;
    }
  } else {
    printResult("Auth", { status: "SKIP", detail: "defina BBOS_SMOKE_EMAIL/PASSWORD" });
  }

  const protectedChecks = [
    ["Dashboard", "/api/dashboard/home"],
    ["Fornecedores", "/api/green-coffee-purchases/suppliers"],
    ["Compras", "/api/green-coffee-purchases"],
    ["Recebimentos", "/api/receipts"],
    ["Receipt options", "/api/receipts/options"],
    ["Laboratório", "/api/receipts/lab-samples"],
    ["Estoque", "/api/inventory/summary"],
    ["Blends", "/api/blends"],
    ["Produção", "/api/production/orders"],
    ["Corretores", "/api/brokers"],
  ];
  for (const [name, path] of protectedChecks) {
    if (!path) {
      printResult(name, { status: "SKIP", detail: "sem endpoint dedicado no main" });
      continue;
    }
    if (!authenticated) {
      printResult(name, { status: "SKIP", detail: "sessão não configurada" });
      continue;
    }
    total += 1;
    if (await check(name, path, { authenticated: true })) passed += 1;
  }
  console.log("────────────────────────");
  console.log(`Resultado: ${passed}/${total} checks executados com sucesso.`);
  if (passed === total && authenticated) console.log("BBOS operacional.");
  else if (!authenticated) console.log("Checks públicos concluídos; configure credenciais apenas fora do repositório para validar a sessão.");
  else console.log("Atenção necessária.");
  process.exitCode = passed === total ? 0 : 1;
}

main().catch(() => {
  console.error("Smoke test não conseguiu concluir a verificação.");
  process.exitCode = 1;
});
