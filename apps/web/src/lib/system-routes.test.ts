import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  mobileNavigationForRole,
  navigationForRole,
} from "../components/bbos-navigation";
import { normalizeHostname, resolveDomainRedirect } from "./domain-routing";
import { isProtectedSystemPath } from "./system-routes";

test("all internal management roots require a session", () => {
  for (const path of [
    "/home",
    "/aplicativo",
    "/clientes",
    "/atendimento",
    "/fornecedores",
    "/corretores",
    "/notas-entrada",
    "/integracoes",
    "/usuarios",
    "/perfil",
    "/cafe-verde",
    "/blends/novo",
    "/exportacoes",
    "/commerce/midia",
    "/parceiro",
  ]) {
    assert.equal(
      isProtectedSystemPath(path),
      true,
      `${path} must be protected`,
    );
  }
});

test("storefront and tokenized public experiences remain public", () => {
  for (const path of [
    "/login",
    "/loja",
    "/loja/cafes/carlos-alexandre-safra-2026",
    "/pedido/acompanhar/order-id",
    "/cupping/sessao/token",
    "/aviso-privacidade",
  ]) {
    assert.equal(
      isProtectedSystemPath(path),
      false,
      `${path} must remain public`,
    );
  }
});

test("unknown or missing roles do not inherit an operational navigation", () => {
  assert.deepEqual(navigationForRole(undefined), []);
  assert.deepEqual(navigationForRole("FUTURE_ROLE"), []);
});

test("marketplace operators only see their dedicated marketplace area", () => {
  const routes = navigationForRole("MARKETPLACE_OPERATOR").flatMap((group) =>
    group.items.map((item) => item.href),
  );
  assert.deepEqual(routes, ["/commerce/marketplaces"]);
});

test("o perfil de vendedor recebe cadastro e atendimento sem acesso financeiro", () => {
  const routes = navigationForRole("SALES").flatMap((group) =>
    group.items.map((item) => item.href),
  );
  assert.ok(routes.includes("/clientes"));
  assert.ok(routes.includes("/atendimento"));
  assert.ok(routes.includes("/pedidos"));
  assert.ok(routes.includes("/vendas"));
  assert.equal(routes.includes("/commerce"), false);
  assert.equal(routes.includes("/commerce/marketplaces"), false);
  assert.equal(routes.includes("/financeiro"), false);
  assert.equal(routes.includes("/usuarios"), false);
});

test("atalhos móveis respeitam o perfil e deixam o menu completo como saída segura", () => {
  assert.deepEqual(
    mobileNavigationForRole("ADMIN").map((item) => item.href),
    ["/home", "/pedidos", "/estoque", "/financeiro"],
  );
  assert.deepEqual(
    mobileNavigationForRole("SALES").map((item) => item.href),
    ["/home", "/clientes", "/atendimento", "/pedidos"],
  );
  assert.deepEqual(
    mobileNavigationForRole("ACCOUNTANT").map((item) => item.href),
    ["/financeiro", "/notas-entrada", "/custos", "/clientes"],
  );
  assert.deepEqual(mobileNavigationForRole("FUTURE_ROLE"), []);
});

test("contabilidade recebe somente áreas de consulta fiscal e financeira", () => {
  const routes = navigationForRole("ACCOUNTANT").flatMap((group) =>
    group.items.map((item) => item.href),
  );
  assert.deepEqual(routes, [
    "/clientes",
    "/pedidos",
    "/vendas",
    "/notas-entrada",
    "/financeiro",
    "/custos",
  ]);
  for (const forbidden of [
    "/home",
    "/dashboard",
    "/cafe-verde",
    "/producao",
    "/integracoes",
    "/usuarios",
  ]) {
    assert.equal(routes.includes(forbidden), false);
  }
});

test("a tela inicial do vendedor prioriza ações comerciais amigáveis ao tablet", () => {
  const source = readFileSync(
    join(__dirname, "../components/home-command-v3.tsx"),
    "utf8",
  );

  assert.match(source, /Bispo Coffees · Painel comercial/);
  assert.match(source, /Novo pedido/);
  assert.match(source, /Novo cliente/);
  assert.match(source, /Registrar visita/);
  assert.match(source, /Minha carteira/);
  assert.match(source, /\/pedidos\?novo=1/);
  assert.match(source, /\/clientes\?novo=1/);
});

test("o login sempre oferece instalação e o service worker habilita PWA no Android", () => {
  const login = readFileSync(join(__dirname, "../app/login/page.tsx"), "utf8");
  const serviceWorker = readFileSync(
    join(__dirname, "../../public/sw.js"),
    "utf8",
  );

  assert.match(login, /Instalar o BBOS neste tablet/);
  assert.match(login, /Instalar aplicativo/);
  assert.match(login, /Samsung Internet/);
  assert.match(login, /requestedReturnTo !== "\/login"/);
  assert.match(login, /window\.location\.replace\(destination\)/);
  assert.match(serviceWorker, /addEventListener\("fetch"/);
});

test("management domain opens the BBOS login instead of the storefront", () => {
  assert.equal(
    resolveDomainRedirect({
      hostname: "bbos.bispocoffees.com.br",
      pathname: "/",
      search: "",
      hasSession: false,
    }),
    "/login?returnTo=%2Fhome",
  );

  assert.equal(
    resolveDomainRedirect({
      hostname: "bbos.bispocoffees.com.br",
      pathname: "/",
      search: "",
      hasSession: true,
    }),
    "/home",
  );
});

test("storefront and management paths remain on their canonical domains", () => {
  assert.equal(
    resolveDomainRedirect({
      hostname: "bbos.bispocoffees.com.br",
      pathname: "/loja/sobre",
      search: "?origem=bbos",
      hasSession: false,
    }),
    "https://loja.bispocoffees.com.br/loja/sobre?origem=bbos",
  );

  assert.equal(
    resolveDomainRedirect({
      hostname: "loja.bispocoffees.com.br",
      pathname: "/pedidos",
      search: "?status=aberto",
      hasSession: false,
    }),
    "https://bbos.bispocoffees.com.br/pedidos?status=aberto",
  );

  assert.equal(
    resolveDomainRedirect({
      hostname: "loja.bispocoffees.com.br",
      pathname: "/loja/conta",
      search: "",
      hasSession: false,
    }),
    null,
  );
});

test("forwarded hosts are normalized before routing", () => {
  assert.equal(
    normalizeHostname("BBOS.BISPOCOFFEES.COM.BR:443, proxy.internal"),
    "bbos.bispocoffees.com.br",
  );
});
