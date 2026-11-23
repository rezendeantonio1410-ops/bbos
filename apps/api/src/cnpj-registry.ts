import { isValidCnpj, onlyDigits } from "./supplier-verification";

/**
 * Public company registry lookup (Receita Federal data served by BrasilAPI).
 * Read-only helper to pre-fill registrations: users still review every field.
 * State registration (IE) is NOT part of this data and stays manual.
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
  source: "BRASILAPI_RECEITA_FEDERAL";
};

export class CnpjLookupError extends Error {
  constructor(
    readonly code: "INVALID" | "NOT_FOUND" | "UNAVAILABLE",
    message: string,
  ) {
    super(message);
  }
}

const text = (value: unknown, max = 160) => {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : null;
};

export function mapBrasilApiCnpj(raw: any): CnpjRegistryRecord {
  const cnpj = onlyDigits(String(raw?.cnpj ?? ""));
  const legalName = text(raw?.razao_social, 200);
  if (cnpj.length !== 14 || !legalName)
    throw new CnpjLookupError("UNAVAILABLE", "Resposta do cadastro de CNPJ incompleta.");
  const status = text(raw?.descricao_situacao_cadastral, 40) ?? "DESCONHECIDA";
  const streetType = text(raw?.descricao_tipo_de_logradouro, 30);
  const street = text(raw?.logradouro, 160);
  const fullStreet = street && streetType && !street.toUpperCase().startsWith(streetType.toUpperCase())
    ? `${streetType} ${street}` : street;
  const postalCode = onlyDigits(String(raw?.cep ?? ""));
  const state = text(raw?.uf, 2)?.toUpperCase() ?? null;
  const phoneDigits = onlyDigits(String(raw?.ddd_telefone_1 ?? ""));
  const email = text(raw?.email, 254);
  return {
    cnpj,
    legalName,
    tradeName: text(raw?.nome_fantasia, 200),
    registrationStatus: status.toUpperCase(),
    active: status.toUpperCase() === "ATIVA",
    statusDate: text(raw?.data_situacao_cadastral, 10),
    postalCode: postalCode.length === 8 ? postalCode : null,
    street: fullStreet,
    number: text(raw?.numero, 30),
    complement: text(raw?.complemento, 120),
    district: text(raw?.bairro, 120),
    city: text(raw?.municipio, 120),
    state: state && /^[A-Z]{2}$/.test(state) ? state : null,
    phone: phoneDigits.length >= 10 ? phoneDigits : null,
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.toLowerCase() : null,
    source: "BRASILAPI_RECEITA_FEDERAL",
  };
}

type FetchLike = (url: string, init?: any) => Promise<{ status: number; ok: boolean; json(): Promise<any> }>;

export class CnpjRegistryClient {
  private readonly cache = new Map<string, { at: number; value: CnpjRegistryRecord }>();
  constructor(
    private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init) as any,
    private readonly ttlMs = 24 * 60 * 60 * 1000,
    private readonly baseUrl = process.env.BBOS_CNPJ_REGISTRY_URL?.trim() || "https://brasilapi.com.br/api/cnpj/v1",
  ) {}

  async lookup(input: string): Promise<CnpjRegistryRecord> {
    const cnpj = onlyDigits(input);
    if (!isValidCnpj(cnpj)) throw new CnpjLookupError("INVALID", "CNPJ inválido. Confira os dígitos.");
    const cached = this.cache.get(cnpj);
    if (cached && Date.now() - cached.at < this.ttlMs) return cached.value;
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/${cnpj}`, {
        headers: { accept: "application/json", "user-agent": "BBOS cadastro" },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new CnpjLookupError("UNAVAILABLE", "Consulta de CNPJ indisponível agora. Preencha manualmente.");
    }
    if (response.status === 404)
      throw new CnpjLookupError("NOT_FOUND", "CNPJ não encontrado na Receita Federal.");
    if (!response.ok)
      throw new CnpjLookupError("UNAVAILABLE", "Consulta de CNPJ indisponível agora. Preencha manualmente.");
    const record = mapBrasilApiCnpj(await response.json());
    if (this.cache.size > 1000) this.cache.clear();
    this.cache.set(cnpj, { at: Date.now(), value: record });
    return record;
  }
}
