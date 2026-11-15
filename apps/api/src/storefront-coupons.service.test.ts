import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCouponAmounts,
  couponHasLinkedBusiness,
} from "./storefront-coupons.service";

test("cupom permite 3% de desconto ao cliente e 10% de comissão após o desconto", () => {
  const result = calculateCouponAmounts(10_000, {
    discountType: "PERCENT",
    discountValue: 3,
    commissionType: "PERCENT",
    commissionValue: 10,
    commissionBasis: "NET_SUBTOTAL",
  });

  assert.deepEqual(result, {
    discountCents: 300,
    netSubtotalCents: 9_700,
    commissionBaseCents: 9_700,
    commissionCents: 970,
  });
});

test("comissão pode usar o valor antes do desconto sem alterar o benefício do cliente", () => {
  const result = calculateCouponAmounts(10_000, {
    discountType: "PERCENT",
    discountValue: 3,
    commissionType: "PERCENT",
    commissionValue: 10,
    commissionBasis: "GROSS_SUBTOTAL",
  });

  assert.deepEqual(result, {
    discountCents: 300,
    netSubtotalCents: 9_700,
    commissionBaseCents: 10_000,
    commissionCents: 1_000,
  });
});

test("edição e exclusão são bloqueadas quando o cupom já possui negócio vinculado", () => {
  assert.equal(
    couponHasLinkedBusiness({ hasLinkedOrder: true, hasRedemption: false }),
    true,
  );
  assert.equal(
    couponHasLinkedBusiness({ hasLinkedOrder: false, hasRedemption: true }),
    true,
  );
});

test("cupom sem pedidos ou resgates permanece editável e removível", () => {
  assert.equal(
    couponHasLinkedBusiness({ hasLinkedOrder: false, hasRedemption: false }),
    false,
  );
});
