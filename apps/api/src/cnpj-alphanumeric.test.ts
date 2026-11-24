import assert from "node:assert/strict";
import test from "node:test";
import { cnpjCheckDigits, formatCnpj, isAlphanumericCnpj, normalizeCnpj, normalizeTaxId } from "@bbos/shared";
import { isValidCnpj, validateTaxId } from "./supplier-verification";
import { normalizeCnpj as normalizeSuggestionCnpj } from "./internal-cnpj-suggestion";
import { parsePartnerEndCustomerPatch } from "./partner-end-customer-input";
import { parseProspectPatch } from "./prospect-input";
import { normalizeCustomerFiscalData } from "./customer-fiscal-readiness";

const OFFICIAL = "12.ABC.345/01DE-35"; // official Receita Federal example
const NUMERIC = "62.835.118/0001-97";

test("official alphanumeric example and numeric CNPJ are both valid", () => {
  assert.equal(cnpjCheckDigits("12ABC34501DE"), "35");
  assert.equal(isValidCnpj(OFFICIAL), true);
  assert.equal(isValidCnpj("12abc34501de35"), true); // lower case typed
  assert.equal(isValidCnpj(NUMERIC), true);
  assert.equal(isValidCnpj("12.ABC.345/01DE-36"), false); // wrong check digit
  assert.equal(isValidCnpj("12.ABC.345/01DE-3A"), false); // check digits are numbers only
  assert.equal(isValidCnpj("11.111.111/1111-11"), false);
  assert.equal(isAlphanumericCnpj(OFFICIAL), true);
  assert.equal(isAlphanumericCnpj(NUMERIC), false);
  assert.equal(formatCnpj("12abc34501de35"), OFFICIAL);
});

test("normalization keeps the letters (so duplicates are compared correctly)", () => {
  assert.equal(normalizeCnpj(OFFICIAL), "12ABC34501DE35");
  assert.equal(normalizeSuggestionCnpj(" 12.abc.345/01de-35 "), "12ABC34501DE35");
  assert.notEqual(normalizeCnpj(OFFICIAL), normalizeCnpj("12.345.010/0035-00")); // old digit stripping would collide
  assert.equal(normalizeTaxId("123.456.789-09"), "12345678909");
  assert.equal(validateTaxId(OFFICIAL), "CNPJ");
  assert.equal(validateTaxId(NUMERIC), "CNPJ");
  assert.equal(validateTaxId("123.456.789-09"), "CPF");
});

test("Signa end customer accepts the new CNPJ and still rejects invalid ones", () => {
  const base = { name: "Cafeteria Teste", postalCode: "86010-000", street: "Rua A", number: "10", district: "Centro", city: "Londrina", state: "PR" };
  assert.equal(parsePartnerEndCustomerPatch({ ...base, taxId: OFFICIAL }, "create").taxId, "12ABC34501DE35");
  assert.equal(parsePartnerEndCustomerPatch({ ...base, taxId: NUMERIC }, "create").taxId, "62835118000197");
  assert.throws(() => parsePartnerEndCustomerPatch({ ...base, taxId: "12.ABC.345/01DE-36" }, "create"), /CNPJ inválido/);
});

test("prospect confirmation and fiscal readiness accept the new CNPJ", () => {
  assert.equal(parseProspectPatch({ taxId: OFFICIAL }).taxId, "12ABC34501DE35");
  assert.throws(() => parseProspectPatch({ taxId: "12ABC34501DE99" }), /CNPJ inválido/);
  const fiscal = normalizeCustomerFiscalData({ countryCode: "BR", taxId: OFFICIAL } as never) as { taxId?: string; documentType?: string };
  assert.equal(fiscal.taxId, "12ABC34501DE35");
});
