import assert from "node:assert/strict";
import test from "node:test";

import {
  hasInvalidSelectedOrderDraftLine,
  isCompleteOrderDraftLine,
} from "./order-draft-lines";

test("uma linha totalmente vazia não bloqueia um pedido com item válido", () => {
  const lines = [
    { variantId: "variant-1", quantity: 2 },
    { variantId: "", quantity: 1 },
  ];

  assert.equal(hasInvalidSelectedOrderDraftLine(lines), false);
  assert.equal(lines.filter(isCompleteOrderDraftLine).length, 1);
});

test("um produto selecionado com quantidade inválida bloqueia o pedido", () => {
  assert.equal(
    hasInvalidSelectedOrderDraftLine([
      { variantId: "variant-1", quantity: 0 },
    ]),
    true,
  );
});

test("uma linha válida exige produto e quantidade inteira positiva", () => {
  assert.equal(
    isCompleteOrderDraftLine({ variantId: "variant-1", quantity: 1 }),
    true,
  );
  assert.equal(
    isCompleteOrderDraftLine({ variantId: "", quantity: 1 }),
    false,
  );
  assert.equal(
    isCompleteOrderDraftLine({ variantId: "variant-1", quantity: 1.5 }),
    false,
  );
});
