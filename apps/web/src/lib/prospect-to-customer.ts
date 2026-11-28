import { normalizeCustomerSegment } from "@bbos/shared";
// Prospect → cliente: o que a visita já levantou vira o cadastro do cliente,
// sem digitar de novo. O pedido de crédito sai junto, se o vendedor quiser.

export type ProspectSource = {
  name: string; taxId: string | null; legalName: string | null; tradeName: string | null;
  phone: string | null; email: string | null; postalCode: string | null; address: string | null;
  addressNumber: string | null; district: string | null; city: string | null; state: string | null;
  segment?: string | null; monthlyVolumeKg?: number | null;
  visits?: Array<{ recordedByName: string; visitAt: string; facts: string }>;
};

export type CustomerDraft = {
  tradeName: string; legalName: string; taxId: string; email: string; phone: string;
  postalCode: string; address: string; addressNumber: string; addressComplement: string;
  district: string; city: string; state: string;
  stateRegistrationType: "NUMBER" | "EXEMPT" | "NON_TAXPAYER"; stateRegistration: string;
  paymentTerms: string;
  askCredit: boolean; requestedLimit: string; requestedTerms: string; monthlyVolume: string; rationale: string;
};

export function customerDraftFromProspect(p: ProspectSource): CustomerDraft {
  const last = [...(p.visits ?? [])].sort((a, b) => b.visitAt.localeCompare(a.visitAt))[0];
  const volume = p.monthlyVolumeKg ? `Consumo estimado de ${String(p.monthlyVolumeKg).replace(".", ",")} kg de café por mês.` : "";
  const visit = last ? `Visita de ${last.recordedByName} em ${new Date(last.visitAt).toLocaleDateString("pt-BR")}: ${last.facts}` : "";
  return {
    tradeName: p.tradeName || p.name,
    legalName: p.legalName ?? "",
    taxId: p.taxId ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    postalCode: p.postalCode ?? "",
    address: p.address ?? "",
    addressNumber: p.addressNumber ?? "",
    addressComplement: "",
    district: p.district ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    stateRegistrationType: "EXEMPT",
    stateRegistration: "",
    paymentTerms: "28 dias",
    askCredit: true,
    requestedLimit: "",
    requestedTerms: "28 dias",
    monthlyVolume: "",
    rationale: [volume, visit].filter(Boolean).join(" ").slice(0, 1500),
  };
}

/** O que falta para o cadastro passar na validação fiscal; lista vazia = pode enviar. */
export function missingForCustomer(d: CustomerDraft) {
  const missing: string[] = [];
  const doc = d.taxId.replace(/[^0-9A-Za-z]/g, "");
  if (doc.length !== 11 && doc.length !== 14) missing.push("CNPJ ou CPF");
  if (doc.length === 14 && !d.legalName.trim()) missing.push("razão social");
  if (d.postalCode.replace(/\D/g, "").length !== 8) missing.push("CEP");
  if (!d.address.trim()) missing.push("rua");
  if (!d.addressNumber.trim()) missing.push("número");
  if (!d.district.trim()) missing.push("bairro");
  if (!d.city.trim()) missing.push("cidade");
  if (!/^[A-Za-z]{2}$/.test(d.state.trim())) missing.push("UF");
  if (d.stateRegistrationType === "NUMBER" && !d.stateRegistration.replace(/\D/g, "")) missing.push("inscrição estadual");
  if (d.askCredit) {
    if (!(Number(d.requestedLimit.replace(/\./g, "").replace(",", ".")) > 0)) missing.push("limite de crédito");
    if (!d.rationale.trim()) missing.push("justificativa do crédito");
  }
  return missing;
}

export function parseMoneyInput(value: string) {
  const n = Number(value.replace(/[^\d,.]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
