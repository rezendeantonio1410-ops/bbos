import { isValidCnpj } from "./supplier-verification";

/**
 * The helper only accepts records that already exist inside BBOS. It does not
 * query, infer or label any candidate as coming from an external registry.
 */
export const INTERNAL_CNPJ_SOURCES = ["CUSTOMER", "SUPPLIER"] as const;

export type InternalCnpjSource = (typeof INTERNAL_CNPJ_SOURCES)[number];

export interface InternalCnpjSuggestionQueryInput {
  name?: string | null;
  legalName?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface InternalCnpjCandidateInput {
  source: InternalCnpjSource;
  sourceId: string;
  cnpj: string;
  name?: string | null;
  legalName?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  state?: string | null;
}

export type CnpjSuggestionField =
  "NAME" | "LEGAL_NAME" | "ADDRESS" | "POSTAL_CODE" | "CITY" | "STATE";

export type CnpjSuggestionValidationIssueCode =
  | "NAME_REQUIRED"
  | "LOCATION_REQUIRED"
  | "INVALID_POSTAL_CODE"
  | "INVALID_STATE";

export interface CnpjSuggestionValidationIssue {
  code: CnpjSuggestionValidationIssueCode;
  field: "name" | "location" | "postalCode" | "state";
  message: string;
}

export interface NormalizedCnpjSuggestionQuery {
  name: string | null;
  legalName: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
}

export interface InternalCnpjSuggestionSource {
  source: InternalCnpjSource;
  sourceId: string;
}

export interface InternalCnpjSuggestion {
  cnpj: string;
  name: string | null;
  legalName: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
  /** Deterministic score between 0 and 1. */
  confidence: number;
  /** Score between 0 and 1 for every query field used in the calculation. */
  fieldScores: Partial<Record<CnpjSuggestionField, number>>;
  /** Exact BBOS records that supplied this CNPJ, preserved after deduplication. */
  sources: InternalCnpjSuggestionSource[];
}

export interface InternalCnpjSuggestionResult {
  validQuery: boolean;
  normalizedQuery: NormalizedCnpjSuggestionQuery;
  issues: CnpjSuggestionValidationIssue[];
  suggestions: InternalCnpjSuggestion[];
  discardedCandidates: number;
}

export const TRUSTED_INTERNAL_TAX_ID_VERIFICATION_STATUSES = [
  "VERIFIED_ACTIVE",
  "CONFIRMED_INTERNAL",
] as const;

export function isTrustedInternalTaxIdVerificationStatus(
  value: unknown,
): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  return (
    TRUSTED_INTERNAL_TAX_ID_VERIFICATION_STATUSES as readonly string[]
  ).includes(normalized);
}

export function selectTaxIdSuggestionSnapshotRows<
  T extends { status?: string | null },
>(rows: readonly T[], limit = 3): T[] {
  const active = rows.filter((row) => {
    const status = String(row.status ?? "")
      .trim()
      .toUpperCase();
    return status === "DRAFT" || status === "SELECTED";
  });

  if (active.length > 0) return active.slice(0, Math.max(0, limit));

  const confirmed = rows.find(
    (row) =>
      String(row.status ?? "")
        .trim()
        .toUpperCase() === "CONFIRMED",
  );
  return confirmed ? [confirmed] : [];
}

export function canUpdateInternalTaxIdRejectionMetadata(
  verificationStatus: unknown,
  verificationSource: unknown,
): boolean {
  if (
    String(verificationStatus ?? "")
      .trim()
      .toUpperCase() !== "NOT_VERIFIED"
  )
    return false;

  const source = String(verificationSource ?? "")
    .trim()
    .toUpperCase();
  return (
    source.length === 0 ||
    source === "BBOS_INTERNAL_NO_MATCH" ||
    source === "BBOS_INTERNAL_MANUAL_ENTRY"
  );
}

const FIELD_WEIGHTS: Record<CnpjSuggestionField, number> = {
  NAME: 0.3,
  LEGAL_NAME: 0.25,
  ADDRESS: 0.18,
  POSTAL_CODE: 0.14,
  CITY: 0.08,
  STATE: 0.05,
};

const LEGAL_NAME_STOP_WORDS = new Set([
  "eireli",
  "epp",
  "ltda",
  "limitada",
  "me",
  "sa",
  "sociedade",
]);

const cleanOriginalText = (value: string | null | undefined) => {
  const cleaned = value?.trim().replace(/\s+/g, " ") ?? "";
  return cleaned || null;
};

export function normalizeSuggestionText(
  value: string | null | undefined,
): string | null {
  const normalized = (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return normalized || null;
}

export function normalizePostalCode(
  value: string | null | undefined,
): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits || null;
}

export function normalizeCnpj(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits || null;
}

export function normalizeState(
  value: string | null | undefined,
): string | null {
  const state = (value ?? "")
    .trim()
    .toLocaleUpperCase("pt-BR")
    .replace(/[^A-Z]/g, "");
  return state || null;
}

