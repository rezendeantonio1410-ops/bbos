import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../apps/web/src/app/cupping/mobile/preview/preview-client.tsx", import.meta.url),
  "utf8",
);

const required = [
  ["02 Sabor", 'stage === "sabor"', "CuppingSensoryLibrary"],
  ["03 Finalização", 'stage === "finalizacao"', "CuppingAftertaste"],
  ["04 Acidez", 'stage === "acidez"', "CuppingAcidity"],
  ["05 Corpo", 'stage === "corpo"', "CuppingBody"],
  ["06 Uniformidade", 'stage === "uniformity"', 'attribute="UNIFORMITY"'],
  ["07 Doçura", 'stage === "sweetness"', 'attribute="SWEETNESS"'],
  ["08 Xícara Limpa", 'stage === "cleanCup"', 'attribute="CLEAN_CUP"'],
  ["09 Avaliação Geral", 'stage === "overall"', "CuppingScorePicker"],
];

for (const [label, stage, component] of required) {
  if (!source.includes(stage) || !source.includes(component)) {
    throw new Error(`Conteúdo ausente: ${label}`);
  }
}

for (const legacy of ['stage === "flavor"', 'stage === "aftertaste"', 'stage === "acidity"', 'stage === "body"']) {
  if (source.includes(legacy)) throw new Error(`Mapping legado ainda presente: ${legacy}`);
}

console.log(`CUPPING PREVIEW CONTENT ASSERT: PASS (${required.length} etapas verificadas)`);
