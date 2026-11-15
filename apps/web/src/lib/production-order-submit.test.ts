import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const productionPage = readFileSync(
  new URL("../app/(system)/producao/page.tsx", import.meta.url),
  "utf8",
);

test("a confirmação da OP aguarda a API e informa o andamento no botão", () => {
  assert.match(productionPage, /const confirm = async \(\) =>/);
  assert.match(productionPage, /setCreating\(true\);[\s\S]*await onCreate\(/);
  assert.match(productionPage, /disabled=\{creating\}/);
  assert.match(productionPage, /Criando e reservando…/);
});

test("erros da criação aparecem dentro do assistente, sem ficarem atrás do modal", () => {
  assert.match(
    productionPage,
    /catch \(caught\) \{[\s\S]*setError\([\s\S]*caught\.message/,
  );
  assert.match(
    productionPage,
    /if \(!response\.ok\) \{[\s\S]*throw new Error\([\s\S]*readApiError/,
  );
  assert.match(productionPage, /role="alert"/);
});

test("a nova OP é criada por linha e perfil, sem escolher embalagem", () => {
  assert.match(productionPage, /Linha e perfil/);
  assert.match(productionPage, /Café \/ Perfil/);
  assert.doesNotMatch(productionPage, /SKU \/ Apresentação/);
  assert.match(productionPage, /productId: order\.productId/);
  assert.match(productionPage, /ficará no estoque a granel/);
});

test("Private Label fica no pedido e não aparece como perfil de torra", () => {
  assert.match(productionPage, /normalizedName\.includes\("white label"\)/);
  assert.match(productionPage, /normalizedName\.includes\("private label"\)/);
  assert.match(productionPage, /products\.filter\(isProductionProfile\)/);
});
