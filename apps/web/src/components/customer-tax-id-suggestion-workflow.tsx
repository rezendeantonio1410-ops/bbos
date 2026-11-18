"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiRoot } from "@/lib/auth-session";
import {
  CustomerTaxIdSuggestionPanel,
  type CustomerTaxIdSuggestion,
} from "@/components/customer-tax-id-suggestion-panel";
import {
  canonicalCnpj,
  confirmedTaxIdFromSnapshot,
  filterTaxIdSuggestionsForSnapshot,
  isConfirmedTaxIdSuggestionStatus,
  isConfirmedTaxIdStatus,
  normalizeTaxIdStatus,
  taxIdSuggestionRejectionRequest,
  type TaxIdSuggestionRejectionReason,
} from "@/components/customer-tax-id-suggestion-contract";

type JsonRecord = Record<string, unknown>;

export type CustomerTaxIdWorkflowCustomer = {
  id: string;
  name: string;
  legalName?: string | null;
  tradeName?: string | null;
  taxId?: string | null;
  countryCode?: string | null;
  postalCode?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  taxIdVerificationStatus?: string | null;
  taxIdVerifiedAt?: string | null;
  taxIdVerificationSource?: string | null;
};

export type CustomerTaxIdSuggestionWorkflowProps = {
  customer: CustomerTaxIdWorkflowCustomer;
  onConfirmed?: (taxId: string) => void | Promise<void>;
  onManualEntry?: () => void;
  autoSearch?: boolean;
};

type ParsedSnapshot = {
  customer: {
    taxId: string;
    verificationStatus: string;
    verificationSource: string;
  };
  suggestions: CustomerTaxIdSuggestion[];
};

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }
  return "";
}

function asReasonList(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const result = value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      const record = asRecord(item);
      if (!record) return "";
      const label = asText(record.label, record.field);
      return label
        ? `${label.charAt(0).toUpperCase()}${label.slice(1)} compatível`
        : "";
    })
    .filter(Boolean);
  return result.length ? result : undefined;
}

function asConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.5;
  const normalized = value > 1 ? value / 100 : value;
  return Math.max(0, Math.min(1, normalized));
}

function buildAddress(record: JsonRecord) {
  const directAddress = asText(record.fullAddress, record.formattedAddress);
  if (directAddress) return directAddress;

  const street = asText(record.address, record.street, record.logradouro);
  const number = asText(record.addressNumber, record.number, record.numero);
  const district = asText(record.district, record.neighborhood, record.bairro);
  const city = asText(record.city, record.cidade);
  const state = asText(record.state, record.uf);
  const postalCode = asText(record.postalCode, record.zipCode, record.cep);
  return [
    [street, number].filter(Boolean).join(", "),
    district,
    [city, state].filter(Boolean).join("/"),
    postalCode,
  ]
    .filter(Boolean)
    .join(" · ");
}

function parseSuggestion(value: unknown): CustomerTaxIdSuggestion | null {
  const record = asRecord(value);
  if (!record) return null;
  const taxId = canonicalCnpj(
    asText(record.taxId, record.cnpj, record.document),
  );
  if (!taxId) return null;

  return {
    id: asText(record.id, record.suggestionId) || null,
    status: normalizeTaxIdStatus(record.status) || null,
    taxId,
    legalName:
      asText(record.legalName, record.razaoSocial, record.name) ||
      "Empresa sugerida",
    tradeName: asText(record.tradeName, record.nomeFantasia) || null,
    address: buildAddress(record) || "Endereço não informado pela fonte",
    sourceLabel:
      asText(record.sourceLabel, record.source, record.origin) ||
      "Fonte interna",
    confidence: asConfidence(record.confidence ?? record.score),
    matchReasons: asReasonList(record.matchReasons ?? record.reasons),
  };
}

function parseSnapshot(payload: unknown): ParsedSnapshot {
  const outer = asRecord(payload);
  const body = asRecord(outer?.data) ?? outer;
  if (!body) {
    throw new Error(
      "A resposta do BBOS veio incompleta. Nenhuma alteração foi aplicada.",
    );
  }

  const customer = asRecord(body.customer);
  const rawSuggestions = body.suggestions ?? body.matches ?? body.results;
  if (!customer || !Array.isArray(rawSuggestions)) {
    throw new Error(
      "A resposta do BBOS veio incompleta. Nenhuma alteração foi aplicada.",
    );
  }

  const customerTaxId = canonicalCnpj(
    asText(customer.taxId, customer.cnpj, customer.document),
  );
  const verificationStatus = normalizeTaxIdStatus(
    asText(customer.taxIdVerificationStatus, customer.verificationStatus),
  );
  const verificationSource = asText(
    customer.taxIdVerificationSource,
    customer.verificationSource,
  );
  const suggestions = filterTaxIdSuggestionsForSnapshot(
    rawSuggestions
      .map(parseSuggestion)
      .filter((item): item is CustomerTaxIdSuggestion => Boolean(item)),
    customerTaxId,
    verificationStatus,
  );

  return {
    customer: {
      taxId: customerTaxId,
      verificationStatus,
      verificationSource,
    },
    suggestions,
  };
}

async function readResponse(response: Response) {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const record = asRecord(payload);
    throw new Error(
      asText(record?.message, record?.error) ||
        "Não foi possível consultar o CNPJ agora.",
    );
  }

  return payload;
}

