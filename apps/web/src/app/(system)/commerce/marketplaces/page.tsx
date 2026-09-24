"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  UsersRound,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type Channel = {
  id: string;
  name: string;
  platformCode: string;
  connectionStatus: string;
  externalAccountId?: string | null;
  lastSyncedAt?: string | null;
  orders: number;
  pending: number;
  errors: number;
  gross: number;
  fees: number;
  freight: number;
  net: number;
};
type Order = {
  id: string;
  channelName: string;
  externalOrderId: string;
  externalStatus?: string | null;
  importStatus: string;
  grossAmount?: string | number | null;
  lastSeenAt: string;
};
type SyncRun = {
  id: string;
  channelName?: string | null;
  trigger: string;
  status: string;
  recordsRead: number;
  startedAt: string;
  lastError?: string | null;
};
type Dashboard = {
  channels: Channel[];
  orders: Order[];
  syncRuns: SyncRun[];
  summary: {
    gross: number;
    net: number;
    orders: number;
    pending: number;
    errors: number;
  };
};
type IntegrationStatus = {
  configured: boolean;
  connection: {
    status: string;
    connectedAt?: string | null;
    lastError?: string | null;
  };
};
type Session = { user?: { role?: string } };
type Operator = {
  id: string;
  name: string;
  email: string;
  operatorCompanyName?: string | null;
  channelName?: string | null;
  active: boolean;
  permissions: Record<string, boolean>;
};
type OperatorUser = { id: string; name: string; email: string };

const empty: Dashboard = {
  channels: [],
  orders: [],
  syncRuns: [],
  summary: { gross: 0, net: 0, orders: 0, pending: 0, errors: 0 },
};

