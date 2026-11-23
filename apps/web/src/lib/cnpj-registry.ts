/**
 * CNPJ lookup in the public Receita Federal registry (served by the BBOS API
 * through BrasilAPI). Pre-fills registrations; the user still reviews every
 * field. State registration (IE) is not part of this data and stays manual.
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
    ? `CNPJ ativo na Receita Federal: ${name}. Dados preenchidos.${ie}`
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
