"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  ChevronRight,
  Info,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";

type Health = {
  health: "HEALTHY" | "INFO" | "ATTENTION" | "BLOCKED";
  guidance: string;
  openReceivables: number;
  overdueAmount: number;
  overdueCount: number;
  maxDaysOverdue: number;
  availableCredit: number;
};

type Customer = {
  id: string;
  name: string;
  legalName?: string | null;
  tradeName?: string | null;
  taxId?: string | null;
  segment?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  paymentTerms?: string | null;
  active: boolean;
  creditStatus: "NOT_ANALYZED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  creditLimit: string | number;
  creditNotes?: string | null;
  creditReviewedAt?: string | null;
  creditReviewedBy?: string | null;
  financialHealth: Health;
};

const segments = [
  "Distribuidor",
  "Cafeteria",
  "Escritório",
  "Varejo",
  "Restaurante / Hotel",
  "White Label",
  "Exportação",
  "Consumidor final",
  "Outro",
];
const states = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const paymentOptions = ["À vista", "7 dias", "14 dias", "21 dias", "28 dias", "30 dias", "45 dias", "60 dias", "Personalizada"];

const emptyCustomer = {
  name: "", legalName: "", tradeName: "", taxId: "", segment: "",
  email: "", phone: "", postalCode: "", address: "", district: "",
  city: "", state: "", paymentTerms: "",
};

