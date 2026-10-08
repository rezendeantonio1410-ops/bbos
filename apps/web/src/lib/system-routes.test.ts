import assert from "node:assert/strict";
import test from "node:test";
import { navigationForRole } from "../components/bbos-navigation";
import {
  normalizeHostname,
  resolveDomainRedirect,
  resolveLegacyStorefrontRedirect,
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

test("legacy Nuvemshop URLs preserve product intent on the new storefront", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    [
      "/produtos/essencial-500g/",
      "https://www.bispocoffees.com.br/loja?utm_source=legacy#essencial",
    ],
    [
      "/produtos/intenso-500g/",
      "https://www.bispocoffees.com.br/loja?utm_source=legacy#intenso",
    ],
    [
      "/produtos/caramelo-500g/",
      "https://www.bispocoffees.com.br/loja?utm_source=legacy#caramelo",
    ],
    [
      "/produtos/doce-de-leite-500g/",
      "https://www.bispocoffees.com.br/loja?utm_source=legacy#doce-de-leite",
    ],
    [
      "/produtos/tangerina-500g/",
      "https://www.bispocoffees.com.br/loja?utm_source=legacy#tangerina",
    ],
    [
      "/produtos/singular-500g/",
      "https://www.bispocoffees.com.br/loja?utm_source=legacy#singular",
    ],
    [
      "/produtos/sublime-500g/",
      "https://www.bispocoffees.com.br/loja?utm_source=legacy#sublime",
    ],
    [
      "/produtos/raro-250g/",
      "https://www.bispocoffees.com.br/loja?utm_source=legacy#raro",
    ],
  ];

  for (const [pathname, expected] of cases) {
    assert.equal(
      resolveLegacyStorefrontRedirect({
        hostname: "www.bispocoffees.com.br",
        pathname,
        search: "?utm_source=legacy",
        storefrontOrigin: "https://www.bispocoffees.com.br",
      }),
      expected,
    );
  }
});

test("legacy institutional and account URLs have safe destinations", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["/produtos/", "/loja#cafes"],
    ["/contato/", "/loja/entrega-e-devolucoes"],
    ["/quem-somos/", "/loja/sobre"],
    ["/account/login/", "/loja/conta"],
    ["/account/register/", "/loja/conta"],
  ];

  for (const [pathname, destination] of cases) {
    assert.equal(
      resolveLegacyStorefrontRedirect({
        hostname: "www.bispocoffees.com.br",
        pathname,
        search: "",
        storefrontOrigin: "https://www.bispocoffees.com.br",
      }),
      `https://www.bispocoffees.com.br${destination}`,
    );
  }
});

test("canonical storefront host enforcement is opt-in for a safe DNS cutover", () => {
  const input = {
    hostname: "loja.bispocoffees.com.br",
    pathname: "/loja/sobre",
    search: "?origem=legado",
    hasSession: false,
    storefrontOrigin: "https://www.bispocoffees.com.br",
  };

  assert.equal(resolveDomainRedirect(input), null);
  assert.equal(
    resolveDomainRedirect({
      ...input,
      enforceStorefrontCanonicalHost: true,
    }),
    "https://www.bispocoffees.com.br/loja/sobre?origem=legado",
  );
});

test("forwarded hosts are normalized before routing", () => {
  assert.equal(
    normalizeHostname("BBOS.BISPOCOFFEES.COM.BR:443, proxy.internal"),
    "bbos.bispocoffees.com.br",
  );
});
