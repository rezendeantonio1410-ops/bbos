import assert from "node:assert/strict";
import test from "node:test";
import { getStateShapes, projectFeatures } from "./municipality-shapes";

const square = (code: string, x: number, y: number) => ({
  properties: { codarea: code },
  geometry: { type: "Polygon", coordinates: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]] },
});

test("projeta os contornos para caminhos SVG com nomes do IBGE", () => {
  const shapes = projectFeatures([square("4113700", -51, -24), square("4106902", -50, -25)], new Map([["4113700", "Londrina"]]), 200);
  assert.equal(shapes.width, 200);
  assert.ok(shapes.height > 0);
  assert.equal(shapes.municipalities.length, 2);
  assert.equal(shapes.municipalities[0]?.name, "Londrina");
  assert.equal(shapes.municipalities[1]?.name, "4106902");
  assert.match(shapes.municipalities[0]!.path, /^M[\d.]+,[\d.]+L/);
  // The northern square (higher latitude) is drawn above the southern one.
  assert.ok(shapes.municipalities[0]!.cy < shapes.municipalities[1]!.cy);
});

test("UF desconhecida não consulta o IBGE", async () => {
  let called = false;
  const result = await getStateShapes("XX", (async () => { called = true; throw new Error(); }) as unknown as typeof fetch);
  assert.equal(result, null);
  assert.equal(called, false);
});
