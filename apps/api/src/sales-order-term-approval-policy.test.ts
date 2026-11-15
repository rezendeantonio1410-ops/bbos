import assert from "node:assert/strict";
import test from "node:test";
import {
  isDesignatedTermCreditApprover,
  requiresDelinquencyApproval,
} from "./sales-order-term-approval-policy";

test("venda a prazo inadimplente exige autorização", () => {
  assert.equal(
    requiresDelinquencyApproval({
      paymentType: "TERM",
      overdueCount: 1,
      overdueAmount: 350,
    }),
    true,
  );
  assert.equal(
    requiresDelinquencyApproval({
      paymentType: "CASH",
      overdueCount: 2,
      overdueAmount: 500,
    }),
    false,
  );
  assert.equal(
    requiresDelinquencyApproval({
      paymentType: "TERM",
      overdueCount: 0,
      overdueAmount: 0,
    }),
    false,
  );
});

test("somente José ou Suzi em função administrativa podem decidir", () => {
  assert.equal(
    isDesignatedTermCreditApprover({ name: "José Rezende", role: "ADMIN" }),
    true,
  );
  assert.equal(
    isDesignatedTermCreditApprover({ name: "Suzi Silva", role: "EXECUTIVE" }),
    true,
  );
  assert.equal(
    isDesignatedTermCreditApprover({ name: "José Rezende", role: "SALES" }),
    false,
  );
  assert.equal(
    isDesignatedTermCreditApprover({ name: "Outra Pessoa", role: "ADMIN" }),
    false,
  );
});
