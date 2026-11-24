import { isValidCnpj, onlyDigits } from "./supplier-verification";

/**
 * Public company registry lookup (Receita Federal data served by BrasilAPI).
 * Read-only helper to pre-fill registrations: users still review every field.
 * The IE comes from the secondary source (cnpj.ws) when published there.
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
  /** IEs found in the public registry (may be empty). Always user-reviewed. */
  stateRegistrations: Array<{ number: string; active: boolean; state: string | null }>;
  /** Active IE of the company's own UF, when one exists. */
  suggestedStateRegistration: string | null;
  /** Everything else the free public registry publishes, shown to the user. */
  details: CnpjRegistryDetails;
  source: "BRASILAPI_RECEITA_FEDERAL" | "CNPJ_WS_RECEITA_FEDERAL";
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

const flag = (value: unknown): boolean | null =>
  value === true || value === "Sim" || value === "S" ? true : value === false || value === "Não" || value === "N" ? false : null;
const amount = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const activity = (code: unknown, description: unknown) => {
  const c = onlyDigits(String(code ?? ""));
  const d = text(description, 200);
  return c && d && c !== "0" ? { code: c, description: d } : null;
};
const isActivity = (value: { code: string; description: string } | null): value is { code: string; description: string } => value !== null;

export function mapBrasilApiDetails(raw: any): CnpjRegistryDetails {
  const phone2 = onlyDigits(String(raw?.ddd_telefone_2 ?? ""));
  return {
    openingDate: text(raw?.data_inicio_atividade, 10),
    statusReason: text(raw?.descricao_motivo_situacao_cadastral, 120),
    legalNature: text(raw?.natureza_juridica, 120),
    companySize: text(raw?.porte ?? raw?.descricao_porte, 60),
    shareCapital: amount(raw?.capital_social),
    mainActivity: activity(raw?.cnae_fiscal, raw?.cnae_fiscal_descricao),
    secondaryActivities: (Array.isArray(raw?.cnaes_secundarios) ? raw.cnaes_secundarios : [])
      .map((item: any) => activity(item?.codigo, item?.descricao)).filter(isActivity).slice(0, 60),
    simplesOptant: flag(raw?.opcao_pelo_simples),
    simplesSince: text(raw?.data_opcao_pelo_simples, 10),
    meiOptant: flag(raw?.opcao_pelo_mei),
    secondaryPhone: phone2.length >= 10 ? phone2 : null,
    partners: (Array.isArray(raw?.qsa) ? raw.qsa : [])
      .map((item: any) => ({ name: text(item?.nome_socio, 160) ?? "", role: text(item?.qualificacao_socio, 80), since: text(item?.data_entrada_sociedade, 10) }))
      .filter((item: { name: string }) => item.name)
      .slice(0, 40),
  };
}

export function mapCnpjWsDetails(raw: any): CnpjRegistryDetails {
  const e = raw?.estabelecimento ?? {};
  const phone2 = onlyDigits(`${e?.ddd2 ?? ""}${e?.telefone2 ?? ""}`);
  return {
    openingDate: text(e?.data_inicio_atividade, 10),
    statusReason: text(e?.motivo_situacao_cadastral?.descricao, 120),
    legalNature: text(raw?.natureza_juridica?.descricao, 120),
    companySize: text(raw?.porte?.descricao, 60),
    shareCapital: amount(raw?.capital_social),
    mainActivity: activity(e?.atividade_principal?.id ?? e?.atividade_principal?.subclasse, e?.atividade_principal?.descricao),
    secondaryActivities: (Array.isArray(e?.atividades_secundarias) ? e.atividades_secundarias : [])
      .map((item: any) => activity(item?.id ?? item?.subclasse, item?.descricao)).filter(isActivity).slice(0, 60),
    simplesOptant: flag(raw?.simples?.simples),
    simplesSince: text(raw?.simples?.data_opcao_simples, 10),
    meiOptant: flag(raw?.simples?.mei),
    secondaryPhone: phone2.length >= 10 ? phone2 : null,
    partners: (Array.isArray(raw?.socios) ? raw.socios : [])
      .map((item: any) => ({ name: text(item?.nome, 160) ?? "", role: text(item?.qualificacao_socio?.descricao, 80), since: text(item?.data_entrada, 10) }))
      .filter((item: { name: string }) => item.name)
      .slice(0, 40),
  };
}

