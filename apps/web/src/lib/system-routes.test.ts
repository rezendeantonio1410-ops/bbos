import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  mobileNavigationForRole,
  navigationForRole,
  bbosNavigation,
  exportOperatorAllowed,
  pendingCountByGroup,
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

test("operadores de exportação veem somente a área de Exportações", () => {
  const groups = navigationForRole("EXPORT_OPERATOR");
  assert.deepEqual(groups.map((group) => group.id), ["export"]);
  assert.deepEqual(
    groups.flatMap((group) => group.items.map((item) => item.href)),
    ["/exportacoes", "/exportacoes/clientes", "/exportacoes/amostras", "/exportacoes/contratos"],
  );
  assert.equal(mobileNavigationForRole("EXPORT_OPERATOR")[0]?.href, "/exportacoes");
  assert.ok(exportOperatorAllowed("/exportacoes/amostras"));
  assert.ok(exportOperatorAllowed("/perfil"));
  for (const blocked of ["/home", "/pedidos", "/clientes", "/financeiro", "/exportacoesx"]) {
    assert.equal(exportOperatorAllowed(blocked), false, blocked);
  }
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
    ["/home", "/por-perto", "/pedidos", "/financeiro"],
  );
  // "Por perto" is a fixed phone shortcut for every field-capable role.
  for (const role of ["ADMIN", "EXECUTIVE", "INDUSTRIAL", "FINANCE", "SALES"])
    assert.equal(mobileNavigationForRole(role)[1]?.href, "/por-perto", role);
  assert.deepEqual(
    mobileNavigationForRole("SALES").map((item) => item.href),
    ["/home", "/por-perto", "/pedidos", "/clientes"],
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
  // Order follows the work areas: Vendas, Compras, Financeiro, Análises.
  assert.deepEqual(routes, [
    "/pedidos",
    "/clientes",
    "/notas-entrada",
    "/financeiro",
    "/custos",
    "/vendas",
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

test("o login adapta a instalação entre iPhone e Android", () => {
  const login = readFileSync(join(__dirname, "../app/login/page.tsx"), "utf8");
  const serviceWorker = readFileSync(
    join(__dirname, "../../public/sw.js"),
    "utf8",
  );

  assert.match(login, /Instalar o BBOS neste iPhone/);
  assert.match(login, /Instalar o BBOS neste dispositivo/);
  assert.match(login, /Adicionar à Tela de Início/);
  assert.match(login, /Abrir como App/);
  assert.match(login, /Instalar aplicativo/);
  assert.match(login, /Samsung Internet/);
  assert.match(login, /requestedReturnTo !== "\/login"/);
  assert.match(login, /window\.location\.replace\(destination\)/);
  assert.match(serviceWorker, /addEventListener\("fetch"/);
});

test("pedidos entregues não permanecem como ocorrência urgente de transporte", () => {
  const orders = readFileSync(
    join(__dirname, "../app/(system)/pedidos/page.tsx"),
    "utf8",
  );

  assert.match(orders, /const hasOpenDeliveryException = \(order: Order\)/);
  assert.match(orders, /!overdueTerminalStatuses\.has\(order\.status\)/);
  assert.match(orders, /orders\.filter\(hasOpenDeliveryException\)/);
  assert.match(
    orders,
    /const compactShipmentException = hasOpenDeliveryException\(order\)/,
  );
});

test("o novo pedido usa uma jornada compacta em celular e tablet", () => {
  const orders = readFileSync(
    join(__dirname, "../app/(system)/pedidos/page.tsx"),
    "utf8",
  );

  assert.match(orders, /Etapas do novo pedido/);
  assert.match(orders, /Cliente.*Produtos.*Entrega.*Revisão/s);
  assert.match(orders, /max-width: 1023px/);
  assert.match(orders, /Pedido pronto para conferência/);
  assert.match(orders, /Continuar para produtos/);
  assert.match(orders, /Continuar para entrega/);
  assert.match(orders, /Revisar pedido/);
});

test("novo pedido oferece saída segura e sempre visível no celular", () => {
  const orders = readFileSync(
    join(__dirname, "../app/(system)/pedidos/page.tsx"),
    "utf8",
  );

  assert.match(orders, /Descartar este lançamento\?/);
  assert.match(orders, /Continuar preenchendo/);
  assert.match(orders, /Descartar e sair/);
  assert.match(orders, /pb-\[max\(\.75rem,env\(safe-area-inset-bottom\)\)\]/);
});

test("todas as telas móveis possuem retorno global e diálogos identificam a saída", () => {
  const shell = readFileSync(
    join(__dirname, "../components/app-shell-v2.tsx"),
    "utf8",
  );
  const styles = readFileSync(join(__dirname, "../app/vnext.css"), "utf8");

  assert.match(shell, /aria-label="Abandonar esta tela e voltar"/);
  assert.match(shell, /mobileExitHref/);
  assert.match(styles, /button\[aria-label\^="Fechar"\]/);
  assert.match(styles, /content: "Sair"/);
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

test("menu: cada área tem ícone próprio e contadores vêm das notificações não lidas", () => {
  const icons = new Set(bbosNavigation.map((group) => group.icon));
  assert.equal(icons.size, bbosNavigation.length);
  for (const group of bbosNavigation) assert.notEqual(group.label, group.label.toUpperCase());
  const counts = pendingCountByGroup(bbosNavigation, [
    { href: "/pedidos/abc?aba=1", readAt: null },
    { href: "/pedidos", readAt: null },
    { href: "/financeiro", readAt: "2026-11-24" },
    { href: "/commerce/marketplaces/x", readAt: null },
    { href: "/fora-do-menu", readAt: null },
  ]);
  assert.deepEqual(counts, { commercial: 2, brand: 1 });
});

test("Vendas, Prospecção e Loja e marca são áreas separadas, com no máximo 4 itens", () => {
  const area = (id: string) => bbosNavigation.find((group) => group.id === id)?.items.map((item) => item.href);
  assert.deepEqual(area("commercial"), ["/pedidos", "/clientes"]);
  assert.deepEqual(area("export"), ["/exportacoes", "/exportacoes/clientes", "/exportacoes/amostras", "/exportacoes/contratos"]);
  assert.deepEqual(area("prospecting"), ["/prospeccao", "/atendimento", "/por-perto"]);
  assert.deepEqual(area("brand"), ["/commerce", "/commerce/marketplaces", "/commerce/midia"]);
  for (const group of bbosNavigation) assert.ok(group.items.length <= 5, group.label);
  const sales = navigationForRole("SALES").map((group) => group.id);
  assert.ok(sales.includes("prospecting") && !sales.includes("brand"));
});
