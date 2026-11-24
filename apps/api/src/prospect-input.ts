import { BadRequestException } from "@nestjs/common";
import { isValidCnpj } from "./supplier-verification";

export const PROSPECT_SEGMENTS = {
  CAFETERIA: "Cafeteria",
  PADARIA_CONFEITARIA: "Padaria / confeitaria",
  POSTO_CONVENIENCIA: "Posto / conveniência",
  RESTAURANTE: "Restaurante",
  HOTEL: "Hotel / pousada",
  EMPRESA: "Empresa / escritório",
  EMPORIO: "Empório / mercado",
  OUTRO: "Outro",
} as const;
export type ProspectSegment = keyof typeof PROSPECT_SEGMENTS;

export const PROSPECT_POTENTIALS = {
  MUITO_ALTA: "Muito alta",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
  A_VERIFICAR: "A verificar",
} as const;
export type ProspectPotential = keyof typeof PROSPECT_POTENTIALS;

export const PROSPECT_STAGES = {
  NAO_CONTATADO: "Não contatado",
  CONTATADO: "Contatado",
  VISITADO: "Visitado",
  DEGUSTACAO: "Degustação",
  PROPOSTA: "Proposta",
  CLIENTE: "Cliente",
  SEM_INTERESSE: "Sem interesse",
} as const;
export type ProspectStage = keyof typeof PROSPECT_STAGES;

export const ESPRESSO_MACHINE = {
  SIM: "Sim",
  NAO: "Não",
  NAO_VERIFICADO: "Não verificado",
} as const;
export type EspressoMachine = keyof typeof ESPRESSO_MACHINE;

/** Lowercase, no accents, single spaces: used for matching and import keys. */
export function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const prospectImportKey = (name: unknown, city: unknown) =>
  `${normalizeText(name)}|${normalizeText(city)}`;

const enumFromLabel = <T extends string>(
  map: Record<T, string>,
  value: unknown,
): T | null => {
  const text = normalizeText(value);
  if (!text) return null;
  for (const [key, label] of Object.entries(map) as Array<[T, string]>)
    if (normalizeText(key) === text || normalizeText(label) === text) return key;
  return null;
};

export function parsePotential(value: unknown): ProspectPotential {
  const text = normalizeText(value);
  if (text.startsWith("muito alta")) return "MUITO_ALTA";
  if (text.startsWith("media alta") || text === "alta") return "ALTA";
  if (text.startsWith("media")) return "MEDIA";
  if (text.startsWith("baixa")) return "BAIXA";
  return enumFromLabel(PROSPECT_POTENTIALS, value) ?? "A_VERIFICAR";
}

export function parseStage(value: unknown): ProspectStage {
  return enumFromLabel(PROSPECT_STAGES, value) ?? "NAO_CONTATADO";
}

export function parseMachine(value: unknown): { machine: EspressoMachine; notes: string | null } {
  const raw = String(value ?? "").trim();
  const text = normalizeText(raw);
  if (!text || text.startsWith("nao verificado")) return { machine: "NAO_VERIFICADO", notes: null };
  if (text.startsWith("sim")) {
    const notes = raw.replace(/^sim\s*[—–\-:·,]*\s*/i, "").trim();
    return { machine: "SIM", notes: notes || null };
  }
  if (text.startsWith("nao")) return { machine: "NAO", notes: null };
  return { machine: "NAO_VERIFICADO", notes: raw };
}

export function inferSegment(
  name: unknown,
  hint?: unknown,
  fallback: ProspectSegment = "OUTRO",
): ProspectSegment {
  const explicit = enumFromLabel(PROSPECT_SEGMENTS, hint);
  if (explicit) return explicit;
  const text = normalizeText(name);
  if (/\b(posto|conveniencia|auto posto)\b/.test(text)) return "POSTO_CONVENIENCIA";
  if (/\b(pao|padaria|panificadora|confeitaria|confeitaria|doce|donut|torteria|eclair|delicia)/.test(text))
    return "PADARIA_CONFEITARIA";
  if (/\b(restaurante|bistro|cantina)\b/.test(text)) return "RESTAURANTE";
  if (/\b(hotel|pousada)\b/.test(text)) return "HOTEL";
  if (/\b(emporio|mercado|mercearia)\b/.test(text)) return "EMPORIO";
  if (/\b(laboratorio|escritorio|clinica|empresa)\b/.test(text)) return "EMPRESA";
  if (/\b(cafe|cafeteria|coffee|cafes)\b/.test(text)) return "CAFETERIA";
  return fallback;
}

export function parseKg(value: unknown): number | null {
  const text = String(value ?? "").trim().replace(/\s*kg.*$/i, "");
  if (!text) return null;
  const number = Number(text.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(number) || number < 0 || number > 100_000) return null;
  return Math.round(number * 100) / 100;
}