/** Primary details win; empty primary fields take the secondary source's value. */
export function mergeCnpjDetails(primary: CnpjRegistryDetails, secondary?: CnpjRegistryDetails | null): CnpjRegistryDetails {
  if (!secondary) return primary;
  const pick = <K extends keyof CnpjRegistryDetails>(key: K): CnpjRegistryDetails[K] => {
    const value = primary[key];
    return (Array.isArray(value) ? value.length > 0 : value !== null) ? value : secondary[key];
  };
  return {
    openingDate: pick("openingDate"), statusReason: pick("statusReason"), legalNature: pick("legalNature"),
    companySize: pick("companySize"), shareCapital: pick("shareCapital"), mainActivity: pick("mainActivity"),
    secondaryActivities: pick("secondaryActivities"), simplesOptant: pick("simplesOptant"), simplesSince: pick("simplesSince"),
    meiOptant: pick("meiOptant"), secondaryPhone: pick("secondaryPhone"), partners: pick("partners"),
  };
}

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
    stateRegistrations: [],
    suggestedStateRegistration: null,
    details: mapBrasilApiDetails(raw),
    source: "BRASILAPI_RECEITA_FEDERAL",
  };
}

function parseStateRegistrations(raw: any) {
  const list = Array.isArray(raw?.estabelecimento?.inscricoes_estaduais) ? raw.estabelecimento.inscricoes_estaduais : [];
  return list
    .map((item: any) => ({
      number: onlyDigits(String(item?.inscricao_estadual ?? "")),
      active: item?.ativo === true,
      state: text(item?.estado?.sigla, 2)?.toUpperCase() ?? null,
    }))
    .filter((item: { number: string }) => item.number.length >= 2 && item.number.length <= 14)
    .slice(0, 30);
}

export function suggestStateRegistration(
  registrations: CnpjRegistryRecord["stateRegistrations"],
  state: string | null,
): string | null {
  const active = registrations.filter((item) => item.active);
  return (active.find((item) => item.state === state) ?? (active.length === 1 ? active[0] : undefined))?.number ?? null;
}

/** publica.cnpj.ws (Receita Federal + state registrations) → BBOS record. */
export function mapCnpjWs(raw: any): CnpjRegistryRecord {
  const e = raw?.estabelecimento ?? {};
  const cnpj = onlyDigits(String(e?.cnpj ?? ""));
  const legalName = text(raw?.razao_social, 200);
  if (cnpj.length !== 14 || !legalName)
    throw new CnpjLookupError("UNAVAILABLE", "Resposta do cadastro de CNPJ incompleta.");
  const status = (text(e?.situacao_cadastral, 40) ?? "DESCONHECIDA").toUpperCase();
  const streetType = text(e?.tipo_logradouro, 30);
  const street = text(e?.logradouro, 160);
  const state = text(e?.estado?.sigla, 2)?.toUpperCase() ?? null;
  const postalCode = onlyDigits(String(e?.cep ?? ""));
  const phone = onlyDigits(`${e?.ddd1 ?? ""}${e?.telefone1 ?? ""}`);
  const email = text(e?.email, 254);
  const stateRegistrations = parseStateRegistrations(raw);
  return {
    cnpj,
    legalName,
    tradeName: text(e?.nome_fantasia, 200),
    registrationStatus: status,
    active: status === "ATIVA",
    statusDate: text(e?.data_situacao_cadastral, 10),
    postalCode: postalCode.length === 8 ? postalCode : null,
    street: street && streetType && !street.toUpperCase().startsWith(streetType.toUpperCase()) ? `${streetType} ${street}` : street,
    number: text(e?.numero, 30),
    complement: text(e?.complemento, 120),
    district: text(e?.bairro, 120),
    city: text(e?.cidade?.nome, 120),
    state: state && /^[A-Z]{2}$/.test(state) ? state : null,
    phone: phone.length >= 10 ? phone : null,
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.toLowerCase() : null,
    stateRegistrations,
    suggestedStateRegistration: suggestStateRegistration(stateRegistrations, state),
    details: mapCnpjWsDetails(raw),
    source: "CNPJ_WS_RECEITA_FEDERAL",
  };
}

