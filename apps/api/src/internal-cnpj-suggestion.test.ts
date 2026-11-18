import assert from "node:assert/strict";
import test from "node:test";
import {
  canUpdateInternalTaxIdRejectionMetadata,
  isTrustedInternalTaxIdVerificationStatus,
  normalizeCnpj,
  normalizePostalCode,
  normalizeState,
  normalizeSuggestionText,
  selectTaxIdSuggestionSnapshotRows,
  suggestInternalCnpjs,
  validateCnpjSuggestionQuery,
  type InternalCnpjCandidateInput,
} from "./internal-cnpj-suggestion";

test("normaliza texto, CEP, CNPJ e UF sem esconder dígitos excedentes", () => {
  assert.equal(
    normalizeSuggestionText("  Café São João & Filhos, LTDA.  "),
    "cafe sao joao e filhos ltda",
  );
  assert.equal(normalizePostalCode("86.020-380"), "86020380");
  assert.equal(normalizePostalCode("86020-3809"), "860203809");
  assert.equal(normalizeCnpj("04.252.011/0001-10"), "04252011000110");
  assert.equal(normalizeState(" pr "), "PR");
});

test("valida que a busca tenha identidade e localização suficientes", () => {
  const missingLocation = validateCnpjSuggestionQuery({
    name: "Jardim Secreto",
  });
  assert.deepEqual(
    missingLocation.issues.map((issue) => issue.code),
    ["LOCATION_REQUIRED"],
  );

  const stateIsNotEnough = validateCnpjSuggestionQuery({
    name: "Jardim Secreto",
    state: "PR",
  });
  assert.deepEqual(
    stateIsNotEnough.issues.map((issue) => issue.code),
    ["LOCATION_REQUIRED"],
  );

  const invalidFormats = validateCnpjSuggestionQuery({
    legalName: "Cafeteria Jardim Secreto Ltda",
    postalCode: "8602",
    state: "Paraná",
  });
  assert.deepEqual(
    invalidFormats.issues.map((issue) => issue.code),
    ["INVALID_POSTAL_CODE", "INVALID_STATE"],
  );

  const missingName = validateCnpjSuggestionQuery({ city: "Londrina" });
  assert.deepEqual(
    missingName.issues.map((issue) => issue.code),
    ["NAME_REQUIRED"],
  );
});

test("limita a confiança quando a cidade é o único sinal de localização", () => {
  const result = suggestInternalCnpjs(
    {
      name: "Jardim Secreto",
      city: "Londrina",
      state: "PR",
    },
    [
      {
        source: "CUSTOMER",
        sourceId: "customer-1",
        cnpj: "45.819.377/0001-05",
        name: "Jardim Secreto",
        city: "Londrina",
        state: "PR",
      },
    ],
  );

  assert.equal(result.validQuery, true);
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0]?.confidence, 0.78);
});

test("descarta candidato sem correspondência de localização", () => {
  const result = suggestInternalCnpjs(
    {
      name: "Jardim Secreto",
      city: "Londrina",
    },
    [
      {
        source: "CUSTOMER",
        sourceId: "customer-1",
        cnpj: "45.819.377/0001-05",
        name: "Jardim Secreto",
        city: "Curitiba",
      },
    ],
  );

  assert.equal(result.validQuery, true);
  assert.equal(result.suggestions.length, 0);
  assert.equal(result.discardedCandidates, 1);
});

test("coloca a correspondência exata na primeira posição com score auditável", () => {
  const candidates: InternalCnpjCandidateInput[] = [
    {
      source: "CUSTOMER",
      sourceId: "customer-2",
      cnpj: "33.000.167/0001-01",
      name: "Jardim Café",
      legalName: "Jardim Café Comércio Ltda",
      address: "Rua Pio XII, 91",
      postalCode: "86020-380",
      city: "Londrina",
      state: "PR",
    },
    {
      source: "CUSTOMER",
      sourceId: "customer-1",
      cnpj: "45.819.377/0001-05",
      name: "Jardim Secreto",
      legalName: "Cafeteria Jardim Secreto Ltda",
      address: "Rua Pio XII, 93",
      postalCode: "86020-380",
      city: "Londrina",
      state: "PR",
    },
  ];

  const result = suggestInternalCnpjs(
    {
      name: "Jardim Secreto",
      legalName: "Cafeteria Jardim Secreto",
      address: "Rua Pio XII, 93",
      postalCode: "86020-380",
      city: "Londrina",
      state: "PR",
    },
    candidates,
  );

  assert.equal(result.validQuery, true);
  assert.equal(result.suggestions[0]?.cnpj, "45819377000105");
  assert.equal(result.suggestions[0]?.confidence, 1);
  assert.deepEqual(result.suggestions[0]?.fieldScores, {
    NAME: 1,
    LEGAL_NAME: 1,
    ADDRESS: 1,
    POSTAL_CODE: 1,
    CITY: 1,
    STATE: 1,
  });
  assert.ok(
    (result.suggestions[0]?.confidence ?? 0) >
      (result.suggestions[1]?.confidence ?? 0),
  );
});

