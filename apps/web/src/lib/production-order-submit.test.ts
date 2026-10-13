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