type FetchLike = (url: string, init?: any) => Promise<{ status: number; ok: boolean; json(): Promise<any> }>;

export class CnpjRegistryClient {
  private readonly cache = new Map<string, { at: number; value: CnpjRegistryRecord }>();
  private secondaryLastCall = 0;
  constructor(
    private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init) as any,
    private readonly ttlMs = 24 * 60 * 60 * 1000,
    private readonly baseUrl = process.env.BBOS_CNPJ_REGISTRY_URL?.trim() || "https://brasilapi.com.br/api/cnpj/v1",
    private readonly secondaryUrl = process.env.BBOS_CNPJ_SECONDARY_URL?.trim() || "https://publica.cnpj.ws/cnpj",
    // publica.cnpj.ws allows ~3 requests/minute per IP.
    private readonly secondaryMinIntervalMs = 21_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private async request(url: string, timeoutMs: number) {
    return this.fetchImpl(url, {
      headers: { accept: "application/json", "user-agent": "BBOS cadastro" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  /** Best-effort secondary source; null when throttled, missing or failing. */
  private async secondary(cnpj: string): Promise<CnpjRegistryRecord | null> {
    if (!this.secondaryUrl || this.now() - this.secondaryLastCall < this.secondaryMinIntervalMs) return null;
    this.secondaryLastCall = this.now();
    try {
      const response = await this.request(`${this.secondaryUrl}/${cnpj}`, 6000);
      if (!response.ok) return null;
      return mapCnpjWs(await response.json());
    } catch {
      return null;
    }
  }

  async lookup(input: string): Promise<CnpjRegistryRecord> {
    const cnpj = onlyDigits(input);
    if (!isValidCnpj(cnpj)) throw new CnpjLookupError("INVALID", "CNPJ inválido. Confira os dígitos.");
    const cached = this.cache.get(cnpj);
    if (cached && this.now() - cached.at < this.ttlMs) return cached.value;
    let primary: CnpjRegistryRecord | null = null;
    let notFound = false;
    try {
      const response = await this.request(`${this.baseUrl}/${cnpj}`, 8000);
      if (response.status === 404) notFound = true;
      else if (response.ok) primary = mapBrasilApiCnpj(await response.json());
    } catch {
      primary = null;
    }
    const secondary = await this.secondary(cnpj);
    let record: CnpjRegistryRecord;
    if (primary) {
      // Enrich the primary record with the state registrations, if any.
      const registrations = secondary?.stateRegistrations ?? [];
      record = {
        ...primary,
        stateRegistrations: registrations,
        suggestedStateRegistration: suggestStateRegistration(registrations, primary.state),
        details: mergeCnpjDetails(primary.details, secondary?.details),
      };
    } else if (secondary) {
      record = secondary;
    } else if (notFound) {
      throw new CnpjLookupError("NOT_FOUND", "CNPJ não encontrado na Receita Federal.");
    } else {
      throw new CnpjLookupError("UNAVAILABLE", "Consulta de CNPJ indisponível agora. Preencha manualmente.");
    }
    if (this.cache.size > 1000) this.cache.clear();
    this.cache.set(cnpj, { at: this.now(), value: record });
    return record;
  }
}
