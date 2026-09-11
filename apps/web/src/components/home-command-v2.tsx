"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  ClipboardCheck,
  Factory,
  PackageCheck,
  ShieldAlert,
  Sparkles,
  Sprout,
  WalletCards,
} from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiRoot, fetchSessionIdentity, type SessionIdentity } from "@/lib/auth-session";
import { getApiBaseUrl } from "@/lib/api-url";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const kg = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

type AlertTone = "CRÍTICO" | "ATENÇÃO" | "INFORMATIVO" | "POSITIVO";
type HomeData = {
  salesToday: number;
  salesMonth: number;
  openOrders: number;
  overdueOrders: number;
  productionActualKg: number;
  productionPlannedKg: number;
  pendingLab: number;
  openPurchases: number;
  finishedGoodsUnits: number;
  finishedGoodsReserved: number;
  greenLots: Array<{ origin: string; code: string; variety: string; currentKg: number; reservedKg: number; status: string }>;
  alerts: Array<{ tone: AlertTone; title: string; impact: string; href: string; action: string }>;
};

const emptyHome: HomeData = {
  salesToday: 0,
  salesMonth: 0,
  openOrders: 0,
  overdueOrders: 0,
  productionActualKg: 0,
  productionPlannedKg: 0,
  pendingLab: 0,
  openPurchases: 0,
  finishedGoodsUnits: 0,
  finishedGoodsReserved: 0,
  greenLots: [],
  alerts: [],
};

export function HomeCommandV2() {
  const [home, setHome] = React.useState<HomeData>(emptyHome);
  const [identity, setIdentity] = React.useState<SessionIdentity | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const apiRoot = getApiBaseUrl();
    const authRoot = getApiRoot();
    void Promise.all([
      fetch(`${apiRoot}/dashboard/home`, { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : emptyHome)),
      fetchSessionIdentity(authRoot),
    ])
      .then(([data, user]) => {
        setHome(data as HomeData);
        setIdentity(user);
      })
      .finally(() => setLoaded(true));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = identity?.name?.split(" ")[0] ?? "";
  const critical = home.alerts.filter((item) => item.tone === "CRÍTICO").length;
  const attention = home.alerts.filter((item) => item.tone === "ATENÇÃO").length;
  const greenAvailable = home.greenLots.reduce((sum, lot) => sum + lot.currentKg, 0);
  const greenReserved = home.greenLots.reduce((sum, lot) => sum + lot.reservedKg, 0);

  const operationalSummary = critical
    ? `${critical} ponto${critical > 1 ? "s" : ""} crítico${critical > 1 ? "s" : ""} precisa${critical > 1 ? "m" : ""} de decisão.`
    : attention
      ? `${attention} ponto${attention > 1 ? "s" : ""} merece${attention > 1 ? "m" : ""} atenção hoje.`
      : "A operação está estável. Nenhuma ocorrência crítica foi identificada agora.";

  return (
    <div className="bbos-command mx-auto w-full max-w-[1580px] space-y-7">
      <section className="bbos-hero-panel">
        <div>
          <p className="bbos-eyebrow">Bispo Coffees · Intelligence Layer</p>
          <h1>{greeting}, {firstName}.</h1>
          <p className="bbos-hero-copy">{loaded ? operationalSummary : "Estou reunindo o contexto da operação para você."}</p>
          <div className="bbos-hero-actions">
            <Link href="#prioridades" className="bbos-btn-primary">Ver prioridades <ArrowRight size={15} /></Link>
            <Link href="/dashboard" className="bbos-btn-secondary">Abrir visão executiva</Link>
          </div>
        </div>
        <div className="bbos-ai-card" aria-label="Assistente de inteligência BBOS">
          <div className="bbos-ai-icon"><BrainCircuit size={19} /></div>
          <div>
            <span>BBOS IA</span>
            <strong>O que merece sua atenção?</strong>
            <p>Conecto vendas, estoque, produção, qualidade e financeiro para sugerir a próxima melhor ação.</p>
          </div>
          <Link href="/bi">Explorar inteligência <ArrowRight size={13} /></Link>
        </div>
      </section>

      <section id="prioridades" className="space-y-3">
        <SectionHeader eyebrow="Atenção do gestor" title="Decisões antes de relatórios" subtitle="O BBOS prioriza exceções. O que está normal fica silencioso." />
        {home.alerts.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {home.alerts.map((item) => <ActionCard key={`${item.tone}-${item.title}`} {...item} />)}
          </div>
        ) : (
          <EmptyGuidance
            icon={Sparkles}
            title="Nenhuma decisão urgente neste momento"
            text="Quando houver risco de estoque, atraso, margem, qualidade ou caixa, o BBOS traz aqui a causa e a ação recomendada."
            href="/dashboard"
            action="Ver panorama completo"
          />
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader eyebrow="Hoje" title="Pulso da operação" subtitle="Somente indicadores que têm uma ação associada." />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PulseCard icon={WalletCards} label="Vendas hoje" value={money.format(home.salesToday)} note={home.salesMonth > 0 ? `Mês: ${money.format(home.salesMonth)}` : "Ainda sem vendas registradas hoje"} href="/vendas" tone="green" />
          <PulseCard icon={PackageCheck} label="Pedidos" value={`${home.openOrders} em aberto`} note={home.overdueOrders ? `${home.overdueOrders} atrasado${home.overdueOrders > 1 ? "s" : ""}` : "Nenhum atraso registrado"} href="/pedidos" tone={home.overdueOrders ? "amber" : "blue"} />
          <PulseCard icon={Factory} label="Produção" value={`${kg.format(home.productionActualKg)} kg`} note={home.productionPlannedKg ? `Planejado: ${kg.format(home.productionPlannedKg)} kg` : "Sem produção programada"} href="/producao" tone="amber" />
          <PulseCard icon={ClipboardCheck} label="Qualidade" value={`${home.pendingLab} em análise`} note={home.pendingLab ? "Há lotes aguardando liberação" : "Nada aguardando avaliação"} href="/laboratorio" tone="violet" />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-3">
          <SectionHeader eyebrow="Estoques" title="Cobertura operacional" subtitle="O sistema deve avisar antes de faltar, não depois." />
          <Card className="bbos-soft-card p-0">
            <div className="grid gap-px bg-[var(--bbos-border)] sm:grid-cols-2">
              <StockPanel icon={PackageCheck} title="Produto acabado" value={`${kg.format(home.finishedGoodsUnits)} un.`} secondary={`${kg.format(home.finishedGoodsReserved)} reservadas`} href="/estoque" />
              <StockPanel icon={Sprout} title="Café verde" value={`${kg.format(greenAvailable)} kg`} secondary={`${kg.format(greenReserved)} kg reservados`} href="/cafe-verde" />
            </div>
          </Card>
        </div>
        <div className="space-y-3">
          <SectionHeader eyebrow="Próxima ação" title="BBOS conduz o trabalho" subtitle="Menos procura por telas. Mais orientação contextual." />
          <Card className="bbos-guide-card p-5">
            <div className="flex items-start gap-3">
              <span className="bbos-guide-icon"><Sparkles size={17} /></span>
              <div>
                <p className="text-sm font-bold">Quer organizar o próximo passo?</p>
                <p className="mt-1 text-xs leading-5 text-[var(--bbos-text-secondary)]">Comece pelas exceções, depois pelos pedidos e só então pela programação da produção. O BBOS evita que você precise descobrir sozinho a sequência.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <QuickLink href="/pedidos" label="Revisar pedidos" />
              <QuickLink href="/producao" label="Programar produção" />
              <QuickLink href="/financeiro" label="Checar financeiro" />
            </div>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader eyebrow="Matéria-prima" title="Lotes que pedem acompanhamento" subtitle="Contexto, situação e acesso direto ao ponto certo." />
        {home.greenLots.length ? (
          <Card className="bbos-soft-card overflow-hidden p-0">
            <div className="divide-y divide-[var(--bbos-border)]">
              {home.greenLots.slice(0, 6).map((lot) => (
                <Link href="/cafe-verde" key={`${lot.code}-${lot.origin}`} className="bbos-lot-row">
                  <div><strong>{lot.origin} · {lot.code}</strong><span>{lot.variety}</span></div>
                  <div><small>Disponível</small><strong>{kg.format(lot.currentKg)} kg</strong></div>
                  <div><small>Reservado</small><strong>{kg.format(lot.reservedKg)} kg</strong></div>
                  <span className="bbos-status-chip">{lot.status}</span>
                  <ArrowRight size={14} />
                </Link>
              ))}
            </div>
          </Card>
        ) : (
          <EmptyGuidance icon={Sprout} title="Nenhum lote de café verde disponível" text="Cadastre ou receba o primeiro lote para que o BBOS calcule cobertura, reservas e risco de falta." href="/cafe-verde" action="Ir para Café Verde" />
        )}
      </section>

      <p className="bbos-data-note">Os números desta tela vêm do banco operacional. Quando um indicador não possui dados suficientes, o BBOS mostra orientação em vez de inventar valores.</p>
    </div>
  );
}

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div><p className="bbos-eyebrow">{eyebrow}</p><h2 className="mt-1 text-xl font-bold tracking-tight">{title}</h2><p className="mt-1 text-xs text-[var(--bbos-text-secondary)]">{subtitle}</p></div>;
}