/** "R. Foz do Iguaçu, 90" → street + number; keeps text when no number. */
export function splitAddress(value: unknown): { address: string | null; addressNumber: string | null } {
  const text = String(value ?? "").trim();
  if (!text) return { address: null, addressNumber: null };
  const match = /^(.*?),\s*(\d+[A-Za-z0-9/-]*)(?:\s*,\s*(.*))?$/.exec(text);
  if (!match) return { address: text, addressNumber: null };
  return {
    address: match[3] ? `${match[1]} (${match[3]})` : (match[1] ?? text),
    addressNumber: match[2] ?? null,
  };
}

const phoneDigits = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
};

export type ProspectImportRow = {
  importKey: string;
  name: string;
  segment: ProspectSegment;
  city: string | null;
  state: string;
  district: string | null;
  address: string | null;
  addressNumber: string | null;
  phone: string | null;
  contactName: string | null;
  profile: string | null;
  openingHours: string | null;
  potential: ProspectPotential;
  espressoMachine: EspressoMachine;
  machineNotes: string | null;
  currentSupplier: string | null;
  monthlyVolumeKg: number | null;
  stage: ProspectStage;
  notes: string | null;
  /** CNPJ found in the Receita open data; confirmed only at the visit. */
  suggestedTaxId: string | null;
  suggestedTaxIdConfidence: "ALTA" | "MEDIA" | "BAIXA" | null;
  suggestedTaxIdReason: string | null;
};

const HEADERS: Record<string, string[]> = {
  segment: ["segmento"],
  city: ["cidade"],
  name: ["estabelecimento", "posto estabelecimento", "nome"],
  address: ["endereco", "endereco informado"],
  district: ["bairro"],
  phone: ["telefone"],
  contactName: ["contato comprador", "responsavel pelas compras", "contato"],
  profile: ["perfil", "perfil regiao", "estrutura da conveniencia"],
  openingHours: ["horario", "situacao do horario"],
  potential: ["potencial", "potencial comercial", "prioridade"],
  machine: ["maquina espresso", "maquina de cafe"],
  supplier: ["fornecedor atual"],
  kg: ["consumo kg mes", "consumo mensal kg"],
  stage: ["status", "status do contato", "status da prospeccao"],
  notes: ["observacoes"],
  suggestedTaxId: ["cnpj sugerido"],
  confidence: ["confianca"],
  reason: ["motivo"],
};

function parseSuggestion(cnpj: string | null, confidence: string | null, reason: string | null) {
  const digits = (cnpj ?? "").replace(/\D/g, "");
  if (!isValidCnpj(digits)) return { suggestedTaxId: null, suggestedTaxIdConfidence: null, suggestedTaxIdReason: null };
  const level = normalizeText(confidence);
  return {
    suggestedTaxId: digits,
    suggestedTaxIdConfidence: level === "alta" ? "ALTA" : level === "media" ? "MEDIA" : "BAIXA",
    suggestedTaxIdReason: reason ? reason.slice(0, 200) : null,
  } as const;
}

/**
 * Maps spreadsheet rows (first row = headers) into prospects. Accepts the
 * original café and gas-station lists and the unified sheet. Rows without a
 * name are ignored; duplicates (same name + city) keep the first occurrence.
 */
export function mapProspectSheet(
  rows: string[][],
  options: { defaultState?: string } = {},
): { prospects: ProspectImportRow[]; skipped: number; duplicates: number } {
  const [header = [], ...data] = rows;
  const column: Partial<Record<keyof typeof HEADERS, number>> = {};
  header.forEach((title, index) => {
    const key = normalizeText(title);
    for (const [field, names] of Object.entries(HEADERS))
      if (names.includes(key) && column[field as keyof typeof HEADERS] === undefined)
        column[field as keyof typeof HEADERS] = index;
  });
  if (column.name === undefined)
    throw new BadRequestException("A planilha precisa de uma coluna com o nome do estabelecimento.");
  const stationList = normalizeText(header[column.name]) === "posto estabelecimento";
  // The café list has no segment column: unmatched names there are cafés.
  const fallbackSegment: ProspectSegment =
    column.segment === undefined && column.machine !== undefined &&
    normalizeText(header[column.machine]) === "maquina espresso"
      ? "CAFETERIA"
      : "OUTRO";
  const state = String(options.defaultState ?? "PR").trim().toUpperCase().slice(0, 2) || "PR";
  const get = (row: string[], field: keyof typeof HEADERS) => {
    const index = column[field];
    const value = index === undefined ? "" : String(row[index] ?? "").trim();
    return value || null;
  };

  const seen = new Set<string>();
  const prospects: ProspectImportRow[] = [];
  let skipped = 0;
  let duplicates = 0;
  for (const row of data) {
    const name = get(row, "name");
    if (!name) {
      if (row.some((cell) => String(cell ?? "").trim())) skipped++;
      continue;
    }
    const city = get(row, "city")?.replace(/\s*\(confirmar\)\s*$/i, "") ?? null;
    const importKey = prospectImportKey(name, city);
    if (seen.has(importKey)) {
      duplicates++;
      continue;
    }
    seen.add(importKey);
    const { address, addressNumber } = splitAddress(get(row, "address"));
    const machine = parseMachine(get(row, "machine"));
    const district = get(row, "district");
    prospects.push({
      importKey,
      name: name.slice(0, 200),
      segment: stationList ? "POSTO_CONVENIENCIA" : inferSegment(name, get(row, "segment"), fallbackSegment),
      city,
      state,
      district: district && normalizeText(district) !== "nao informado" ? district : null,
      address,
      addressNumber,
      phone: phoneDigits(get(row, "phone")),
      contactName: get(row, "contactName"),
      profile: get(row, "profile"),
      openingHours: get(row, "openingHours"),
      potential: parsePotential(get(row, "potential")),
      espressoMachine: machine.machine,
      machineNotes: machine.notes,
      currentSupplier: get(row, "supplier"),
      monthlyVolumeKg: parseKg(get(row, "kg")),
      stage: parseStage(get(row, "stage")),
      notes: get(row, "notes"),
      ...parseSuggestion(get(row, "suggestedTaxId"), get(row, "confidence"), get(row, "reason")),
    });
  }
  return { prospects, skipped, duplicates };
}

