import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Prisma cannot read a "void" column: a bare SELECT pg_advisory_xact_lock(...)
// through $queryRawUnsafe throws at runtime (seen on Permissões do portal).
test("advisory locks read through $queryRawUnsafe return a readable column", () => {
  const offenders: string[] = [];
  for (const file of readdirSync(__dirname).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))) {
    const source = readFileSync(join(__dirname, file), "utf8");
    const pattern = /\$queryRawUnsafe(?:<[^>]*>)?\(\s*`SELECT pg_advisory_xact_lock\(([^`]*)`/g;
    for (const match of source.matchAll(pattern)) {
      if (!/\)\s*(IS NULL|::text)/.test(match[0])) offenders.push(`${file}: ${match[0].slice(0, 90)}`);
    }
  }
  assert.deepEqual(offenders, []);
});
