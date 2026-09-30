import assert from "node:assert/strict";
import test from "node:test";
import { navigationForRole } from "../components/bbos-navigation";
import {
  normalizeHostname,
  resolveDomainRedirect,
} from "./domain-routing";
import { isProtectedSystemPath } from "./system-routes";

test("all internal management roots require a session", () => {
  for (const path of [
    "/home",
    "/clientes",
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