const creditLabel = {
  NOT_ANALYZED: "Não analisado",
  UNDER_REVIEW: "Em análise",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
};

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyCustomer);
  const [saving, setSaving] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);
  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(null);
  const [creditStatus, setCreditStatus] = useState<Customer["creditStatus"]>("UNDER_REVIEW");
  const [creditLimit, setCreditLimit] = useState("0");
  const [creditNotes, setCreditNotes] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/customers", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.message ?? "Não foi possível carregar clientes.");
      setCustomers(await response.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar clientes.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) => [c.name,c.legalName,c.tradeName,c.taxId,c.city,c.state,c.segment].filter(Boolean).some((v) => String(v).toLowerCase().includes(term)));
  }, [customers, search]);

  const createCustomer = async () => {
    if (!form.name.trim()) return setError("Comece pelo nome do cliente. O BBOS cuida do restante com você.");
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/customers", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify(form) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? "Não foi possível cadastrar o cliente.");
      setForm(emptyCustomer); setShowNew(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar o cliente."); }
    finally { setSaving(false); }
  };

  const findCep = async () => {
    const cep = form.postalCode.replace(/\D/g, "");
    if (cep.length !== 8) return setError("Informe os 8 números do CEP para eu completar o endereço.");
    setCepBusy(true); setError("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (data.erro) throw new Error("CEP não encontrado.");
      setForm((current) => ({ ...current, postalCode: data.cep ?? current.postalCode, address: data.logradouro ?? current.address, district: data.bairro ?? current.district, city: data.localidade ?? current.city, state: data.uf ?? current.state }));
    } catch { setError("Não consegui consultar o CEP agora. Você pode continuar preenchendo manualmente."); }
    finally { setCepBusy(false); }
  };

  const openCredit = (customer: Customer) => {
    setCreditCustomer(customer);
    setCreditStatus(customer.creditStatus === "NOT_ANALYZED" ? "UNDER_REVIEW" : customer.creditStatus);
    setCreditLimit(String(customer.creditLimit ?? 0));
    setCreditNotes(customer.creditNotes ?? "");
  };
  const saveCredit = async () => {
    if (!creditCustomer) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/customers/${creditCustomer.id}/credit`, { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ status: creditStatus, creditLimit: Number(creditLimit || 0), notes: creditNotes }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? "Não foi possível salvar a análise de crédito.");
      setCreditCustomer(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar a análise de crédito."); }
    finally { setSaving(false); }
  };

  const attention = customers.filter((c) => ["ATTENTION","BLOCKED"].includes(c.financialHealth?.health)).length;

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.18em] text-violet-700"><Sparkles size={13}/> Comercial inteligente</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Clientes</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-500">O BBOS organiza o cadastro, lê a saúde financeira e ajuda a decidir o próximo passo.</p>
      </div>
      <button onClick={() => { setError(""); setShowNew(true); }} className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white"><Plus size={17}/> Novo cliente</button>
    </div>

    <div className="grid gap-4 md:grid-cols-4">
      <Kpi label="Clientes ativos" value={customers.filter((c) => c.active).length} tone="blue" />
      <Kpi label="Saúde financeira ok" value={customers.filter((c) => c.financialHealth?.health === "HEALTHY").length} tone="green" />
      <Kpi label="Pedem atenção" value={attention} tone={attention ? "amber" : "green"} />
      <Kpi label="Crédito em análise" value={customers.filter((c) => c.creditStatus === "UNDER_REVIEW").length} tone="violet" />
    </div>

    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl bg-stone-100 px-3 py-2.5 text-stone-500"><Search size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Busque por cliente, CNPJ, cidade ou segmento..." className="w-full bg-transparent text-sm outline-none"/></div>
        <span className="text-xs text-stone-500">{filtered.length} cliente(s)</span>
      </div>
      {error && <div className="m-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading ? <div className="p-12 text-center text-sm text-stone-500">Estou organizando seus clientes…</div> : filtered.length === 0 ?
        <div className="p-14 text-center"><Building2 className="mx-auto text-stone-300"/><p className="mt-3 font-semibold">Ainda não há clientes aqui</p><p className="mt-1 text-sm text-stone-500">Cadastre o primeiro. O BBOS vai guiando você.</p></div> :
        <div className="divide-y">{filtered.map((customer) => <CustomerRow key={customer.id} customer={customer} onCredit={()=>openCredit(customer)}/>)}</div>}
    </div>

    {showNew && <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-blue-700">Cadastro guiado</p><h2 className="mt-1 text-2xl font-semibold">Novo cliente</h2><p className="mt-1 text-sm text-stone-500">Preencha o essencial. O restante pode evoluir com o relacionamento.</p></div><button onClick={()=>setShowNew(false)} className="rounded-xl border p-2"><X size={18}/></button></div>
        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><div className="flex gap-3"><Info className="mt-0.5 shrink-0" size={18}/><div><strong>Comece simples.</strong><p className="mt-1 text-xs leading-5 text-blue-800">Para vender à vista, não é obrigatório analisar crédito agora. Se o cliente comprar a prazo, o BBOS vai lembrar você no momento certo.</p></div></div></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Como você chama este cliente?" help="Nome que a equipe reconhecerá rapidamente." wide><input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Ex.: Café Central"/></Field>
          <Field label="Razão social" wide><input value={form.legalName} onChange={(e)=>setForm({...form,legalName:e.target.value})}/></Field>
          <Field label="CPF / CNPJ"><input value={form.taxId} onChange={(e)=>setForm({...form,taxId:e.target.value})} placeholder="Somente se disponível"/></Field>
          <Field label="Segmento"><select value={form.segment} onChange={(e)=>setForm({...form,segment:e.target.value})}><option value="">Escolha o perfil</option>{segments.map((s)=><option key={s}>{s}</option>)}</select></Field>
          <Field label="E-mail"><input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></Field>
          <Field label="Telefone / WhatsApp"><input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></Field>
          <Field label="CEP" help="Posso completar o endereço para você."><div className="flex gap-2"><input className="flex-1" value={form.postalCode} onChange={(e)=>setForm({...form,postalCode:e.target.value})}/><button type="button" onClick={()=>void findCep()} disabled={cepBusy} className="rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white">{cepBusy?"Buscando…":"Buscar"}</button></div></Field>
          <Field label="UF"><select value={form.state} onChange={(e)=>setForm({...form,state:e.target.value,city:""})}><option value="">Estado</option>{states.map((s)=><option key={s}>{s}</option>)}</select></Field>
          <Field label="Cidade"><input value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})} placeholder={form.state ? `Cidade em ${form.state}` : "Escolha a UF primeiro"}/></Field>
          <Field label="Bairro"><input value={form.district} onChange={(e)=>setForm({...form,district:e.target.value})}/></Field>
          <Field label="Endereço" wide><input value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})}/></Field>
          <Field label="Condição de pagamento" help="Pode ser alterada depois conforme a análise de crédito." wide><select value={form.paymentTerms} onChange={(e)=>setForm({...form,paymentTerms:e.target.value})}><option value="">Definir depois</option>{paymentOptions.map((p)=><option key={p}>{p}</option>)}</select></Field>
        </div>
        <div className="mt-6 rounded-2xl bg-violet-50 p-4 text-sm text-violet-900"><div className="flex gap-3"><Sparkles className="mt-0.5 shrink-0" size={18}/><p>Depois de salvar, eu vou acompanhar crédito, títulos em aberto e atrasos deste cliente e avisar a equipe no momento da venda.</p></div></div>
        {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <button disabled={saving} onClick={()=>void createCustomer()} className="mt-6 w-full rounded-xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving?"Salvando…":"Cadastrar cliente"}</button>
      </aside>
    </div>}

    {creditCustomer && <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-violet-700">Decisão administrativa</p><h2 className="mt-1 text-2xl font-semibold">Análise de crédito</h2><p className="mt-1 text-sm text-stone-500">{creditCustomer.tradeName || creditCustomer.name}</p></div><button onClick={()=>setCreditCustomer(null)} className="rounded-xl border p-2"><X size={18}/></button></div>
      <HealthPanel health={creditCustomer.financialHealth} compact />
      <div className="mt-5 space-y-4">
        <Field label="Situação"><select value={creditStatus} onChange={(e)=>setCreditStatus(e.target.value as Customer["creditStatus"])}><option value="NOT_ANALYZED">Não analisado</option><option value="UNDER_REVIEW">Em análise</option><option value="APPROVED">Aprovado</option><option value="REJECTED">Reprovado</option></select></Field>
        <Field label="Limite aprovado (R$)"><input type="number" min="0" step="0.01" value={creditLimit} onChange={(e)=>setCreditLimit(e.target.value)}/></Field>
        <Field label="Observação da análise"><textarea rows={4} value={creditNotes} onChange={(e)=>setCreditNotes(e.target.value)} placeholder="Documentos analisados, justificativa, condição..."/></Field>
      </div>
      <p className="mt-4 text-xs leading-5 text-stone-500">Informações financeiras detalhadas ficam com administração/financeiro. O vendedor receberá apenas o alerta necessário para conduzir o pedido.</p>
      <button disabled={saving} onClick={()=>void saveCredit()} className="mt-5 w-full rounded-xl bg-stone-950 py-3 text-sm font-semibold text-white">{saving?"Salvando…":"Salvar decisão"}</button>
    </div></div>}
  </div>;
}

function CustomerRow({customer,onCredit}:{customer:Customer;onCredit:()=>void}) {
  const h = customer.financialHealth;
  const style = h.health === "HEALTHY" ? "bg-emerald-50 text-emerald-800 border-emerald-100" : h.health === "INFO" ? "bg-blue-50 text-blue-800 border-blue-100" : h.health === "ATTENTION" ? "bg-amber-50 text-amber-900 border-amber-100" : "bg-red-50 text-red-800 border-red-100";
  const Icon = h.health === "HEALTHY" ? CheckCircle2 : h.health === "BLOCKED" ? ShieldAlert : h.health === "ATTENTION" ? AlertTriangle : Info;
  return <div className="p-5 transition hover:bg-stone-50/60">
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1.5fr_auto] lg:items-center">
      <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{customer.tradeName || customer.name}</p>{customer.segment && <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">{customer.segment}</span>}</div><p className="mt-1 text-xs text-stone-500">{customer.taxId || "CPF/CNPJ ainda não informado"}</p>{customer.city && <p className="mt-1 flex items-center gap-1 text-xs text-stone-400"><MapPin size={12}/>{customer.city}{customer.state?`/${customer.state}`:""}</p>}</div>
      <div className={`rounded-xl border px-4 py-3 ${style}`}><div className="flex gap-2"><Icon size={17} className="mt-0.5 shrink-0"/><div><p className="text-xs font-bold">{h.health === "HEALTHY" ? "Tudo em ordem" : h.health === "INFO" ? "BBOS orienta" : h.health === "ATTENTION" ? "Vale conferir" : "Atenção antes de vender"}</p><p className="mt-1 text-xs leading-5 opacity-90">{h.guidance}</p></div></div></div>
      <div className="flex items-center gap-3 lg:justify-end"><div className="text-right"><p className="text-[10px] uppercase tracking-wider text-stone-400">Crédito</p><p className="text-sm font-semibold">{creditLabel[customer.creditStatus]}</p>{customer.creditStatus === "APPROVED" && <p className="text-xs text-stone-500">Disponível {money(h.availableCredit)}</p>}</div><button onClick={onCredit} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-white"><BadgeDollarSign size={15}/> Analisar <ChevronRight size={14}/></button></div>
    </div>
  </div>;
}

function HealthPanel({health,compact=false}:{health:Health;compact?:boolean}) {
  return <div className={`mt-5 grid gap-2 ${compact?"grid-cols-2":"md:grid-cols-4"}`}><Mini label="Em aberto" value={money(health.openReceivables)}/><Mini label="Vencido" value={money(health.overdueAmount)} alert={health.overdueAmount>0}/><Mini label="Títulos vencidos" value={String(health.overdueCount)} alert={health.overdueCount>0}/><Mini label="Maior atraso" value={`${health.maxDaysOverdue} dias`} alert={health.maxDaysOverdue>0}/></div>;
}
function Mini({label,value,alert}:{label:string;value:string;alert?:boolean}) { return <div className={`rounded-xl border p-3 ${alert?"border-amber-100 bg-amber-50":"bg-stone-50"}`}><p className="text-[10px] uppercase tracking-wider text-stone-400">{label}</p><p className={`mt-1 text-sm font-bold ${alert?"text-amber-900":""}`}>{value}</p></div>; }
function Kpi({label,value,tone}:{label:string;value:number;tone:"blue"|"green"|"amber"|"violet"}) { const map={blue:"bg-blue-50 border-blue-100 text-blue-900",green:"bg-emerald-50 border-emerald-100 text-emerald-900",amber:"bg-amber-50 border-amber-100 text-amber-900",violet:"bg-violet-50 border-violet-100 text-violet-900"}; return <div className={`rounded-2xl border p-5 ${map[tone]}`}><p className="text-xs font-medium opacity-70">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>; }
function Field({label,children,wide=false,help}:{label:string;children:React.ReactNode;wide?:boolean;help?:string}) { return <label className={wide?"sm:col-span-2":""}><span className="mb-1.5 block text-sm font-semibold">{label}</span><div className="[&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:px-3 [&>input]:py-3 [&>input]:text-sm [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:px-3 [&>select]:py-3 [&>select]:text-sm [&>textarea]:w-full [&>textarea]:rounded-xl [&>textarea]:border [&>textarea]:px-3 [&>textarea]:py-3 [&>textarea]:text-sm">{children}</div>{help&&<span className="mt-1 block text-[11px] text-stone-400">{help}</span>}</label>; }
