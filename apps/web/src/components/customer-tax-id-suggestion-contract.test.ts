import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalCnpj,
  confirmedTaxIdFromSnapshot,
  filterTaxIdSuggestionsForSnapshot,
  isConfirmedTaxIdStatus,
  isConfirmedTaxIdSuggestionStatus,
  normalizeTaxIdStatus,
  taxIdSuggestionRejectionRequest,
} from "./customer-tax-id-suggestion-contract";

test("aceita somente CNPJ canônico com exatamente 14 dígitos", () => {
  assert.equal(canonicalCnpj("12.345.678/0001-90"), "12345678000190");
  assert.equal(canonicalCnpj("1234567800019"), "");
  assert.equal(canonicalCnpj("123456780001900"), "");
});

test("normaliza status com espaços e caixa antes de decidir", () => {
  assert.equal(normalizeTaxIdStatus("  confirmed  "), "CONFIRMED");
  assert.equal(isConfirmedTaxIdSuggestionStatus(" confirmed "), true);
  assert.equal(isConfirmedTaxIdStatus(" verified_active "), true);
});

test("filtra sugestões incompletas e confirma somente o status CONFIRMED", () => {
  const suggestions = [
    { taxId: "1234567800019", status: "DRAFT", label: "incompleto" },
    { taxId: "12.345.678/0001-90", status: " DRAFT ", label: "rascunho" },
    { taxId: "12.345.678/0001-90", status: " confirmed ", label: "confirmado" },
    { taxId: "98.765.432/0001-10", status: "CONFIRMED", label: "obsoleto" },
  ];

  assert.deepEqual(
    filterTaxIdSuggestionsForSnapshot(
      suggestions,
      "12.345.678/0001-90",
      " confirmed_internal ",
    ).map((suggestion) => suggestion.label),
    ["rascunho", "confirmado"],
  );
});

test("aceita confirmação oficial quando o CNPJ canônico coincide", () => {
  assert.equal(
    confirmedTaxIdFromSnapshot(
      {
        customer: {
          taxId: "12.345.678/0001-90",
          verificationStatus: "VERIFIED_ACTIVE",
        },
        suggestions: [{ taxId: "12.345.678/0001-90", status: " confirmed " }],
      },
      "12345678000190",
    ),
    "12345678000190",
  );
});

test("aceita confirmação interna sem convertê-la em verificação oficial", () => {
  assert.equal(
    confirmedTaxIdFromSnapshot(
      {
        customer: {
          taxId: "12.345.678/0001-90",
          verificationStatus: "CONFIRMED_INTERNAL",
        },
        suggestions: [{ taxId: "12.345.678/0001-90", status: "CONFIRMED" }],
      },
      "12.345.678/0001-90",
    ),
    "12345678000190",
  );
});

test("rejeita resposta 200 com CNPJ divergente", () => {
  assert.throws(
    () =>
      confirmedTaxIdFromSnapshot(
        {
          customer: {
            taxId: "98.765.432/0001-10",
            verificationStatus: "CONFIRMED_INTERNAL",
          },
          suggestions: [{ taxId: "98.765.432/0001-10", status: "CONFIRMED" }],
        },
        "12.345.678/0001-90",
      ),
    /CNPJ diferente ou incompleto/,
  );
});

test("rejeita resposta 200 com status incompleto ou ainda pendente", () => {
  assert.throws(
    () =>
      confirmedTaxIdFromSnapshot(
        {
          customer: {
            taxId: "12.345.678/0001-90",
            verificationStatus: "PENDING_REVIEW",
          },
          suggestions: [{ taxId: "12.345.678/0001-90", status: "CONFIRMED" }],
        },
        "12.345.678/0001-90",
      ),
    /status válido/,
  );
});

test("rejeita resposta 200 com documento incompleto", () => {
  assert.throws(
    () =>
      confirmedTaxIdFromSnapshot(
        {
          customer: {
            taxId: "12345678",
            verificationStatus: "CONFIRMED_INTERNAL",
          },
          suggestions: [{ taxId: "12345678", status: "CONFIRMED" }],
        },
        "12345678",
      ),
    /CNPJ diferente ou incompleto/,
  );
});

test("rejeita confirmação quando o número coincide, mas a sugestão não está CONFIRMED", () => {
  assert.throws(
    () =>
      confirmedTaxIdFromSnapshot(
        {
          customer: {
            taxId: "12.345.678/0001-90",
            verificationStatus: "CONFIRMED_INTERNAL",
          },
          suggestions: [{ taxId: "12.345.678/0001-90", status: " selected " }],
        },
        "12.345.678/0001-90",
      ),
    /ainda não foi confirmada/,
  );
});

test("persiste a decisão de que nenhuma sugestão corresponde", () => {
  const request = taxIdSuggestionRejectionRequest("cliente/1", "NONE_MATCH");

  assert.equal(
    request.path,
    "/customers/cliente%2F1/tax-id-suggestions/reject",
  );
  assert.equal(request.init.method, "POST");
  assert.deepEqual(JSON.parse(request.init.body), {
    reason: "NONE_MATCH",
    acknowledged: true,
  });
});

test("persiste a escolha de entrada manual antes de abrir a edição", () => {
  const request = taxIdSuggestionRejectionRequest("cliente-2", "MANUAL_ENTRY");

  assert.deepEqual(JSON.parse(request.init.body), {
    reason: "MANUAL_ENTRY",
    acknowledged: true,
  });
});
