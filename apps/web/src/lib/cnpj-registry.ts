/**
 * CNPJ lookup in the public Receita Federal registry (served by the BBOS API
 * through BrasilAPI and cnpj.ws, both free). One lookup fills every field the
 * form has and shows the rest of the public data; every field stays editable.
 */
export type CnpjRegistryRecord = {
  cnpj: string;
  legalName: string;
  tradeName: string | null;
  registrationStatus: string;
  active: boolean;
  statusDate: string | null;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  stateRegistrations?: Array<{ number: string; active: boolean; state: string | null }>;
  /** Active IE of the company's UF found in the public registry; user reviews it. */
  suggestedStateRegistration?: string | null;
  details?: CnpjRegistryDetails;
};

export type CnpjRegistryDetails = {
  openingDate: string | null;
  statusReason: string | null;
  legalNature: string | null;
  companySize: string | null;
  shareCapital: number | null;
  mainActivity: { code: string; description: string } | null;
  secondaryActivities: Array<{ code: string; description: string }>;
  simplesOptant: boolean | null;
  simplesSince: string | null;
  meiOptant: boolean | null;
  secondaryPhone: string | null;
  partners: Array<{ name: string; role: string | null; since: string | null }>;
};

export type CnpjLookupOutcome =
  | { kind: "found"; record: CnpjRegistryRecord }
  | { kind: "not-found" | "invalid" | "error"; message: string };

const digits = (value: string) => value.replace(/\D/g, "");

export function isValidCnpjDigits(value: string): boolean {
  const cnpj = digits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const check = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const rest = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0) % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(cnpj[12]) && check(13) === Number(cnpj[13]);
}

export async function lookupCnpjRegistry(
  value: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CnpjLookupOutcome> {
  const cnpj = digits(value);
  if (!isValidCnpjDigits(cnpj)) return { kind: "invalid", message: "CNPJ inválido. Confira os dígitos." };
  try {
    const response = await fetchImpl(`/api/company-registry/cnpj/${cnpj}`, {
      credentials: "include",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    const body = await response.json().catch(() => null);
    if (response.ok && body?.legalName) return { kind: "found", record: body as CnpjRegistryRecord };
    if (response.status === 404) return { kind: "not-found", message: "CNPJ não encontrado na Receita Federal. Confira os números." };
    if (response.status === 400) return { kind: "invalid", message: body?.message ?? "CNPJ inválido." };
    return { kind: "error", message: "Consulta de CNPJ indisponível agora. Preencha manualmente." };
  } catch {
    return { kind: "error", message: "Consulta de CNPJ indisponível agora. Preencha manualmente." };
  }
}

/** Human status for the looked-up company; inactive companies are flagged. */
export function cnpjRegistryStatusText(record: CnpjRegistryRecord): string {
  const name = record.tradeName ? `${record.legalName} (${record.tradeName})` : record.legalName;
  const ie = record.suggestedStateRegistration
    ? ` IE ${record.suggestedStateRegistration} (${record.state ?? "UF"}) encontrada no cadastro público; confira.`
    : " IE não encontrada; informe manualmente, se houver.";
  return record.active
    ? `CNPJ ativo na Receita Federal: ${name}. Dados preenchidos; confira e edite se precisar.${ie}`
    : `Atenção: CNPJ com situação ${record.registrationStatus} na Receita Federal (${name}). Confirme antes de cadastrar.`;
}

/** Fills only empty fields, so anything the user already typed is kept. */
export function fillEmptyFromCnpj<T extends Record<string, string>>(
  current: T,
  record: CnpjRegistryRecord,
  mapping: Partial<Record<keyof T, keyof CnpjRegistryRecord | ((r: CnpjRegistryRecord) => string | null)>>,
): T {
  const next = { ...current };
  for (const [field, source] of Object.entries(mapping) as Array<[keyof T, keyof CnpjRegistryRecord | ((r: CnpjRegistryRecord) => string | null)]>) {
    if (String(next[field] ?? "").trim()) continue;
    const value = typeof source === "function" ? source(record) : record[source as keyof CnpjRegistryRecord];
    if (value != null && String(value).trim()) next[field] = String(value) as T[keyof T];
  }
  return next;
}

type CnpjFieldMapping<T> = Partial<Record<keyof T, keyof CnpjRegistryRecord | ((r: CnpjRegistryRecord) => string | null)>>;

const mappedValue = <T,>(record: CnpjRegistryRecord, source: CnpjFieldMapping<T>[keyof T]) => {
  if (!source) return null;
  const value = typeof source === "function" ? source(record) : record[source as keyof CnpjRegistryRecord];
  return value != null && String(value).trim() ? String(value) : null;
};

/**
 * Applies a looked-up company to a form. A field is replaced when it is empty,
 * when it still holds what the previous lookup put there (another CNPJ was
 * typed), or always when `overwrite` is set (the user clicked "Buscar").
 * Anything the user typed by hand is kept unless they asked to overwrite.
 */
export function applyCnpjRecord<T extends Record<string, string>>(
  current: T,
  record: CnpjRegistryRecord,
  mapping: CnpjFieldMapping<T>,
  options: { previous?: CnpjRegistryRecord | null; overwrite?: boolean } = {},
): T {
  const next = { ...current };
  for (const [field, source] of Object.entries(mapping) as Array<[keyof T, CnpjFieldMapping<T>[keyof T]]>) {
    const value = mappedValue(record, source);
    if (value == null) continue;
    const now = String(next[field] ?? "").trim();
    const fromPrevious = options.previous ? mappedValue(options.previous, source) : null;
    if (options.overwrite || !now || (fromPrevious != null && now === fromPrevious)) next[field] = value as T[keyof T];
  }
  return next;
}

const dateBr = (value: string | null) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

const phoneBr = (value: string | null) => {
  const d = (value ?? "").replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return value;
};

/** Rows for the "Dados da Receita Federal" summary, in reading order. */
export function cnpjRegistrySummary(record: CnpjRegistryRecord): Array<{ label: string; value: string }> {
  const d = record.details;
  const rows: Array<{ label: string; value: string | null | undefined }> = [
    { label: "Situação", value: `${record.registrationStatus}${record.statusDate ? ` desde ${dateBr(record.statusDate)}` : ""}${d?.statusReason && !record.active ? ` (${d.statusReason})` : ""}` },
    { label: "Abertura", value: dateBr(d?.openingDate ?? null) },
    { label: "Natureza jurídica", value: d?.legalNature },
    { label: "Porte", value: d?.companySize },
    {
      label: "Simples Nacional",
      value: d?.meiOptant ? "MEI" : d?.simplesOptant === true ? `Optante${d.simplesSince ? ` desde ${dateBr(d.simplesSince)}` : ""}` : d?.simplesOptant === false ? "Não optante" : null,
    },
    { label: "Capital social", value: d?.shareCapital != null ? d.shareCapital.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null },
    { label: "Atividade principal", value: d?.mainActivity ? `${d.mainActivity.code} · ${d.mainActivity.description}` : null },
    {
      label: "Inscrição estadual",
      value: record.stateRegistrations?.length
        ? record.stateRegistrations.map((item) => `${item.number} (${item.state ?? "UF"}${item.active ? "" : ", inativa"})`).join(", ")
        : null,
    },
    { label: "Outro telefone", value: phoneBr(d?.secondaryPhone ?? null) },
  ];
  return rows.filter((row): row is { label: string; value: string } => Boolean(row.value && String(row.value).trim()));
}
