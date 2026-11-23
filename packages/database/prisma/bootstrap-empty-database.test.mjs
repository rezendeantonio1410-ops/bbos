import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { splitSqlStatements, LEGACY_CUTOFF } from "./bootstrap-empty-database.mjs";

test("splits on semicolons outside comments, strings and dollar quotes", () => {
  const sql = `-- comment; ignored
CREATE TABLE "a;b" (x text DEFAULT 'it''s; fine');
/* block; comment */ INSERT INTO t VALUES (E'a\\'; b');
DO $$ BEGIN PERFORM 1; PERFORM 2; END $$;
DO $tag$ BEGIN RAISE NOTICE 'x;y'; END $tag$;
SELECT 1`;
  const parts = splitSqlStatements(sql);
  assert.equal(parts.length, 5);
  assert.match(parts[0], /^CREATE TABLE "a;b"/);
  assert.match(parts[1], /E'a\\'; b'\)$/);
  assert.match(parts[2], /PERFORM 2; END \$\$$/);
  assert.match(parts[3], /'x;y'; END \$tag\$$/);
  assert.equal(parts[4], "SELECT 1");
});

test("every legacy migration splits into balanced statements", () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");
  const legacy = readdirSync(dir).filter((name) => name < LEGACY_CUTOFF && existsSync(join(dir, name, "migration.sql")));
  assert.ok(legacy.length > 100);
  for (const name of legacy) {
    const statements = splitSqlStatements(readFileSync(join(dir, name, "migration.sql"), "utf8"));
    for (const statement of statements) {
      const dollars = statement.match(/\$\$/g)?.length ?? 0;
      assert.equal(dollars % 2, 0, `${name}: unbalanced $$ in a statement`);
    }
  }
});

test("Signa migrations are never part of the tolerant legacy replay", () => {
  assert.ok("20261122010000_partner_end_customers" >= LEGACY_CUTOFF);
  assert.ok("20261123180000_signa_end_customer_unique_cnpj" >= LEGACY_CUTOFF);
});
