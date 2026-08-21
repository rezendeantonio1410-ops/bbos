import assert from "node:assert/strict";
import test from "node:test";
import { compareQuality } from "./lab-quality";

test("compara umidade, defeitos, pontuação e peneira dentro do contrato", () => {
  const result = compareQuality({ maxMoisturePercent: 12, measuredMoisturePercent: 11.4, maxDefects: 10, measuredDefects: 8, minimumScore: 84, measuredScore: 85, contractedScreen: "17/18", measuredScreen: "17/18" });
  assert.equal(result.withinContract, true);
  assert.equal(result.issues.length, 0);
});

test("descreve divergências laboratoriais", () => {
  const result = compareQuality({ maxMoisturePercent: 12, measuredMoisturePercent: 12.6, maxDefects: 5, measuredDefects: 13, minimumScore: 84, measuredScore: 82.5, contractedScreen: "17/18", measuredScreen: "16/18" });
  assert.equal(result.withinContract, false);
  assert.equal(result.issues.length, 4);
  assert.match(result.issues[0]!, /umidade/);
});
