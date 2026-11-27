/**
 * Separa as linhas do extrato em quatro grupos, sem gravar nada:
 * 1. ALREADY: já registrado no BBOS (mesmo valor, data próxima);
 * 2. SETTLE: paga uma conta em aberto (conta a pagar, parcela de compra,
 *    comissão do corretor) ou recebe uma conta a receber em aberto,
 *    inclusive dois Pix no mesmo dia somados;
 * 3. EXPENSE: saída sem conta no BBOS, com categoria sugerida;
 * 4. INCOME: entrada sem conta a receber, com classificação sugerida.
 */
import type { StatementLine } from "./bank-statement-itau";

export type RecordedPayment = { id: string; direction: "IN" | "OUT"; amount: number; date: string; name: string; accountId?: string; accountName?: string };
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

export type OpenReceivable = { id: string; label: string; amount: number; dueDate: string; taxId: string; name: string };
export type Allocation = { kind: "PAYABLE" | "INSTALLMENT" | "RECEIVABLE"; id: string; label: string; amount: number; open: number };
export type Settlement = { lines: string[]; allocations: Allocation[]; extra: number; extraCategory: string };
export type Suggestion = { category: string; sure: boolean; note?: string };

export type LinePlan = {
  line: StatementLine;
  group: "ALREADY" | "SETTLE" | "EXPENSE" | "INCOME";
  matchedPayment?: RecordedPayment & { differentPayer: boolean; otherAccount?: string };
  settlement?: Settlement;
  suggestion?: Suggestion;
};

export const EXPENSE_CATEGORIES = [
  "Aluguel", "Água", "Energia elétrica", "Internet / telefonia", "Seguros", "Embalagens",
  "Frete / logística", "Café verde (compra)", "Marketing / consultoria", "Site / sistemas", "Comissões", "Tarifas bancárias",
  "Insumos / material de consumo", "Manutenção", "Contabilidade", "Funcionários / salários",
  "Encargos trabalhistas", "Impostos e taxas", "Serviços terceirizados", "Despesa administrativa", "Outras despesas",
] as const;

export const INCOME_CATEGORIES = [
  "Venda sem pedido no BBOS", "Repasse Mercado Pago (Mercado Livre e loja)", "Vendas no cartão", "Exportação · amostra", "Exportação · contrato",
  "Aporte do sócio", "Transferência entre contas", "Rendimentos", "Outras entradas",
] as const;

const EXPENSE_RULES: Array<[RegExp, string]> = [
  [/ALUGUEL|IMOBILI/i, "Aluguel"],
  [/SANEPAR|SABESP|SANEAMENTO/i, "Água"],
  [/COPEL|CEMIG|ENEL|ENERGIA/i, "Energia elétrica"],
  [/TELEFONICA|GVT|VIVO|CLARO|\bTIM\b|OI S\.?A|INTERNET/i, "Internet / telefonia"],
  [/SEGURO/i, "Seguros"],
  [/LILLYPLAS|EASYPACK|EMBALA/i, "Embalagens"],
  [/RECEITA FEDERAL|DARF|SIMPLES NACIONAL|PREFEITURA|SEFAZ|DAS\b/i, "Impostos e taxas"],
  [/AGRO ?MERCANTIL|COOPERATIVA|CAFE(S)? (VERDE|ESPECIAIS)|TORREFA/i, "Café verde (compra)"],
  [/COURIER|FEDEX|DHL|CORREIOS|TRANSPORT|MELHOR ENVIO|LOGGI|JADLOG/i, "Frete / logística"],
  [/MAMBA/i, "Marketing / consultoria"],
  [/LWSA|LOCAWEB|HOSTINGER|GOOGLE|REGISTRO\.BR/i, "Site / sistemas"],
  [/^TAR\b|TARIFA/i, "Tarifas bancárias"],
  [/CONTABIL/i, "Contabilidade"],
];

