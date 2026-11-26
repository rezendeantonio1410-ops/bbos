/**
 * Separa as linhas do extrato em quatro grupos, sem gravar nada:
 * 1. ALREADY: já registrado no BBOS (mesmo valor, data próxima);
 * 2. SETTLE: paga uma conta em aberto (conta a pagar, parcela de compra,
 *    comissão do corretor), inclusive dois Pix no mesmo dia somados;
 * 3. EXPENSE: saída sem conta no BBOS, com categoria sugerida;
 * 4. INCOME: entrada sem conta a receber, com classificação sugerida.
 */
import type { StatementLine } from "./bank-statement-itau";

export type RecordedPayment = { id: string; direction: "IN" | "OUT"; amount: number; date: string; name: string };
export type OpenPayable = {
  id: string;
  label: string;
  amount: number; // em aberto
  dueDate: string;
  taxId: string; // fornecedor ou corretor
  name: string;
  commission: boolean;
};
export type OpenInstallment = { id: string; label: string; amount: number; taxId: string; name: string };

export type Allocation = { kind: "PAYABLE" | "INSTALLMENT"; id: string; label: string; amount: number; open: number };
export type Settlement = { lines: string[]; allocations: Allocation[]; extra: number; extraCategory: string };
export type Suggestion = { category: string; sure: boolean; note?: string };

export type LinePlan = {
  line: StatementLine;
  group: "ALREADY" | "SETTLE" | "EXPENSE" | "INCOME";
  matchedPayment?: RecordedPayment & { differentPayer: boolean };
  settlement?: Settlement;
  suggestion?: Suggestion;
};

export const EXPENSE_CATEGORIES = [
  "Aluguel", "Água", "Energia elétrica", "Internet / telefonia", "Seguros", "Embalagens",
  "Frete / logística", "Marketing / consultoria", "Site / sistemas", "Comissões", "Tarifas bancárias",
  "Insumos / material de consumo", "Manutenção", "Contabilidade", "Funcionários / salários",
  "Encargos trabalhistas", "Impostos e taxas", "Serviços terceirizados", "Despesa administrativa", "Outras despesas",
] as const;

export const INCOME_CATEGORIES = [
  "Venda sem pedido no BBOS", "Vendas no cartão", "Exportação · amostra", "Exportação · contrato",
  "Aporte do sócio", "Transferência entre contas", "Rendimentos", "Outras entradas",
] as const;

const EXPENSE_RULES: Array<[RegExp, string]> = [
  [/ALUGUEL|IMOBILI/i, "Aluguel"],
  [/SANEPAR|SABESP|SANEAMENTO/i, "Água"],
  [/COPEL|CEMIG|ENEL|ENERGIA/i, "Energia elétrica"],
  [/TELEFONICA|GVT|VIVO|CLARO|\bTIM\b|OI S\.?A|INTERNET/i, "Internet / telefonia"],
  [/SEGURO/i, "Seguros"],
  [/LILLYPLAS|EMBALA/i, "Embalagens"],
  [/COURIER|FEDEX|DHL|CORREIOS|TRANSPORT|MELHOR ENVIO|LOGGI|JADLOG/i, "Frete / logística"],
  [/MAMBA/i, "Marketing / consultoria"],
  [/LWSA|LOCAWEB|HOSTINGER|GOOGLE|REGISTRO\.BR/i, "Site / sistemas"],
  [/^TAR\b|TARIFA/i, "Tarifas bancárias"],
  [/CONTABIL/i, "Contabilidade"],
];

const INCOME_RULES: Array<[RegExp, string]> = [
  [/REND|APLIC/i, "Rendimentos"],
  [/REDECARD|REDE (VISA|MAST|ELO)|CIELO|STONE|GETNET|PAGSEGURO|MERCADO ?PAGO/i, "Vendas no cartão"],
];

const tokens = (value: string) =>
  new Set(value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().split(/[^A-Z0-9]+/).filter((t) => t.length > 2 && !["LTDA", "S/A", "EIRELI", "COM", "DOS", "DAS"].includes(t)));
export const sameName = (a: string, b: string) => {
  const ta = tokens(a);
  return [...tokens(b)].some((t) => ta.has(t));
};
const cents = (value: number) => Math.round(value * 100);
/** Mesmo CPF, ou mesma empresa (raiz do CNPJ: matriz e filiais). */
export const sameTaxId = (a: string, b: string) => Boolean(a && b) && (a === b || (a.length === 14 && b.length === 14 && a.slice(0, 8) === b.slice(0, 8)));
const days = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86_400_000);

export function suggestExpense(line: StatementLine, learned?: string): Suggestion {
  if (learned) return { category: learned, sure: true, note: "como da última vez" };
  const text = `${line.description} ${line.counterparty}`;
  const rule = EXPENSE_RULES.find(([pattern]) => pattern.test(text));
  return rule ? { category: rule[1], sure: true } : { category: "", sure: false };
}

export function suggestIncome(line: StatementLine, ctx: { companyTaxId: string; ownerNames: string[]; learned?: string }): Suggestion {
  if (ctx.learned) return { category: ctx.learned, sure: true, note: "como da última vez" };
  if (line.taxId && line.taxId === ctx.companyTaxId) return { category: "Transferência entre contas", sure: true };
  const text = `${line.description} ${line.counterparty}`;
  const rule = INCOME_RULES.find(([pattern]) => pattern.test(text));
  if (rule) return { category: rule[1], sure: true };
  // Sócio: CPF (11 dígitos) com nome e sobrenome de um usuário da empresa.
  if (line.taxId.length === 11 && ctx.ownerNames.some((name) => [...tokens(name)].filter((t) => tokens(line.counterparty).has(t)).length >= 2))
    return { category: "Aporte do sócio", sure: true };
  return { category: "", sure: false };
}

