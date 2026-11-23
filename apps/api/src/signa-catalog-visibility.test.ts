import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { selectDistributorCatalogVisibility } from "./signa-catalog-visibility";

test("Signa without an explicit active catalog shows no variants, even with private prices", () => {
  const selected = selectDistributorCatalogVisibility([], true);
  assert.equal(selected.needsLegacyFallback, false);
  assert.equal(selected.variantIds.size, 0);
});

test("Signa only sees variants explicitly on the active catalog allowlist", () => {
  const selected = selectDistributorCatalogVisibility(["RAR-WLR-250", "RAR-WLR-500", "RAR-WLR-1000"], true);
  assert.equal(selected.needsLegacyFallback, false);
  assert.deepEqual(
    [...selected.variantIds].sort(),
    ["RAR-WLR-1000", "RAR-WLR-250", "RAR-WLR-500"].sort(),
  );
  // Disabling the 500g catalog row must make it unavailable despite a
  // CustomerProductPrice that could still exist.
  const revoked = selectDistributorCatalogVisibility(["RAR-WLR-250", "RAR-WLR-1000"], true);
  assert.equal(revoked.variantIds.has("RAR-WLR-500"), false);
});

test("non-Signa distributors retain legacy price-list fallback", () => {
  const legacy = selectDistributorCatalogVisibility([], false);
  assert.equal(legacy.needsLegacyFallback, true);
  const explicit = selectDistributorCatalogVisibility(["variant-1"], false);
  assert.equal(explicit.needsLegacyFallback, false);
  assert.deepEqual([...explicit.variantIds], ["variant-1"]);
});

test("controller consistently applies the Signa-only strict policy to options, quote and order", () => {
  const controller = readFileSync(join(__dirname, "partner-portal.controller.ts"), "utf8");
  // Quote, order, options and server draft saving all require scoped catalog validation.
  assert.ok((controller.match(/this\.distributorCatalog\(/g) ?? []).length >= 4);
  assert.ok((controller.match(/this\.isSignaDistributor\(partner\)/g) ?? []).length >= 4);
  assert.match(controller, /if \(!visible\.needsLegacyFallback\)/);
  assert.match(
    controller,
    /: partner\.portalAccessLevel === "DISTRIBUTOR"\s*\? \[\]\s*: internalOptions\.variants/,
    "Distributor order options must never expose the unrestricted internal product list",
  );
});