export default function MarketplacesPage() {
  const [dashboard, setDashboard] = React.useState<Dashboard>(empty);
  const [integration, setIntegration] =
    React.useState<IntegrationStatus | null>(null);
  const [role, setRole] = React.useState("");
  const [operators, setOperators] = React.useState<Operator[]>([]);
  const [operatorUsers, setOperatorUsers] = React.useState<OperatorUser[]>([]);
  const [operatorUserId, setOperatorUserId] = React.useState("");
  const [operatorChannelId, setOperatorChannelId] = React.useState("");
  const [operatorCompany, setOperatorCompany] = React.useState("");
  const [granting, setGranting] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    const [dashboardResponse, statusResponse, sessionResponse] =
      await Promise.all([
        fetch(`${API}/marketplaces/dashboard`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${API}/integrations/mercado-livre/status`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${API}/auth/me`, { credentials: "include", cache: "no-store" }),
      ]);
    if (dashboardResponse.ok) setDashboard(await dashboardResponse.json());
    if (statusResponse.ok) setIntegration(await statusResponse.json());
    if (sessionResponse.ok) {
      const session: Session = await sessionResponse.json();
      const nextRole = session.user?.role ?? "";
      setRole(nextRole);
      if (["ADMIN", "EXECUTIVE"].includes(nextRole)) {
        const response = await fetch(`${API}/marketplaces/operators`, {
          credentials: "include",
          cache: "no-store",
        });
        if (response.ok) {
          const payload = await response.json();
          setOperators(payload.accesses ?? []);
          setOperatorUsers(payload.users ?? []);
        }
      }
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const connected = integration?.connection.status === "CONNECTED";
  const management = ["ADMIN", "EXECUTIVE"].includes(role);

  const sync = async () => {
    setSyncing(true);
    setMessage("");
    const response = await fetch(`${API}/marketplaces/mercado-livre/sync`, {
      method: "POST",
      credentials: "include",
    });
    const payload = await response.json().catch(() => ({}));
    setMessage(
      response.ok
        ? `${payload.recordsRead ?? 0} pedidos conferidos com o Mercado Livre.`
        : (payload.message ?? "Não foi possível sincronizar o canal."),
    );
    await load();
    setSyncing(false);
  };

  const grantAccess = async () => {
    if (!operatorUserId || !operatorChannelId) {
      setMessage("Escolha o operador e o marketplace.");
      return;
    }
    setGranting(true);
    const response = await fetch(`${API}/marketplaces/operators`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: operatorUserId,
        salesChannelId: operatorChannelId,
        operatorCompanyName: operatorCompany,
        permissions: {
          orders: true,
          listings: true,
          prices: false,
          reconciliation: false,
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setMessage(
      response.ok
        ? "Acesso do operador concedido com segurança."
        : (payload.message ?? "Não foi possível conceder o acesso."),
    );
    if (response.ok) {
      setOperatorUserId("");
      setOperatorChannelId("");
      setOperatorCompany("");
      await load();
    }
    setGranting(false);
  };

  return (
    <div className="mx-auto max-w-[1500px] pb-12">
      <Link
        href="/commerce"
        className="inline-flex items-center gap-1 text-xs font-bold text-[#66706D]"
      >
        <ArrowLeft size={14} /> Commerce
      </Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-[#087568]">
            <Store size={14} /> BBOS Marketplaces
          </p>
          <h1 className="mt-2 text-3xl font-bold">Gestão de marketplaces</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#626B69]">
            Pedidos, anúncios, estoque, taxas e repasses em uma operação única —
            com acesso controlado para parceiros externos.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {connected ? (
            <button
              onClick={() => void sync()}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-xl bg-[#14201D] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Sincronizando" : "Sincronizar agora"}
            </button>
          ) : management ? (
            <button
              onClick={() => {
                window.location.href = `${API}/integrations/mercado-livre/connect`;
              }}
              disabled={!integration?.configured}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FFE600] px-4 py-3 text-xs font-extrabold text-[#2D3277] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Conectar Mercado Livre <ExternalLink size={14} />
            </button>
          ) : null}
        </div>
      </header>

      {message && (
        <div className="mt-5 rounded-xl border border-[#D8E7E2] bg-[#F0F7F4] px-4 py-3 text-xs font-semibold text-[#205C53]">
          {message}
        </div>
      )}
      {!integration?.configured && management && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
          <AlertTriangle size={18} className="shrink-0" />
          <span>
            O conector está pronto. Falta cadastrar no ambiente as credenciais
            do aplicativo Mercado Livre e a URL de retorno para liberar a
            autorização.
          </span>
        </div>
      )}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          icon={CircleDollarSign}
          label="Venda bruta"
          value={money.format(dashboard.summary.gross)}
        />
        <Metric
          icon={CircleDollarSign}
          label="Valor líquido"
          value={money.format(dashboard.summary.net)}
        />
        <Metric
          icon={ShoppingBag}
          label="Pedidos"
          value={String(dashboard.summary.orders)}
        />
        <Metric
          icon={PackageSearch}
          label="Aguardando ação"
          value={String(dashboard.summary.pending)}
        />
        <Metric
          icon={AlertTriangle}
          label="Erros de sincronização"
          value={String(dashboard.summary.errors)}
          attention={dashboard.summary.errors > 0}
        />
      </section>

      <section className="mt-6 rounded-2xl border border-[#E7E7E3] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#087568]">
              Operação por canal
            </p>
            <h2 className="mt-1 text-lg font-bold">
              Canais conectados ao estoque BBOS
            </h2>
            <p className="mt-1 text-xs text-[#66706D]">
              O saldo vendável é único; cada canal mantém sua tarifa, logística
              e repasse.
            </p>
          </div>
          <Badge tone={connected ? "success" : "warning"}>
            {connected ? "Mercado Livre conectado" : "Conexão pendente"}
          </Badge>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {dashboard.channels.map((channel) => (
            <Card key={channel.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`grid size-11 place-items-center rounded-2xl ${channel.platformCode === "MERCADO_LIVRE" ? "bg-[#FFE600] text-[#2D3277]" : "bg-[#F0F2F1] text-[#315D55]"}`}
                >
                  <Store size={19} />
                </span>
                <Badge
                  tone={
                    channel.connectionStatus === "CONNECTED"
                      ? "success"
                      : "neutral"
                  }
                >
                  {statusLabel(channel.connectionStatus)}
                </Badge>
              </div>
              <h3 className="mt-4 text-base font-bold">{channel.name}</h3>
              <p className="mt-1 text-[10px] text-[#7A8381]">
                {channel.lastSyncedAt
                  ? `Atualizado ${dateTime(channel.lastSyncedAt)}`
                  : "Ainda sem sincronização"}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#F7F8F6] p-3">
                <SmallMetric label="Pedidos" value={String(channel.orders)} />
                <SmallMetric
                  label="Pendentes"
                  value={String(channel.pending)}
                />
                <SmallMetric label="Taxas" value={money.format(channel.fees)} />
                <SmallMetric
                  label="Líquido"
                  value={money.format(channel.net)}
                />
              </div>
            </Card>
          ))}
          {!dashboard.channels.length && !loading && (
            <p className="text-xs text-[#7A8381]">
              Nenhum marketplace disponível para este acesso.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#087568]">
                Fila operacional
              </p>
              <h2 className="mt-1 text-lg font-bold">
                Pedidos recebidos dos canais
              </h2>
            </div>
            <Link href="/pedidos" className="text-xs font-bold text-[#087568]">
              Todos os pedidos <ArrowRight className="inline" size={13} />
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="border-b border-[#E7E7E3] text-[9px] uppercase tracking-wider text-[#7A8381]">
                <tr>
                  <th className="pb-2">Canal / pedido</th>
                  <th className="pb-2">Status no canal</th>
                  <th className="pb-2">Entrada BBOS</th>
                  <th className="pb-2 text-right">Valor</th>
                  <th className="pb-2 text-right">Atualização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEFEB]">
                {dashboard.orders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-3">
                      <strong>{order.channelName}</strong>
                      <span className="block text-[10px] text-[#7A8381]">
                        #{order.externalOrderId}
                      </span>
                    </td>
                    <td className="py-3">{order.externalStatus ?? "—"}</td>
                    <td className="py-3">
                      <Badge tone={orderTone(order.importStatus)}>
                        {inboxLabel(order.importStatus)}
                      </Badge>
                    </td>
                    <td className="py-3 text-right font-bold">
                      {money.format(Number(order.grossAmount ?? 0))}
                    </td>
                    <td className="py-3 text-right text-[10px] text-[#7A8381]">
                      {dateTime(order.lastSeenAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!dashboard.orders.length && (
              <Empty
                icon={ShoppingBag}
                text="Os pedidos aparecerão aqui assim que o canal conectado registrar vendas."
              />
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#087568]">
              <ShieldCheck size={13} /> Controle operacional
            </p>
            <h2 className="mt-2 text-lg font-bold">
              Estoque e pedidos protegidos
            </h2>
            <ul className="mt-4 space-y-3 text-xs leading-5 text-[#596360]">
              <li className="flex gap-2">
                <CheckCircle2
                  size={15}
                  className="mt-0.5 shrink-0 text-[#087568]"
                />{" "}
                Notificações duplicadas não criam pedidos duplicados.
              </li>
              <li className="flex gap-2">
                <CheckCircle2
                  size={15}
                  className="mt-0.5 shrink-0 text-[#087568]"
                />{" "}
                O pedido entra numa caixa de validação antes de movimentar
                estoque.
              </li>
              <li className="flex gap-2">
                <CheckCircle2
                  size={15}
                  className="mt-0.5 shrink-0 text-[#087568]"
                />{" "}
                A varredura periódica recupera eventos eventualmente perdidos.
              </li>
            </ul>
          </Card>
          <Card className="p-5">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#087568]">
              <Boxes size={13} /> Última sincronização
            </p>
            {dashboard.syncRuns[0] ? (
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <strong className="text-sm">
                    {dashboard.syncRuns[0].channelName ?? "Marketplace"}
                  </strong>
                  <Badge
                    tone={
                      dashboard.syncRuns[0].status === "SUCCEEDED"
                        ? "success"
                        : dashboard.syncRuns[0].status === "FAILED"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {syncLabel(dashboard.syncRuns[0].status)}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-[#66706D]">
                  {dashboard.syncRuns[0].recordsRead} registros ·{" "}
                  {dateTime(dashboard.syncRuns[0].startedAt)}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#7A8381]">
                A primeira sincronização ainda não foi executada.
              </p>
            )}
          </Card>
        </div>
      </section>

      {management && (
        <section className="mt-6 rounded-2xl border border-[#DDE6E3] bg-[#F4F8F7] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#087568]">
                <UsersRound size={13} /> Empresas terceirizadas
              </p>
              <h2 className="mt-1 text-lg font-bold">
                Acessos por pessoa e por canal
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-[#66706D]">
                Crie primeiro o usuário com o perfil “Operador externo de
                marketplace”; depois conceda somente os canais e ações
                contratados.
              </p>
            </div>
            <Link
              href="/usuarios"
              className="rounded-xl border border-[#087568] bg-white px-4 py-2.5 text-xs font-bold text-[#087568]"
            >
              Gerenciar usuários
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {operators.map((operator) => (
              <div
                key={operator.id}
                className="rounded-xl border border-[#DDE6E3] bg-white p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <strong className="text-sm">{operator.name}</strong>
                    <p className="mt-1 text-[10px] text-[#7A8381]">
                      {operator.operatorCompanyName || "Empresa não informada"}{" "}
                      · {operator.email}
                    </p>
                  </div>
                  <Badge tone={operator.active ? "success" : "neutral"}>
                    {operator.active ? "Ativo" : "Suspenso"}
                  </Badge>
                </div>
                <p className="mt-3 text-xs font-semibold text-[#315D55]">
                  {operator.channelName || "Todos os marketplaces"}
                </p>
                <p className="mt-2 text-[10px] text-[#7A8381]">
                  {permissionLabels(operator.permissions).join(" · ")}
                </p>
              </div>
            ))}
            {!operators.length && (
              <div className="rounded-xl border border-dashed border-[#C9D9D4] bg-white p-4 text-xs text-[#66706D]">
                Nenhuma empresa terceirizada possui acesso.
              </div>
            )}
          </div>
          <div className="mt-5 grid gap-3 rounded-xl border border-[#DDE6E3] bg-white p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#66706D]">
              Operador
              <select
                value={operatorUserId}
                onChange={(event) => setOperatorUserId(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-[#DDE6E3] px-3 py-2.5 text-xs font-semibold normal-case tracking-normal"
              >
                <option value="">Selecione</option>
                {operatorUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#66706D]">
              Empresa parceira
              <input
                value={operatorCompany}
                onChange={(event) => setOperatorCompany(event.target.value)}
                placeholder="Nome da agência"
                className="mt-1 block w-full rounded-xl border border-[#DDE6E3] px-3 py-2.5 text-xs font-semibold normal-case tracking-normal"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#66706D]">
              Marketplace
              <select
                value={operatorChannelId}
                onChange={(event) => setOperatorChannelId(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-[#DDE6E3] px-3 py-2.5 text-xs font-semibold normal-case tracking-normal"
              >
                <option value="">Selecione</option>
                {dashboard.channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => void grantAccess()}
              disabled={granting || !operatorUsers.length}
              className="rounded-xl bg-[#14201D] px-4 py-3 text-xs font-bold text-white disabled:opacity-40"
            >
              {granting ? "Concedendo…" : "Conceder acesso"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  attention = false,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#7A8381]">
        <Icon
          size={14}
          className={attention ? "text-amber-600" : "text-[#087568]"}
        />
        {label}
      </div>
      <p
        className={`mt-3 text-xl font-bold ${attention ? "text-amber-700" : ""}`}
      >
        {value}
      </p>
    </Card>
  );
}
function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-[#7A8381]">
        {label}
      </p>
      <p className="mt-1 text-xs font-bold">{value}</p>
    </div>
  );
}
function Empty({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  text: string;
}) {
  return (
    <div className="py-10 text-center text-xs text-[#7A8381]">
      <Icon className="mx-auto mb-2" size={20} />
      {text}
    </div>
  );
}
function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
function statusLabel(status: string) {
  return (
    (
      {
        CONNECTED: "Conectado",
        CONNECTING: "Conectando",
        ERROR: "Com erro",
        NOT_CONNECTED: "Não conectado",
      } as Record<string, string>
    )[status] ?? status
  );
}
function inboxLabel(status: string) {
  return (
    (
      {
        RECEIVED: "Recebido",
        READY: "Pronto",
        IMPORTED: "Importado",
        ATTENTION: "Revisar",
        ERROR: "Erro",
        IGNORED: "Ignorado",
      } as Record<string, string>
    )[status] ?? status
  );
}
function orderTone(
  status: string,
): "success" | "warning" | "danger" | "neutral" {
  return status === "IMPORTED"
    ? "success"
    : status === "ERROR"
      ? "danger"
      : status === "ATTENTION"
        ? "warning"
        : "neutral";
}
function syncLabel(status: string) {
  return (
    (
      {
        SUCCEEDED: "Concluída",
        FAILED: "Falhou",
        PARTIAL: "Parcial",
        RUNNING: "Em andamento",
      } as Record<string, string>
    )[status] ?? status
  );
}
function permissionLabels(permissions: Record<string, boolean>) {
  const labels: Record<string, string> = {
    view: "visualizar",
    orders: "pedidos",
    listings: "anúncios",
    prices: "preços",
    reconciliation: "conciliação",
  };
  return Object.entries(permissions ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => labels[key] ?? key);
}