function ActionCard({ tone, title, impact, href, action }: HomeData["alerts"][number]) {
  const icon = tone === "CRÍTICO" ? ShieldAlert : tone === "ATENÇÃO" ? Factory : tone === "POSITIVO" ? WalletCards : ClipboardCheck;
  const Icon = icon;
  return <Card className={`bbos-action-card bbos-tone-${tone.toLowerCase().replace("í", "i").replace("ç", "c").replace("ã", "a")}`}><div className="flex items-start justify-between gap-3"><span className="bbos-action-icon"><Icon size={16}/></span><span className="bbos-action-tone">{tone}</span></div><h3>{title}</h3><p>{impact}</p><Link href={href}>{action} <ArrowRight size={12}/></Link></Card>;
}

function PulseCard({ icon: Icon, label, value, note, href, tone }: { icon: typeof Factory; label: string; value: string; note: string; href: string; tone: "green" | "blue" | "amber" | "violet" }) {
  return <Link href={href} className={`bbos-pulse bbos-pulse-${tone}`}><div className="bbos-pulse-top"><span><Icon size={16}/></span><ArrowRight size={14}/></div><small>{label}</small><strong>{value}</strong><p>{note}</p></Link>;
}

function StockPanel({ icon: Icon, title, value, secondary, href }: { icon: typeof Factory; title: string; value: string; secondary: string; href: string }) {
  return <Link href={href} className="bbos-stock-panel"><div className="flex items-center gap-2"><Icon size={16}/><span>{title}</span></div><strong>{value}</strong><p>{secondary}</p><span className="bbos-link">Ver detalhes <ArrowRight size={12}/></span></Link>;
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="bbos-quick-link">{label}<ArrowRight size={12}/></Link>;
}

function EmptyGuidance({ icon: Icon, title, text, href, action }: { icon: typeof Factory; title: string; text: string; href: string; action: string }) {
  return <Card className="bbos-empty-guidance p-5"><span><Icon size={17}/></span><div><strong>{title}</strong><p>{text}</p></div><Link href={href}>{action}<ArrowRight size={12}/></Link></Card>;
}