// --------------------------------------------------------------- edit input

const text = (value: unknown, max: number) => {
  const result = String(value ?? "").trim();
  if (result.length > max) throw new BadRequestException(`Texto acima de ${max} caracteres.`);
  return result || null;
};

/** Validates a partial update coming from the visit/confirmation screen. */
export function parseProspectPatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  const texts: Record<string, number> = {
    name: 200, taxId: 18, legalName: 200, tradeName: 200, contactName: 120,
    email: 160, postalCode: 9, address: 200, addressNumber: 20, district: 120,
    city: 120, profile: 200, openingHours: 200, machineNotes: 300,
    currentSupplier: 160, lostReason: 300, notes: 2000, nextAction: 300,
  };
  for (const [field, max] of Object.entries(texts))
    if (field in body) patch[field] = text(body[field], max);
  if ("name" in patch && !patch.name) throw new BadRequestException("Informe o nome do estabelecimento.");
  if ("taxId" in patch && patch.taxId) {
    const digits = String(patch.taxId).replace(/\D/g, "");
    if (!isValidCnpj(digits)) throw new BadRequestException("CNPJ inválido. Confira os dígitos.");
    patch.taxId = digits;
  }
  if ("postalCode" in patch && patch.postalCode)
    patch.postalCode = String(patch.postalCode).replace(/\D/g, "").slice(0, 8);
  if ("phone" in body) patch.phone = phoneDigits(body.phone);
  if ("state" in body) patch.state = text(body.state, 2)?.toUpperCase() ?? null;
  if ("segment" in body) {
    if (!(String(body.segment) in PROSPECT_SEGMENTS)) throw new BadRequestException("Segmento inválido.");
    patch.segment = body.segment;
  }
  if ("potential" in body) {
    if (!(String(body.potential) in PROSPECT_POTENTIALS)) throw new BadRequestException("Potencial inválido.");
    patch.potential = body.potential;
  }
  if ("stage" in body) {
    if (!(String(body.stage) in PROSPECT_STAGES)) throw new BadRequestException("Etapa inválida.");
    patch.stage = body.stage;
  }
  if ("espressoMachine" in body) {
    if (!(String(body.espressoMachine) in ESPRESSO_MACHINE)) throw new BadRequestException("Informe se há máquina de espresso.");
    patch.espressoMachine = body.espressoMachine;
  }
  if ("monthlyVolumeKg" in body) {
    const raw = body.monthlyVolumeKg;
    if (raw === null || raw === "") patch.monthlyVolumeKg = null;
    else {
      const value = typeof raw === "number" ? raw : parseKg(raw);
      if (value === null || !Number.isFinite(value) || value < 0 || value > 100_000)
        throw new BadRequestException("Volume de café inválido (kg por mês).");
      patch.monthlyVolumeKg = Math.round(value * 100) / 100;
    }
  }
  if ("nextActionAt" in body) {
    const raw = String(body.nextActionAt ?? "").trim();
    const date = raw ? new Date(raw) : null;
    if (date && Number.isNaN(date.getTime())) throw new BadRequestException("Data da próxima ação inválida.");
    patch.nextActionAt = date;
  }
  if ("latitude" in body || "longitude" in body) {
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      throw new BadRequestException("Coordenadas inválidas.");
    patch.latitude = lat;
    patch.longitude = lng;
  }
  return patch;
}
