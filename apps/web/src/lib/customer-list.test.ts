import assert from "node:assert/strict";
import test from "node:test";
import { healthChip, matchesQuickFilter, taxIdNeedsCheck } from "./customer-list";

test("quick filters of the customer list", () => {
  const late = { financialHealth: { health: "BLOCKED" }, fiscalReadiness: { ready: true }, taxId: "12.345.678/0001-90", taxIdVerificationStatus: "VERIFIED_ACTIVE" };
  const fresh = { financialHealth: { health: "INFO" }, creditStatus: "UNDER_REVIEW", fiscalReadiness: { ready: false }, taxId: "", countryCode: "BR" };
  const person = { financialHealth: { health: "HEALTHY" }, fiscalReadiness: { ready: true }, taxId: "030.477.839-77" };
  assert.equal(matchesQuickFilter(late, "ATTENTION"), true);
  assert.equal(matchesQuickFilter(fresh, "ATTENTION"), false);
  assert.equal(matchesQuickFilter(fresh, "CREDIT_REVIEW"), true);
  assert.equal(matchesQuickFilter(fresh, "FISCAL_PENDING"), true);
  assert.equal(taxIdNeedsCheck(fresh), true);
  assert.equal(taxIdNeedsCheck(late), false);
  assert.equal(taxIdNeedsCheck(person), false); // CPF: not a CNPJ check
  assert.equal(healthChip("INFO").label, "Só à vista");
  assert.equal(healthChip("BLOCKED").label, "Prazo bloqueado");
});
