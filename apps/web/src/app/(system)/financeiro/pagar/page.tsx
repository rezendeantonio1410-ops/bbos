"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Link2,
  Plus,
  ReceiptText,
  Repeat2,
  WalletCards,
  X,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";

type Payable = {
  id: string;
  description: string;
  category: string;
  issueDate: string;
  competenceDate?: string | null;
  dueDate: string;
  amount: number | string;
  openAmount: number | string;
  status: string;
  notes?: string | null;
  documentNumber?: string | null;
  recurrenceIndex?: number | null;
  recurrenceCount?: number | null;
  supplier?: { name?: string | null } | null;
  costCenter?: { name?: string | null } | null;
  costEvent?: { id: string } | null;
};

type ExpenseOptions = {
  suppliers: Array<{ id: string; name: string }>;
  costCenters: Array<{
    id: string;
    code: string;
    name: string;
    category: "INDUSTRIAL" | "LOGISTICS_INVENTORY" | "CORPORATE";
  }>;
  accounts: Array<{ id: string; name: string; type: string; currency: string }>;
};

const categories = [
  "Água",
  "Energia elétrica",
  "Gás",
  "Insumos / material de consumo",
  "Embalagens",
  "Manutenção",
  "Aluguel",
  "Internet / telefonia",
  "Contabilidade",
  "Funcionários / salários",
  "Encargos trabalhistas",
  "Frete / logística",
  "Impostos e taxas",
  "Serviços terceirizados",
  "Despesa administrativa",
  "Segurança",
  "Outras despesas",
];