async function requestSnapshot(path: string, init?: RequestInit) {
  const response = await fetch(`${getApiRoot()}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  return parseSnapshot(await readResponse(response));
}

export function CustomerTaxIdSuggestionWorkflow({
  customer,
  onConfirmed,
  onManualEntry = () => undefined,
  autoSearch = true,
}: CustomerTaxIdSuggestionWorkflowProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [suggestions, setSuggestions] = useState<CustomerTaxIdSuggestion[]>([]);
  const [selectedTaxId, setSelectedTaxId] = useState("");
  const [confirmedTaxId, setConfirmedTaxId] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const applySnapshot = useCallback((snapshot: ParsedSnapshot) => {
    const taxId = canonicalCnpj(snapshot.customer.taxId);
    const verified =
      Boolean(taxId) &&
      isConfirmedTaxIdStatus(snapshot.customer.verificationStatus) &&
      snapshot.suggestions.some(
        (suggestion) =>
          canonicalCnpj(suggestion.taxId) === taxId &&
          isConfirmedTaxIdSuggestionStatus(suggestion.status),
      );
    const nextSuggestions = snapshot.suggestions;
    setSuggestions(nextSuggestions);
    if (verified && taxId) {
      setSelectedTaxId(taxId);
      setConfirmedTaxId(taxId);
    } else {
      setSelectedTaxId("");
      setConfirmedTaxId("");
    }
    return { verified, suggestionCount: nextSuggestions.length };
  }, []);

  const search = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      applySnapshot(
        await requestSnapshot(
          `/customers/${customer.id}/tax-id-suggestions/search`,
          { method: "POST" },
        ),
      );
      setStatus("ready");
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Não foi possível pesquisar o CNPJ.",
      );
      setStatus("error");
    }
  }, [applySnapshot, customer.id]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setStatus("loading");
      setError("");
      setSelectedTaxId("");
      setConfirmedTaxId("");
      setSuggestions([]);

      try {
        const snapshot = await requestSnapshot(
          `/customers/${customer.id}/tax-id-suggestions`,
        );
        if (cancelled) return;
        const result = applySnapshot(snapshot);
        if (!result.verified && result.suggestionCount === 0 && autoSearch) {
          const searched = await requestSnapshot(
            `/customers/${customer.id}/tax-id-suggestions/search`,
            {
              method: "POST",
            },
          );
          if (cancelled) return;
          applySnapshot(searched);
        }
        if (!cancelled) setStatus("ready");
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar as sugestões.",
        );
        setStatus("error");
      }
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [applySnapshot, autoSearch, customer.id]);

  async function confirmSuggestion(suggestion: CustomerTaxIdSuggestion) {
    const suggestionId = suggestion.id?.trim();
    const taxId = canonicalCnpj(suggestion.taxId);
    if (!suggestionId || !taxId) {
      setError(
        "Esta sugestão não possui identificação suficiente. Pesquise novamente ou informe o CNPJ manualmente.",
      );
      return;
    }

    if (
      !window.confirm(
        `Confirma que o CNPJ ${suggestion.taxId} pertence a ${customer.name}? Essa decisão ficará registrada no histórico.`,
      )
    ) {
      return;
    }

    setConfirming(true);
    setError("");
    try {
      const snapshot = await requestSnapshot(
        `/customers/${customer.id}/tax-id-suggestions/${encodeURIComponent(suggestionId)}/confirm`,
        { method: "POST", body: JSON.stringify({ acknowledged: true }) },
      );
      const confirmed = confirmedTaxIdFromSnapshot(snapshot, taxId);
      applySnapshot(snapshot);
      setSelectedTaxId(confirmed);
      setConfirmedTaxId(confirmed);
      setStatus("ready");
      await onConfirmed?.(confirmed);
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "Não foi possível confirmar o CNPJ.",
      );
    } finally {
      setConfirming(false);
    }
  }

  async function rejectSuggestions(
    reason: TaxIdSuggestionRejectionReason,
    afterPersisted?: () => void | Promise<void>,
  ) {
    setConfirming(true);
    setError("");
    try {
      const request = taxIdSuggestionRejectionRequest(customer.id, reason);
      const snapshot = await requestSnapshot(request.path, request.init);
      applySnapshot(snapshot);
      setStatus("ready");
      await afterPersisted?.();
    } catch (rejectError) {
      setError(
        rejectError instanceof Error
          ? rejectError.message
          : "Não foi possível registrar esta decisão. Nenhuma alteração foi aplicada.",
      );
    } finally {
      setConfirming(false);
    }
  }

  return (
    <CustomerTaxIdSuggestionPanel
      status={status}
      suggestions={suggestions}
      selectedTaxId={selectedTaxId}
      confirmedTaxId={confirmedTaxId}
      error={error}
      confirming={confirming}
      onSelect={(suggestion) => {
        setSelectedTaxId(canonicalCnpj(suggestion.taxId));
        setError("");
      }}
      onConfirm={(suggestion) => void confirmSuggestion(suggestion)}
      onSearchAgain={() => void search()}
      onNoneMatch={() => void rejectSuggestions("NONE_MATCH")}
      onManualEntry={() =>
        void rejectSuggestions("MANUAL_ENTRY", onManualEntry)
      }
    />
  );
}