export function normalizeCnpjSuggestionQuery(
  input: InternalCnpjSuggestionQueryInput,
): NormalizedCnpjSuggestionQuery {
  return {
    name: normalizeSuggestionText(input.name),
    legalName: normalizeSuggestionText(input.legalName),
    address: normalizeSuggestionText(input.address),
    postalCode: normalizePostalCode(input.postalCode),
    city: normalizeSuggestionText(input.city),
    state: normalizeState(input.state),
  };
}

export function validateCnpjSuggestionQuery(
  input: InternalCnpjSuggestionQueryInput,
): {
  normalizedQuery: NormalizedCnpjSuggestionQuery;
  issues: CnpjSuggestionValidationIssue[];
} {
  const normalizedQuery = normalizeCnpjSuggestionQuery(input);
  const issues: CnpjSuggestionValidationIssue[] = [];

  if (!normalizedQuery.name && !normalizedQuery.legalName) {
    issues.push({
      code: "NAME_REQUIRED",
      field: "name",
      message: "Informe o nome ou a razão social para sugerir um CNPJ.",
    });
  }

  if (
    !normalizedQuery.address &&
    !normalizedQuery.postalCode &&
    !normalizedQuery.city
  ) {
    issues.push({
      code: "LOCATION_REQUIRED",
      field: "location",
      message:
        "Informe ao menos endereço, CEP ou cidade para confirmar a localização.",
    });
  }

  if (normalizedQuery.postalCode && normalizedQuery.postalCode.length !== 8) {
    issues.push({
      code: "INVALID_POSTAL_CODE",
      field: "postalCode",
      message: "O CEP deve conter 8 dígitos.",
    });
  }

  if (normalizedQuery.state && normalizedQuery.state.length !== 2) {
    issues.push({
      code: "INVALID_STATE",
      field: "state",
      message: "A UF deve conter 2 letras.",
    });
  }

  return { normalizedQuery, issues };
}

const tokens = (value: string, ignoreLegalWords = false) => {
  const values = value.split(" ").filter(Boolean);
  return new Set(
    ignoreLegalWords
      ? values.filter((token) => !LEGAL_NAME_STOP_WORDS.has(token))
      : values,
  );
};

function textSimilarity(
  left: string | null,
  right: string | null,
  ignoreLegalWords = false,
): number {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftTokens = tokens(left, ignoreLegalWords);
  const rightTokens = tokens(right, ignoreLegalWords);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }

  if (intersection === 0) return 0;
  const dice = (2 * intersection) / (leftTokens.size + rightTokens.size);
  const containment =
    intersection / Math.min(leftTokens.size, rightTokens.size);
  const prefix = left.startsWith(right) || right.startsWith(left) ? 1 : 0;
  return roundScore(dice * 0.65 + containment * 0.25 + prefix * 0.1);
}

const bestSimilarity = (
  queries: Array<string | null>,
  candidates: Array<string | null>,
  ignoreLegalWords = false,
) => {
  let best = 0;
  for (const query of queries) {
    for (const candidate of candidates) {
      best = Math.max(best, textSimilarity(query, candidate, ignoreLegalWords));
    }
  }
  return best;
};

const roundScore = (value: number) => Math.round(value * 10_000) / 10_000;

interface NormalizedCandidate {
  cnpj: string;
  name: string | null;
  legalName: string | null;
  normalizedName: string | null;
  normalizedLegalName: string | null;
  address: string | null;
  normalizedAddress: string | null;
  postalCode: string | null;
  city: string | null;
  normalizedCity: string | null;
  state: string | null;
  source: InternalCnpjSource;
  sourceId: string;
}

function normalizeCandidate(
  input: InternalCnpjCandidateInput,
): NormalizedCandidate | null {
  const cnpj = normalizeCnpj(input.cnpj);
  const sourceId = input.sourceId.trim();
  if (
    !cnpj ||
    !isValidCnpj(cnpj) ||
    !sourceId ||
    !(INTERNAL_CNPJ_SOURCES as readonly string[]).includes(input.source)
  ) {
    return null;
  }

  return {
    cnpj,
    name: cleanOriginalText(input.name),
    legalName: cleanOriginalText(input.legalName),
    normalizedName: normalizeSuggestionText(input.name),
    normalizedLegalName: normalizeSuggestionText(input.legalName),
    address: cleanOriginalText(input.address),
    normalizedAddress: normalizeSuggestionText(input.address),
    postalCode: normalizePostalCode(input.postalCode),
    city: cleanOriginalText(input.city),
    normalizedCity: normalizeSuggestionText(input.city),
    state: normalizeState(input.state),
    source: input.source,
    sourceId,
  };
}

