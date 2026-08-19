import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const source = readFileSync(join(__dirname, "admin-coffee-reference.controller.ts"), "utf8");
const moduleSource = readFileSync(join(__dirname, "app.module.ts"), "utf8");
const mainSource = readFileSync(join(__dirname, "main.ts"), "utf8");

test("admin reference initialization route is registered at the expected POST path", () => {
  assert.match(source, /@Controller\("admin\/coffee-reference-data"\)/);
  assert.match(source, /@Post\("initialize"\)/);
  assert.match(moduleSource, /AdminCoffeeReferenceController/);
  assert.match(mainSource, /setGlobalPrefix\(["']api["']\)/);
});

test("reference initialization requires a session and an administrative role", () => {
  assert.match(source, /requireSession\(request, this\.auth\)/);
  assert.match(source, /actor\.role !== "ADMIN"/);
  assert.match(source, /actor\.role !== "EXECUTIVE"/);
  assert.match(source, /ForbiddenException/);
});