const INCOME_RULES: Array<[RegExp, string]> = [
  [/REND|APLIC/i, "Rendimentos"],
  // Transferência do Mercado Pago para o Itaú: dinheiro do Mercado Livre e da loja online.
  [/MERCADO ?PAGO|MERCADOPAGO|MERCADO ?LIVRE|MERCADOLIVRE/i, "Repasse Mercado Pago (Mercado Livre e loja)"],
  [/REDECARD|REDE (VISA|MAST|ELO)|CIELO|STONE|GETNET|PAGSEGURO/i, "Vendas no cartão"],
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

export function suggestIncome(line: StatementLine, ctx: { companyTaxId: string; ownerNames: string[]; learned?: string; customers?: Array<{ name: string; taxId: string }> }): Suggestion {
  if (ctx.learned) return { category: ctx.learned, sure: true, note: "como da última vez" };
  if (line.taxId && line.taxId === ctx.companyTaxId) return { category: "Transferência entre contas", sure: true };
  const text = `${line.description} ${line.counterparty}`;
  const rule = INCOME_RULES.find(([pattern]) => pattern.test(text));
  if (rule) return { category: rule[1], sure: true };
  // Sócio: CPF (11 dígitos) com nome e sobrenome de um usuário da empresa.
  if (line.taxId.length === 11 && ctx.ownerNames.some((name) => [...tokens(name)].filter((t) => tokens(line.counterparty).has(t)).length >= 2))
    return { category: "Aporte do sócio", sure: true };
  // Cliente já cadastrado no BBOS, sem conta a receber em aberto: venda feita fora do BBOS.
  const customer = (ctx.customers ?? []).find((c) => sameTaxId(c.taxId, line.taxId) || (c.name && sameName(c.name, line.counterparty) && [...tokens(c.name)].filter((t) => tokens(line.counterparty).has(t)).length >= (tokens(c.name).size > 1 ? 2 : 1)));
  if (customer) return { category: "Venda sem pedido no BBOS", sure: true, note: `cliente ${customer.name} · sem pedido em aberto` };
  return { category: "", sure: false };
}

export function planStatement(
  lines: StatementLine[],
  ctx: {
    payments: RecordedPayment[];
    payables: OpenPayable[];
    installments: OpenInstallment[];
    receivables?: OpenReceivable[];
    customers?: Array<{ name: string; taxId: string }>;
    /** Conta do extrato: pagamento registrado em outra conta é reconhecido e pode ser movido. */
    accountId?: string;
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
      plans.set(line.externalId, {
        line,
        group: "ALREADY",
        matchedPayment: {
          ...match,
          differentPayer: !sameName(match.name, line.counterparty),
          otherAccount: ctx.accountId && match.accountId && match.accountId !== ctx.accountId ? match.accountName ?? "outra conta" : undefined,
        },
      });
    }
  }

  // 2a. Entradas que pagam contas a receber em aberto: mesmo cliente (CNPJ/CPF
  // ou nome) e mesmo valor, somando os Pix do mesmo dia.
  const receivables = (ctx.receivables ?? []).map((r) => ({ ...r, left: r.amount }));
  const inGroups = new Map<string, StatementLine[]>();
  for (const line of lines) {
    if (line.amount <= 0 || plans.has(line.externalId)) continue;
    const key = `${line.date}|${line.taxId || line.counterparty.toUpperCase()}`;
    inGroups.set(key, [...(inGroups.get(key) ?? []), line]);
  }
  for (const group of inGroups.values()) {
    const total = Math.round(group.reduce((sum, l) => sum + l.amount, 0) * 100) / 100;
    const head = group[0]!;
    const sameCustomer = (r: { taxId: string; name: string }) => sameTaxId(r.taxId, head.taxId) || sameName(r.name, head.counterparty);
    const candidates = receivables.filter((r) => r.left > 0 && sameCustomer(r));
    // Valor exato de um título; senão, títulos do cliente que somados dão o valor (mais antigos primeiro).
    let chosen = candidates.filter((r) => cents(r.left) === cents(total)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 1);
    if (!chosen.length) {
      const ordered = [...candidates].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      let sum = 0;
      const picked = [];
      for (const r of ordered) {
        if (cents(sum + r.left) > cents(total)) break;
        picked.push(r);
        sum += r.left;
        if (cents(sum) === cents(total)) break;
      }
      if (picked.length && cents(sum) === cents(total)) chosen = picked;
    }
    if (!chosen.length) continue;
    const settlement: Settlement = {
      lines: group.map((l) => l.externalId),
      allocations: chosen.map((r) => ({ kind: "RECEIVABLE" as const, id: r.id, label: r.label, amount: r.left, open: r.left })),
      extra: 0,
      extraCategory: "",
    };
    for (const r of chosen) r.left = 0;
    for (const line of group) plans.set(line.externalId, { line, group: "SETTLE", settlement });
  }

  // 2b. Saídas que pagam contas abertas, somando os Pix do mesmo dia e favorecido.
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
      // Só comissões que já existiam (vencimento até 3 dias depois do Pix).
      const until = new Date(Date.parse(`${group[0]!.date}T12:00:00Z`) + 3 * 86_400_000).toISOString().slice(0, 10);
      const commissions = payables
        .filter((p) => p.commission && p.left > 0 && sameTaxId(p.taxId, taxId) && p.dueDate <= until)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
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
    else plans.set(line.externalId, { line, group: "INCOME", suggestion: suggestIncome(line, { companyTaxId: ctx.companyTaxId, ownerNames: ctx.ownerNames, learned, customers: ctx.customers }) });
  }
  return lines.map((line) => plans.get(line.externalId)!);
}