function scoreCandidate(
  query: NormalizedCnpjSuggestionQuery,
  candidate: NormalizedCandidate,
): InternalCnpjSuggestion {
  const fieldScores: Partial<Record<CnpjSuggestionField, number>> = {};
  const candidateNames = [
    candidate.normalizedName,
    candidate.normalizedLegalName,
  ];

  if (query.name) {
    fieldScores.NAME = bestSimilarity([query.name], candidateNames, true);
  }
  if (query.legalName) {
    fieldScores.LEGAL_NAME = bestSimilarity(
      [query.legalName],
      [candidate.normalizedLegalName, candidate.normalizedName],
      true,
    );
  }
  if (query.address) {
    fieldScores.ADDRESS = textSimilarity(
      query.address,
      candidate.normalizedAddress,
    );
  }
  if (query.postalCode) {
    fieldScores.POSTAL_CODE = query.postalCode === candidate.postalCode ? 1 : 0;
  }
  if (query.city) {
    fieldScores.CITY = textSimilarity(query.city, candidate.normalizedCity);
  }
  if (query.state) {
    fieldScores.STATE = query.state === candidate.state ? 1 : 0;
  }

  let weightedScore = 0;
  let availableWeight = 0;
  for (const field of Object.keys(fieldScores) as CnpjSuggestionField[]) {
    weightedScore += (fieldScores[field] ?? 0) * FIELD_WEIGHTS[field];
    availableWeight += FIELD_WEIGHTS[field];
  }

  const rawConfidence =
    availableWeight > 0 ? weightedScore / availableWeight : 0;
  const postalCodeMatched = fieldScores.POSTAL_CODE === 1;
  const addressMatched = (fieldScores.ADDRESS ?? 0) >= 0.6;
  const cityMatched = (fieldScores.CITY ?? 0) >= 0.8;

  // A matching name is never enough. CEP is the strongest location signal;
  // address allows a high-confidence draft; city alone remains deliberately
  // capped because common business names can coexist in the same city. A
  // candidate without a meaningful location match stays below the minimum
  // threshold and is discarded by suggestInternalCnpjs.
  const locationConfidenceCap = postalCodeMatched
    ? 1
    : addressMatched
      ? 0.92
      : cityMatched
        ? 0.78
        : 0.44;

  return {
    cnpj: candidate.cnpj,
    name: candidate.name,
    legalName: candidate.legalName,
    address: candidate.address,
    postalCode: candidate.postalCode,
    city: candidate.city,
    state: candidate.state,
    confidence: roundScore(Math.min(rawConfidence, locationConfidenceCap)),
    fieldScores,
    sources: [
      {
        source: candidate.source,
        sourceId: candidate.sourceId,
      },
    ],
  };
}

const sourceKey = (source: InternalCnpjSuggestionSource) =>
  `${source.source}:${source.sourceId}`;

const compareSources = (
  left: InternalCnpjSuggestionSource,
  right: InternalCnpjSuggestionSource,
) => sourceKey(left).localeCompare(sourceKey(right), "pt-BR");

const completeness = (suggestion: InternalCnpjSuggestion) =>
  [
    suggestion.name,
    suggestion.legalName,
    suggestion.address,
    suggestion.postalCode,
    suggestion.city,
    suggestion.state,
  ].filter(Boolean).length;

function mergeDuplicate(
  current: InternalCnpjSuggestion,
  incoming: InternalCnpjSuggestion,
): InternalCnpjSuggestion {
  const incomingIsBetter =
    incoming.confidence > current.confidence ||
    (incoming.confidence === current.confidence &&
      completeness(incoming) > completeness(current));
  const selected = incomingIsBetter ? incoming : current;
  const uniqueSources = new Map<string, InternalCnpjSuggestionSource>();
  for (const source of [...current.sources, ...incoming.sources]) {
    uniqueSources.set(sourceKey(source), source);
  }

  return {
    ...selected,
    sources: [...uniqueSources.values()].sort(compareSources),
  };
}

/**
 * Ranks valid CNPJs already present in BBOS. Invalid candidates are ignored,
 * repeated CNPJs are merged and at most three suggestions are returned.
 */
export function suggestInternalCnpjs(
  queryInput: InternalCnpjSuggestionQueryInput,
  candidateInputs: readonly InternalCnpjCandidateInput[],
): InternalCnpjSuggestionResult {
  const { normalizedQuery, issues } = validateCnpjSuggestionQuery(queryInput);
  if (issues.length > 0) {
    return {
      validQuery: false,
      normalizedQuery,
      issues,
      suggestions: [],
      discardedCandidates: 0,
    };
  }

  const deduplicated = new Map<string, InternalCnpjSuggestion>();
  let discardedCandidates = 0;

  for (const candidateInput of candidateInputs) {
    const candidate = normalizeCandidate(candidateInput);
    if (!candidate) {
      discardedCandidates += 1;
      continue;
    }

    const suggestion = scoreCandidate(normalizedQuery, candidate);
    if (suggestion.confidence < 0.45) {
      discardedCandidates += 1;
      continue;
    }

    const existing = deduplicated.get(suggestion.cnpj);
    deduplicated.set(
      suggestion.cnpj,
      existing ? mergeDuplicate(existing, suggestion) : suggestion,
    );
  }

  const suggestions = [...deduplicated.values()]
    .sort(
      (left, right) =>
        right.confidence - left.confidence ||
        left.cnpj.localeCompare(right.cnpj),
    )
    .slice(0, 3);

  return {
    validQuery: true,
    normalizedQuery,
    issues: [],
    suggestions,
    discardedCandidates,
  };
}