test("deduplica o mesmo CNPJ, preserva as fontes internas e limita o top 3", () => {
  const exactBase = {
    name: "Comercial Aurora",
    legalName: "Comercial Aurora Ltda",
    address: "Avenida Central, 100",
    postalCode: "01001-000",
    city: "São Paulo",
    state: "SP",
  };
  const candidates: InternalCnpjCandidateInput[] = [
    {
      ...exactBase,
      source: "SUPPLIER",
      sourceId: "supplier-1",
      cnpj: "04.252.011/0001-10",
    },
    {
      ...exactBase,
      source: "CUSTOMER",
      sourceId: "customer-1",
      cnpj: "04.252.011/0001-10",
    },
    {
      ...exactBase,
      name: "Comercial Aurora Unidade 2",
      source: "CUSTOMER",
      sourceId: "customer-2",
      cnpj: "33.000.167/0001-01",
    },
    {
      ...exactBase,
      name: "Comercial Aurora Unidade 3",
      source: "CUSTOMER",
      sourceId: "customer-3",
      cnpj: "60.701.190/0001-04",
    },
    {
      ...exactBase,
      name: "Comercial Aurora Unidade 4",
      source: "CUSTOMER",
      sourceId: "customer-4",
      cnpj: "00.000.000/0001-91",
    },
    {
      ...exactBase,
      source: "CUSTOMER",
      sourceId: "invalid",
      cnpj: "11.111.111/1111-11",
    },
  ];

  const result = suggestInternalCnpjs(exactBase, candidates);

  assert.equal(result.suggestions.length, 3);
  assert.equal(
    result.suggestions.filter((item) => item.cnpj === "04252011000110").length,
    1,
  );
  const deduplicated = result.suggestions.find(
    (item) => item.cnpj === "04252011000110",
  );
  assert.deepEqual(deduplicated?.sources, [
    { source: "CUSTOMER", sourceId: "customer-1" },
    { source: "SUPPLIER", sourceId: "supplier-1" },
  ]);
  assert.equal(result.discardedCandidates, 1);
});

test("não produz sugestões quando a consulta é inválida", () => {
  const result = suggestInternalCnpjs(
    { postalCode: "86020-380", city: "Londrina", state: "PR" },
    [
      {
        source: "CUSTOMER",
        sourceId: "customer-1",
        cnpj: "45.819.377/0001-05",
        name: "Jardim Secreto",
        city: "Londrina",
        state: "PR",
      },
    ],
  );

  assert.equal(result.validQuery, false);
  assert.equal(result.suggestions.length, 0);
  assert.equal(result.issues[0]?.code, "NAME_REQUIRED");
});

test("aceita como fonte interna somente CNPJ previamente verificado", () => {
  assert.equal(
    isTrustedInternalTaxIdVerificationStatus("VERIFIED_ACTIVE"),
    true,
  );
  assert.equal(
    isTrustedInternalTaxIdVerificationStatus("CONFIRMED_INTERNAL"),
    true,
  );

  for (const status of [
    "NOT_VERIFIED",
    "VERIFIED_INACTIVE",
    "INVALID",
    "SERVICE_UNAVAILABLE",
    null,
  ]) {
    assert.equal(isTrustedInternalTaxIdVerificationStatus(status), false);
  }
});

test("snapshot prioriza até três sugestões ativas e não mistura confirmação antiga", () => {
  const rows = [
    { id: "confirmed-old", status: "CONFIRMED" },
    { id: "selected", status: "SELECTED" },
    { id: "draft-newest", status: "DRAFT" },
    { id: "draft-middle", status: "DRAFT" },
    { id: "draft-fourth", status: "DRAFT" },
  ];

  assert.deepEqual(
    selectTaxIdSuggestionSnapshotRows(rows, 3).map((row) => row.id),
    ["selected", "draft-newest", "draft-middle"],
  );
  assert.deepEqual(
    selectTaxIdSuggestionSnapshotRows(
      [
        { id: "confirmed-new", status: "CONFIRMED" },
        { id: "confirmed-old", status: "CONFIRMED" },
      ],
      3,
    ).map((row) => row.id),
    ["confirmed-new"],
  );
});

test("rejeição só atualiza metadado ainda pertencente ao fluxo interno", () => {
  assert.equal(
    canUpdateInternalTaxIdRejectionMetadata("NOT_VERIFIED", null),
    true,
  );
  assert.equal(
    canUpdateInternalTaxIdRejectionMetadata(
      "NOT_VERIFIED",
      "BBOS_INTERNAL_NO_MATCH",
    ),
    true,
  );
  assert.equal(
    canUpdateInternalTaxIdRejectionMetadata(
      "NOT_VERIFIED",
      "BBOS_INTERNAL_MANUAL_ENTRY",
    ),
    true,
  );

  assert.equal(
    canUpdateInternalTaxIdRejectionMetadata("VERIFIED_ACTIVE", "MANUAL_ENTRY"),
    false,
  );
  assert.equal(
    canUpdateInternalTaxIdRejectionMetadata(
      "CONFIRMED_INTERNAL",
      "BBOS_INTERNAL_SUGGESTION",
    ),
    false,
  );
  assert.equal(
    canUpdateInternalTaxIdRejectionMetadata("NOT_VERIFIED", "MANUAL_ENTRY"),
    false,
  );
  assert.equal(
    canUpdateInternalTaxIdRejectionMetadata("NOT_VERIFIED", "RECEITA_FEDERAL"),
    false,
  );
});