export function planStatement(
  lines: StatementLine[],
  ctx: {
    payments: RecordedPayment[];
    payables: OpenPayable[];
    installments: OpenInstallment[];
    companyTaxId: string;
    ownerNames: string[];
    learned: Map<string, string>;
  },
): LinePlan[] {
  const plans = new Map<string, LinePlan>();
  const usedPayments = new Set<string>();
  const payables = ctx.payables.map((p) => ({ ...p, left: p.amount }));
  const installments = ctx.installments.map((i) => ({ ...i, left: i.amount }));

  // 1. Já registrado: mesmo valor, até 3 dias de diferença; nome igual primeiro.
  for (const line of lines) {
    const direction = line.amount > 0 ? "IN" : "OUT";
    const candidates = ctx.payments
      .filter((p) => !usedPayments.has(p.id) && p.direction === direction && cents(p.amount) === cents(Math.abs(line.amount)) &&
        (days(p.date, line.date) <= 3 || (days(p.date, line.date) <= 7 && sameName(p.name, line.counterparty))))
      .sort((a, b) => Number(sameName(b.name, line.counterparty)) - Number(sameName(a.name, line.counterparty)) || days(a.date, line.date) - days(b.date, line.date));
    const match = candidates[0];
    if (match) {
      usedPayments.add(match.id);
      plans.set(line.externalId, { line, group: "ALREADY", matchedPayment: { ...match, differentPayer: !sameName(match.name, line.counterparty) } });
    }
  }

  // 2. Saídas que pagam contas abertas, somando os Pix do mesmo dia e favorecido.
  const outGroups = new Map<string, StatementLine[]>();
  for (const line of lines) {
    if (line.amount >= 0 || plans.has(line.externalId) || !line.taxId) continue;
    const key = `${line.date}|${line.taxId}`;
    outGroups.set(key, [...(outGroups.get(key) ?? []), line]);
  }
  for (const group of outGroups.values()) {
    const total = group.reduce((sum, line) => sum - line.amount, 0);
    const taxId = group[0]!.taxId;
    const settlement: Settlement = { lines: group.map((l) => l.externalId), allocations: [], extra: 0, extraCategory: "" };
    // Parcela de compra sem conta a pagar, ou conta a pagar do mesmo CNPJ, com valor exato ou coberto.
    // Valor exato primeiro; depois a conta coberta pelo pagamento (ex.: compra + frete).
    const pick = <T extends { left: number; taxId: string }>(list: T[], extra: (item: T) => boolean = () => true) =>
      list.find((i) => i.left > 0 && extra(i) && sameTaxId(i.taxId, taxId) && cents(i.left) === cents(total)) ??
      list.find((i) => i.left > 0 && extra(i) && sameTaxId(i.taxId, taxId) && cents(i.left) < cents(total));
    const supplierPayable = pick(payables, (p) => !p.commission);
    const exactInstallment = supplierPayable ? undefined : pick(installments);
    const target = supplierPayable ?? exactInstallment;
    if (target) {
      settlement.allocations.push({ kind: supplierPayable ? "PAYABLE" : "INSTALLMENT", id: target.id, label: target.label, amount: target.left, open: target.left });
      settlement.extra = Math.round((total - target.left) * 100) / 100;
      settlement.extraCategory = settlement.extra > 0 ? "Frete / logística" : "";
      target.left = 0;
    } else {
      // Comissão: paga as mais antigas primeiro; o que sobrar fica parcial.
      const commissions = payables.filter((p) => p.commission && p.left > 0 && sameTaxId(p.taxId, taxId)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      let rest = total;
      for (const item of commissions) {
        if (rest <= 0) break;
        const amount = Math.min(item.left, rest);
        settlement.allocations.push({ kind: "PAYABLE", id: item.id, label: item.label, amount: Math.round(amount * 100) / 100, open: item.left });
        item.left = Math.round((item.left - amount) * 100) / 100;
        rest = Math.round((rest - amount) * 100) / 100;
      }
      if (settlement.allocations.length) {
        settlement.extra = rest;
        settlement.extraCategory = rest > 0 ? "Comissões" : "";
      }
    }
    if (settlement.allocations.length)
      for (const line of group) plans.set(line.externalId, { line, group: "SETTLE", settlement });
  }

  // 3 e 4. O resto vira despesa ou entrada com sugestão.
  for (const line of lines) {
    if (plans.has(line.externalId)) continue;
    const learned = line.taxId ? ctx.learned.get(`${line.amount > 0 ? "IN" : "OUT"}:${line.taxId}`) : undefined;
    if (line.amount < 0) plans.set(line.externalId, { line, group: "EXPENSE", suggestion: suggestExpense(line, learned) });
    else plans.set(line.externalId, { line, group: "INCOME", suggestion: suggestIncome(line, { companyTaxId: ctx.companyTaxId, ownerNames: ctx.ownerNames, learned }) });
  }
  return lines.map((line) => plans.get(line.externalId)!);
}