const paymentMethods = [
  ["PIX", "Pix"],
  ["BANK_TRANSFER", "Transferência bancária"],
  ["BOLETO", "Boleto"],
  ["CREDIT_CARD", "Cartão de crédito"],
  ["DEBIT_CARD", "Cartão de débito"],
  ["CASH", "Dinheiro"],
  ["OTHER", "Outro"],
] as const;

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const today = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
};
const month = () => today().slice(0, 7);
const operationKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `expense-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function initialForm() {
  return {
    description: "",
    category: "",
    amount: "",
    issueDate: today(),
    competence: month(),
    dueDate: today(),
    supplierId: "",
    costCenterId: "",
    notes: "",
    documentType: "",
    documentNumber: "",
    documentUrl: "",
    createCost: true,
    repeatMonthly: false,
    repeatCount: "12",
    paidNow: false,
    financialAccountId: "",
    paymentMethod: "PIX",
    paidAt: today(),
    idempotencyKey: operationKey(),
  };
}

function parseMoney(value: string) {
  const normalized = value.trim().replace(/\s/g, "");
  return normalized.includes(",")
    ? Number(normalized.replace(/\./g, "").replace(",", "."))
    : Number(normalized);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function recommendedCenter(category: string) {
  if (category === "Frete / logística") return "LOGISTICS_INVENTORY";
  if (
    [
      "Água",
      "Energia elétrica",
      "Gás",
      "Insumos / material de consumo",
      "Embalagens",
      "Manutenção",
    ].includes(category)
  )
    return "INDUSTRIAL";
  return "CORPORATE";
}

export default function PayablesPage() {
  const [rows, setRows] = React.useState<Payable[]>([]);
  const [options, setOptions] = React.useState<ExpenseOptions | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [showNew, setShowNew] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState(initialForm);
  const [payable, setPayable] = React.useState<Payable | null>(null);
  const [paying, setPaying] = React.useState(false);
  const [payment, setPayment] = React.useState({
    amount: "",
    financialAccountId: "",
    method: "PIX",
    paidAt: today(),
    notes: "",
    idempotencyKey: operationKey(),
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [payablesResponse, optionsResponse] = await Promise.all([
        fetch("/api/finance/payables", {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/finance/expense-options", {
          credentials: "include",
          cache: "no-store",
        }),
      ]);
      const payablesBody = await payablesResponse.json().catch(() => []);
      const optionsBody = await optionsResponse.json().catch(() => null);
      if (!payablesResponse.ok)
        throw new Error(
          payablesBody?.message ?? "Não foi possível carregar as despesas.",
        );
      if (!optionsResponse.ok)
        throw new Error(
          optionsBody?.message ??
            "Não foi possível carregar as opções financeiras.",
        );
      setRows(Array.isArray(payablesBody) ? payablesBody : []);
      setOptions(optionsBody);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as despesas.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const changeCategory = (category: string) => {
    const suggested = options?.costCenters.find(
      (center) => center.category === recommendedCenter(category),
    );
    setForm((current) => ({
      ...current,
      category,
      costCenterId: suggested?.id ?? current.costCenterId,
    }));
  };

  const openNew = () => {
    setError("");
    setMessage("");
    setForm(initialForm());
    setShowNew(true);
  };

  const create = async () => {
    const amount = parseMoney(form.amount);
    if (!form.description.trim())
      return setError("Informe uma descrição para a despesa.");
    if (!form.category) return setError("Escolha uma categoria.");
    if (!Number.isFinite(amount) || amount <= 0)
      return setError("Informe um valor maior que zero.");
    if (form.createCost && !form.costCenterId)
      return setError("Selecione o centro de custo.");
    if (form.paidNow && !form.financialAccountId)
      return setError("Selecione a conta utilizada no pagamento.");
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/finance/payables", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          amount,
          competenceDate: `${form.competence}-01`,
          repeatCount: Number(form.repeatCount),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body?.message ?? "Não foi possível lançar a despesa.");
      const created = Array.isArray(body?.payables) ? body.payables.length : 1;
      setShowNew(false);
      setMessage(
        created > 1
          ? `${created} compromissos mensais registrados com segurança.`
          : form.paidNow
            ? "Despesa e pagamento registrados com segurança."
            : "Despesa registrada em Contas a Pagar e Custos.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível lançar a despesa.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openPayment = (row: Payable) => {
    setError("");
    setPayable(row);
    setPayment({
      amount: String(Number(row.openAmount || 0).toFixed(2)).replace(".", ","),
      financialAccountId: options?.accounts[0]?.id ?? "",
      method: "PIX",
      paidAt: today(),
      notes: "",
      idempotencyKey: operationKey(),
    });
  };

  const registerPayment = async () => {
    if (!payable) return;
    const amount = parseMoney(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      return setError("Informe um valor pago maior que zero.");
    if (!payment.financialAccountId)
      return setError("Selecione a conta utilizada no pagamento.");
    setPaying(true);
    setError("");
    try {
      const response = await fetch(
        `/api/finance/payables/${payable.id}/payments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payment),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          body?.message ?? "Não foi possível registrar o pagamento.",
        );
      setPayable(null);
      setMessage(
        "Pagamento registrado e enviado para a conciliação financeira.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível registrar o pagamento.",
      );
    } finally {
      setPaying(false);
    }
  };

  const active = rows.filter(
    (row) => !["PAID", "CANCELLED"].includes(row.status),
  );
  const open = active.reduce(
    (sum, row) => sum + Number(row.openAmount || 0),
    0,
  );
  const overdue = active
    .filter((row) => new Date(row.dueDate) < new Date())
    .reduce((sum, row) => sum + Number(row.openAmount || 0), 0);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/financeiro"
            className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-forest-700"
          >
            <ArrowLeft size={14} /> Financeiro
          </Link>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
            Despesas e compromissos
          </p>
          <h1 className="mt-1 text-3xl font-bold">Contas a pagar</h1>
          <p className="mt-1 text-sm text-stone-500">
            Um único lançamento alimenta financeiro, custos e conciliação.
          </p>
        </div>
        <button
          data-bbos-write-action
          onClick={openNew}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white"
        >
          <Plus size={17} /> Nova despesa
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Em aberto" value={money.format(open)} />
        <Kpi
          label="Vencido"
          value={money.format(overdue)}
          tone={overdue > 0 ? "danger" : "neutral"}
        />
        <Kpi label="Lançamentos" value={String(rows.length)} />
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 size={17} /> {message}
        </div>
      )}
      {error && !showNew && !payable && <ErrorMessage>{error}</ErrorMessage>}

      <Card className="overflow-hidden p-0">
        <div className="hidden grid-cols-8 gap-3 border-b bg-stone-50 p-4 text-[10px] font-bold uppercase tracking-wide text-stone-500 md:grid">
          <span>Categoria</span>
          <span className="col-span-2">Descrição</span>
          <span>Vencimento</span>
          <span>Valor</span>
          <span>Em aberto</span>
          <span>Status</span>
          <span>Ação</span>
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-stone-500">
            Carregando compromissos reais…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <ReceiptText className="mx-auto text-stone-300" />
            <p className="mt-3 font-semibold">Nenhuma despesa lançada</p>
            <p className="mt-1 text-sm text-stone-500">
              Comece por água, energia, aluguel ou outra despesa do mês.
            </p>
          </div>
        ) : (
          rows.map((row) => {
            const isOpen = !["PAID", "CANCELLED"].includes(row.status);
            const isOverdue = isOpen && new Date(row.dueDate) < new Date();
            return (
              <div
                key={row.id}
                className="grid gap-2 border-b border-stone-100 p-4 text-xs md:grid-cols-8 md:items-center"
              >
                <span className="font-semibold">{row.category}</span>
                <span className="col-span-2 min-w-0">
                  <span className="block truncate font-semibold text-stone-800">
                    {row.description}
                  </span>
                  <span className="mt-1 block text-[11px] text-stone-500">
                    {row.supplier?.name ?? "Sem fornecedor"} ·{" "}
                    {row.costCenter?.name ?? "Sem centro"}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {row.costEvent && <Mini>custo integrado</Mini>}
                    {row.recurrenceCount && (
                      <Mini>
                        {row.recurrenceIndex}/{row.recurrenceCount} mensal
                      </Mini>
                    )}
                    {row.documentNumber && (
                      <Mini>doc. {row.documentNumber}</Mini>
                    )}
                  </span>
                </span>
                <span>{formatDate(row.dueDate)}</span>
                <span>{money.format(Number(row.amount || 0))}</span>
                <span className="font-bold">
                  {money.format(Number(row.openAmount || 0))}
                </span>
                <Badge
                  tone={
                    row.status === "PAID"
                      ? "success"
                      : isOverdue
                        ? "danger"
                        : "warning"
                  }
                >
                  {row.status === "PAID"
                    ? "Pago"
                    : isOverdue
                      ? "Vencido"
                      : "A pagar"}
                </Badge>
                {isOpen ? (
                  <button
                    data-bbos-write-action
                    onClick={() => openPayment(row)}
                    className="min-h-10 rounded-xl border px-3 text-xs font-bold text-forest-800"
                  >
                    Dar baixa
                  </button>
                ) : (
                  <span className="text-[11px] text-stone-400">Concluído</span>
                )}
              </div>
            );
          })
        )}
      </Card>

      <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900">
        <strong>Fluxo único do BBOS</strong>
        <p className="mt-1 text-xs leading-5">
          Despesas gerais entram aqui. Café verde continua em Compras; materiais
          com estoque e NF-e devem entrar pela caixa de notas para não haver
          duplicidade.
        </p>
      </div>

      {showNew && (
        <Drawer
          title="Nova despesa"
          subtitle="Registre uma vez; o BBOS distribui para financeiro e custos."
          onClose={() => setShowNew(false)}
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoria">
                <select
                  value={form.category}
                  onChange={(event) => changeCategory(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </Field>
              <Field label="Valor (R$)">
                <div className="relative">
                  <CircleDollarSign
                    className="absolute left-3 top-3.5 text-stone-400"
                    size={16}
                  />
                  <input
                    className="pl-9"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(event) =>
                      setForm({ ...form, amount: event.target.value })
                    }
                    placeholder="0,00"
                  />
                </div>
              </Field>
            </div>
            <Field label="Descrição">
              <input
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="Ex.: Energia elétrica — novembro"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fornecedor / beneficiário">
                <select
                  value={form.supplierId}
                  onChange={(event) =>
                    setForm({ ...form, supplierId: event.target.value })
                  }
                >
                  <option value="">Não informado</option>
                  {options?.suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Centro de custo">
                <select
                  value={form.costCenterId}
                  onChange={(event) =>
                    setForm({ ...form, costCenterId: event.target.value })
                  }
                >
                  <option value="">Selecione</option>
                  {options?.costCenters.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.code} · {center.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Competência">
                <input
                  type="month"
                  value={form.competence}
                  onChange={(event) =>
                    setForm({ ...form, competence: event.target.value })
                  }
                />
              </Field>
              <Field label="Emissão">
                <input
                  type="date"
                  value={form.issueDate}
                  onChange={(event) =>
                    setForm({ ...form, issueDate: event.target.value })
                  }
                />
              </Field>
              <Field label="Vencimento">
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) =>
                    setForm({ ...form, dueDate: event.target.value })
                  }
                />
              </Field>
            </div>

            {["Embalagens", "Insumos / material de consumo"].includes(
              form.category,
            ) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                Se este material controla saldo físico, prefira a{" "}
                <Link href="/notas-entrada" className="font-bold underline">
                  entrada pela NF-e
                </Link>
                . Use esta tela apenas para consumo sem estoque ou documento sem
                entrada fiscal.
              </div>
            )}

            <details className="rounded-xl border bg-stone-50 p-3">
              <summary className="cursor-pointer text-sm font-bold text-stone-700">
                Documento, recorrência e outras opções
              </summary>
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Tipo de documento">
                    <select
                      value={form.documentType}
                      onChange={(event) =>
                        setForm({ ...form, documentType: event.target.value })
                      }
                    >
                      <option value="">Sem documento</option>
                      <option value="INVOICE">Nota fiscal</option>
                      <option value="UTILITY_BILL">Conta de consumo</option>
                      <option value="BOLETO">Boleto</option>
                      <option value="RECEIPT">Recibo</option>
                      <option value="OTHER">Outro</option>
                    </select>
                  </Field>
                  <Field label="Número / referência">
                    <input
                      value={form.documentNumber}
                      onChange={(event) =>
                        setForm({ ...form, documentNumber: event.target.value })
                      }
                      placeholder="Ex.: UC 123456 · nov/2026"
                    />
                  </Field>
                </div>
                <Field label="Link do documento ou anexo">
                  <div className="relative">
                    <Link2
                      className="absolute left-3 top-3.5 text-stone-400"
                      size={16}
                    />
                    <input
                      className="pl-9"
                      value={form.documentUrl}
                      onChange={(event) =>
                        setForm({ ...form, documentUrl: event.target.value })
                      }
                      placeholder="https://…"
                    />
                  </div>
                </Field>
                <Toggle
                  checked={form.createCost}
                  onChange={(checked) =>
                    setForm({ ...form, createCost: checked })
                  }
                  icon={<FileText size={17} />}
                  title="Apropriar automaticamente aos custos"
                  detail="Recomendado para despesas operacionais e administrativas."
                />
                <Toggle
                  checked={form.repeatMonthly}
                  onChange={(checked) =>
                    setForm({
                      ...form,
                      repeatMonthly: checked,
                      paidNow: checked ? false : form.paidNow,
                    })
                  }
                  icon={<Repeat2 size={17} />}
                  title="Repetir o mesmo valor mensalmente"
                  detail="Use apenas para contratos de valor fixo, como aluguel e contabilidade."
                />
                {form.repeatMonthly && (
                  <Field label="Quantidade de meses">
                    <input
                      type="number"
                      min="2"
                      max="24"
                      value={form.repeatCount}
                      onChange={(event) =>
                        setForm({ ...form, repeatCount: event.target.value })
                      }
                    />
                  </Field>
                )}
                <Toggle
                  checked={form.paidNow}
                  disabled={form.repeatMonthly}
                  onChange={(checked) => setForm({ ...form, paidNow: checked })}
                  icon={<WalletCards size={17} />}
                  title="Esta despesa já foi paga"
                  detail="Registra a saída financeira no mesmo lançamento."
                />
                {form.paidNow && (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Conta utilizada">
                      <select
                        value={form.financialAccountId}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            financialAccountId: event.target.value,
                          })
                        }
                      >
                        <option value="">Selecione</option>
                        {options?.accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Forma">
                      <select
                        value={form.paymentMethod}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            paymentMethod: event.target.value,
                          })
                        }
                      >
                        {paymentMethods.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Data do pagamento">
                      <input
                        type="date"
                        value={form.paidAt}
                        onChange={(event) =>
                          setForm({ ...form, paidAt: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                )}
                <Field label="Observações">
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(event) =>
                      setForm({ ...form, notes: event.target.value })
                    }
                    placeholder="Detalhes úteis para conferência e contabilidade…"
                  />
                </Field>
              </div>
            </details>
          </div>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <DrawerAction disabled={saving} onClick={() => void create()}>
            {saving
              ? "Salvando…"
              : form.paidNow
                ? "Registrar despesa e pagamento"
                : "Registrar despesa"}
          </DrawerAction>
        </Drawer>
      )}

      {payable && (
        <Drawer
          title="Registrar pagamento"
          subtitle={`${payable.description} · ${money.format(Number(payable.openAmount))} em aberto`}
          onClose={() => setPayable(null)}
        >
          <div className="space-y-4">
            <Field label="Valor pago (R$)">
              <input
                inputMode="decimal"
                value={payment.amount}
                onChange={(event) =>
                  setPayment({ ...payment, amount: event.target.value })
                }
              />
            </Field>
            <Field label="Conta utilizada">
              <select
                value={payment.financialAccountId}
                onChange={(event) =>
                  setPayment({
                    ...payment,
                    financialAccountId: event.target.value,
                  })
                }
              >
                <option value="">Selecione</option>
                {options?.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Forma de pagamento">
                <select
                  value={payment.method}
                  onChange={(event) =>
                    setPayment({ ...payment, method: event.target.value })
                  }
                >
                  {paymentMethods.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Data">
                <input
                  type="date"
                  value={payment.paidAt}
                  onChange={(event) =>
                    setPayment({ ...payment, paidAt: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Observações">
              <textarea
                rows={3}
                value={payment.notes}
                onChange={(event) =>
                  setPayment({ ...payment, notes: event.target.value })
                }
                placeholder="Comprovante ou referência bancária…"
              />
            </Field>
          </div>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <DrawerAction
            disabled={paying}
            onClick={() => void registerPayment()}
          >
            {paying ? "Registrando…" : "Confirmar pagamento"}
          </DrawerAction>
        </Drawer>
      )}
    </div>
  );
}

function Drawer({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <aside className="flex h-dvh w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-violet-700">
              Financeiro integrado
            </p>
            <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-xl border p-2"
            aria-label="Fechar"
          >
            <X className="mx-auto" size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-36 sm:p-6 sm:pb-36">
          {children}
        </div>
      </aside>
    </div>
  );
}

function DrawerAction({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed bottom-0 right-0 z-10 w-full max-w-2xl border-t bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6">
      <button
        disabled={disabled}
        onClick={onClick}
        className="min-h-12 w-full rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {children}
      </button>
    </div>
  );
}

function Toggle({
  checked,
  disabled = false,
  onChange,
  icon,
  title,
  detail,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border bg-white p-3 ${disabled ? "opacity-50" : "cursor-pointer"}`}
    >
      <span className="mt-0.5 text-forest-700">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-stone-500">
          {detail}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 accent-forest-800"
      />
    </label>
  );
}

function Kpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
        {label}
      </p>
      <p
        className={`mt-2 text-xl font-bold ${tone === "danger" ? "text-red-700" : "text-stone-900"}`}
      >
        {value}
      </p>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-stone-700">
      <span>{label}</span>
      <div className="mt-1 [&_input]:min-h-12 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:px-3 [&_select]:min-h-12 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:bg-white [&_select]:px-3 [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:px-3 [&_textarea]:py-3 [&_input]:text-base [&_select]:text-base [&_textarea]:text-base [&_input]:outline-none [&_select]:outline-none [&_textarea]:outline-none">
        {children}
      </div>
    </label>
  );
}

function Mini({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-bold text-stone-500">
      {children}
    </span>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
      {children}
    </div>
  );
}
