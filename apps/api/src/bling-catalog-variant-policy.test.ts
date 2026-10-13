import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("Bling catalog and invoices identify each sellable presentation by variant and SKU", () => {
  const catalog = readFileSync(
    join(__dirname, "integrations/bling/bling-catalog-sync.service.ts"),
    "utf8",
  );
  const outbox = readFileSync(
    join(__dirname, "integrations/bling/bling-outbox.service.ts"),
    "utf8",
  );

  assert.doesNotMatch(catalog, /p\.slug IN \(/);
  assert.match(catalog, /return String\(row\?\.variantId/);
  assert.match(catalog, /metadata\?\.productVariantId/);
  assert.match(catalog, /metadata\?\.sku/);
  assert.match(catalog, /this\.localCatalog\(companyId\)/);
  assert.match(catalog, /FROM "ProductPrice"/);
  assert.match(outbox, /variantId: item\.variantId/);
  assert.match(outbox, /UPPER\(COALESCE\(metadata->>'sku',''\)\)=\$3/);
  assert.match(outbox, /SKU \$\{sku \|\| variantId\}/);
});
