import assert from "node:assert/strict";
import test from "node:test";
import { BLING_CATALOG_PRICE_BY_SLUG } from "./bling-catalog-sync.service";

test("Bling catalog includes every White Label 250 g product with its commercial price", () => {
  assert.deepEqual(
    {
      "white-label-essencial": BLING_CATALOG_PRICE_BY_SLUG["white-label-essencial"],
      "white-label-classico": BLING_CATALOG_PRICE_BY_SLUG["white-label-classico"],
      "white-label-frutado": BLING_CATALOG_PRICE_BY_SLUG["white-label-frutado"],
      "white-label-raro": BLING_CATALOG_PRICE_BY_SLUG["white-label-raro"],
    },
    {
      "white-label-essencial": 19.5,
      "white-label-classico": 22,
      "white-label-frutado": 27.5,
      "white-label-raro": 38,
    },
  );
});
