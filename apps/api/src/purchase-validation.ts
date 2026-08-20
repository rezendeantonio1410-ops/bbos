export type ApprovalValidationPurchase = {
  supplier?: { id?: string | null; name?: string | null; taxId?: string | null; city?: string | null; state?: string | null } | null;
  supplierId?: string | null;
  species?: string | null;
  harvest?: string | null;
  contractedWeightKg?: number | string | { toString(): string } | null;
  pricePerKg?: number | string | { toString(): string } | null;
  totalValue?: number | string | { toString(): string } | null;
  paymentTermType?: string | null;
  expectedAt?: Date | string | null;
  process?: string | null;
  contractedScreen?: string | null;
  maxMoisturePercent?: number | string | { toString(): string } | null;
  qualityCategory?: string | null;
};

export function missingPurchaseApprovalFields(purchase: ApprovalValidationPurchase) {
  const missing: string[] = [];
  if (!purchase.supplierId || !purchase.supplier?.id) missing.push("Fornecedor");
  if (!purchase.supplier?.name) missing.push("Nome/razão social do fornecedor");
  if (!purchase.supplier?.taxId) missing.push("CPF/CNPJ do fornecedor");
  if (!purchase.supplier?.city) missing.push("Município do fornecedor");
  if (!purchase.supplier?.state) missing.push("Estado do fornecedor");
  if (!purchase.species) missing.push("Espécie");
  if (!purchase.harvest) missing.push("Safra");
  if (!purchase.contractedWeightKg || Number(purchase.contractedWeightKg) <= 0) missing.push("Quantidade contratada");
  if ((!purchase.pricePerKg || Number(purchase.pricePerKg) <= 0) && (!purchase.totalValue || Number(purchase.totalValue) <= 0)) missing.push("Preço ou valor total");
  if (!purchase.paymentTermType) missing.push("Condição de pagamento");
  if (!purchase.expectedAt) missing.push("Data/período de entrega");
  if (purchase.maxMoisturePercent != null && (Number(purchase.maxMoisturePercent) < 10 || Number(purchase.maxMoisturePercent) > 12.5)) missing.push("Umidade máxima entre 10,0% e 12,5%");
  const quality = (purchase.qualityCategory ?? "").toUpperCase();
  if (!purchase.process) missing.push("Processo");
  if (["ESPECIAL", "GOURMET", "SPECIAL"].some((value) => quality.includes(value))) {
    if (!purchase.contractedScreen) missing.push("Peneira");
    if (purchase.maxMoisturePercent == null) missing.push("Umidade máxima");
  }
  return [...new Set(missing)];
}
