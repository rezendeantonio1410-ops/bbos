import assert from "node:assert/strict";
import test from "node:test";
import { navigationForRole } from "../components/bbos-navigation";
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
