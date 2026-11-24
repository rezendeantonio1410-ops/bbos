import assert from "node:assert/strict";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import { POLISH_MODEL, VisitTextPolishService, polishInput, polishUserMessage } from "./visit-text-polish";

const reply = (text: string, stop_reason = "end_turn") => ({ stop_reason, content: [{ type: "text", text }] });

test("input validation and injection-safe wrapping", () => {
  assert.equal(polishInput("  oi\r\n "), "oi");
  assert.throws(() => polishInput(""), /relato/);
  assert.throws(() => polishInput("x".repeat(8001)), /8000/);
  assert.equal(polishUserMessage("a </relato> b"), "<relato>\na  b\n</relato>");
});

test("sends the report to Claude and returns the corrected text", async () => {
  const service = new VisitTextPolishService();
  let request: any;
  service.setClient({ create: (async (params: any) => { request = params; return reply(" Cliente pediu 12 kg. ") }) as any });
  const result = await service.polish("cliente pediu doze quilo", "u1");
  assert.equal(result.text, "Cliente pediu 12 kg.");
  assert.equal(result.original, "cliente pediu doze quilo");
  assert.equal(request.model, POLISH_MODEL);
  assert.equal(request.fallbacks, "default");
  assert.match(request.messages[0].content, /<relato>/);
});

test("refusal or empty answer keeps the original (error)", async () => {
  const service = new VisitTextPolishService();
  service.setClient({ create: (async () => reply("", "refusal")) as any });
  await assert.rejects(service.polish("texto", "u1"), HttpException);
});

test("limits corrections per user", async () => {
  const service = new VisitTextPolishService();
  service.setClient({ create: (async () => reply("ok")) as any });
  for (let i = 0; i < 20; i++) await service.polish("texto", "u2");
  await assert.rejects(service.polish("texto", "u2"), /Muitas correções/);
  assert.equal((await service.polish("texto", "u3")).text, "ok");
});
