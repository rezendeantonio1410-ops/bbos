import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("storefront operational health scopes every aggregate by the signed company", () => {
  const source = readFileSync(
    join(__dirname, "storefront-operations.controller.ts"),
    "utf8",
  );
  assert.match(source, /const companyId = request\.user\.companyId/);
  assert.equal(source.match(/"companyId"=\$1/g)?.length, 6);
  assert.equal(source.match(/companyId,\s*\)/g)?.length, 6);
});
