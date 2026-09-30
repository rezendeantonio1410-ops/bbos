"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, BrainCircuit, Send, Sparkles, X } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type IntelligenceFact = { label: string; value: string; href: string };
type Message = { role: "assistant" | "user"; text: string; facts?: IntelligenceFact[] };

type RouteContext = {
  title: string;
  intro: string;
  prompts: string[];
};

const routeContext: Record<string, RouteContext> = {
  "/home": { title: "Central de comando", intro: "Posso ajudar a priorizar o dia, explicar alertas e indicar o próximo passo.", prompts: ["O que merece minha atenção agora?", "O que faço primeiro?", "Existe algum risco hoje?"] },
  "/dashboard": { title: "Visão executiva", intro: "Posso interpretar os indicadores e transformar variações em decisões.", prompts: ["O que mudou no período?", "Onde está o maior risco?", "Explique o ROI e a margem."] },
  "/dashboard-industrial": { title: "Operação industrial", intro: "Posso conectar produção, perdas, capacidade e estoque para orientar a operação.", prompts: ["Existe gargalo de produção?", "O que pode atrasar?", "Onde estamos perdendo eficiência?"] },
  "/cafe-verde": { title: "Café Verde", intro: "Posso ajudar a acompanhar compras, recebimentos, lotes, qualidade e disponibilidade.", prompts: ["Qual lote pede atenção?", "O que está aguardando ação?", "Tenho café suficiente para produzir?"] },
  "/producao": { title: "Produção", intro: "Posso sugerir a próxima ação usando pedidos, estoque, capacidade e programação.", prompts: ["O que devo produzir primeiro?", "Há risco de falta?", "Ajude a preparar uma OP."] },
  "/blends": { title: "Blends", intro: "Posso ajudar a conferir composição, disponibilidade dos lotes e impacto da receita antes da produção.", prompts: ["Qual blend pode ser produzido agora?", "Existe componente em risco?", "O que impede esta receita?"] },
  "/produtos": { title: "Produtos", intro: "Posso conectar produto, estoque, custo, preço e demanda para apoiar decisões sem esconder a origem dos números.", prompts: ["Qual produto merece atenção?", "Existe risco de ruptura?", "O preço e a margem estão coerentes?"] },
  "/laboratorio": { title: "Laboratório", intro: "Posso orientar a próxima etapa de qualidade, cupping, aprovação e rastreabilidade sem substituir a decisão técnica.", prompts: ["O que está aguardando prova?", "Qual amostra exige decisão?", "Existe lote bloqueado por qualidade?"] },
  "/clientes": { title: "Clientes", intro: "Posso ajudar a entender carteira, crédito, comportamento e próxima melhor ação comercial.", prompts: ["Quem merece contato hoje?", "Há cliente em risco?", "Qual próxima ação comercial?"] },
  "/pedidos": { title: "Pedidos", intro: "Posso apontar pendências, riscos e o caminho mais curto até a expedição.", prompts: ["Qual pedido está travado?", "O que precisa ser resolvido agora?", "Há risco de atraso?"] },
  "/vendas": { title: "Vendas", intro: "Posso interpretar desempenho, tendência, mix, margem e oportunidades.", prompts: ["O que explica as vendas?", "Qual produto merece foco?", "Como está a margem?"] },
  "/commerce": { title: "Commerce", intro: "Posso conectar loja, pedidos, estoque e operação para antecipar problemas no canal digital.", prompts: ["A loja está saudável?", "Existe pedido online em atenção?", "O que falta integrar?"] },
  "/financeiro": { title: "Financeiro", intro: "Posso ajudar a interpretar caixa, recebíveis, pagamentos, projeção e impacto operacional.", prompts: ["O que pressiona o caixa?", "Qual compromisso merece atenção?", "Como está a projeção?"] },
  "/custos": { title: "Custos", intro: "Posso explicar formação de custo, variações e impacto em margem e ROI usando somente dados rastreáveis.", prompts: ["O que está pressionando o custo?", "Qual produto perdeu margem?", "Onde devo investigar primeiro?"] },
  "/exportacoes": { title: "Exportações", intro: "Posso conferir a carteira internacional, a prontidão comercial e as pendências antes de documentos e logística.", prompts: ["O que exige atenção agora?", "A base comercial está completa?", "Qual é o valor da carteira?"] },
  "/bi": { title: "Inteligência", intro: "Posso transformar dados operacionais em perguntas, explicações e próximas ações, sempre deixando claro quando falta evidência.", prompts: ["O que merece atenção agora?", "Que decisão está sem dados suficientes?", "Onde existe uma oportunidade?"] },
};

function getContext(pathname: string) {
  const exact = routeContext[pathname];
  if (exact) return exact;
  const prefix = Object.keys(routeContext)
    .sort((a, b) => b.length - a.length)
    .find((key) => key !== "/home" && pathname.startsWith(`${key}/`));
  return prefix ? routeContext[prefix]! : routeContext["/home"]!;
}

export function BbosAssistant() {
  const pathname = usePathname();
  const context = getContext(pathname);
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [sending, setSending] = React.useState(false);
  const isSystem = pathname === "/home" || pathname === "/dashboard" || pathname === "/dashboard-industrial" || pathname.startsWith("/cafe-verde") || pathname.startsWith("/producao") || pathname.startsWith("/clientes") || pathname.startsWith("/pedidos") || pathname.startsWith("/vendas") || pathname.startsWith("/commerce") || pathname.startsWith("/financeiro") || pathname.startsWith("/produtos") || pathname.startsWith("/blends") || pathname.startsWith("/laboratorio") || pathname.startsWith("/custos") || pathname.startsWith("/exportacoes") || pathname.startsWith("/bi");

  React.useEffect(() => { setMessages([{ role: "assistant", text: context.intro }]); }, [pathname, context.intro]);

  React.useEffect(() => {
    const openAssistant = () => setOpen(true);
    const interceptIntelligenceLinks = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      const label = anchor.textContent?.toLowerCase() ?? "";
      const opensAssistant = href === "/bi" && (
        label.includes("ia") ||
        label.includes("inteligência") ||
        label.includes("intelligence") ||
        label.includes("me ajude")
      );
      if (opensAssistant) {
        event.preventDefault();
        setOpen(true);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("bbos:open-assistant", openAssistant);
    document.addEventListener("click", interceptIntelligenceLinks);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("bbos:open-assistant", openAssistant);
      document.removeEventListener("click", interceptIntelligenceLinks);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (!isSystem) return null;

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setInput("");
    setSending(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/intelligence/ask`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, path: pathname }),
      });
      if (!response.ok) throw new Error(`Intelligence request failed (${response.status})`);
      const payload = await response.json() as { answer?: string; facts?: IntelligenceFact[] };
      if (!payload.answer) throw new Error("Intelligence response is incomplete");
      setMessages((current) => [...current, { role: "assistant", text: payload.answer!, facts: payload.facts }]);
    } catch {
      setMessages((current) => [...current, {
        role: "assistant",
        text: "Não consegui confirmar os dados oficiais nesta consulta. Para não inventar uma resposta, tente novamente ou abra o módulo relacionado.",
      }]);
    } finally {
      setSending(false);
    }
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} className="bbos-ai-fab" aria-label="Abrir BBOS Intelligence"><Sparkles size={16}/><span>BBOS</span></button>
    {open && <div className="bbos-ai-overlay" role="dialog" aria-modal="true" aria-label="BBOS Intelligence">
      <button className="bbos-ai-backdrop" aria-label="Fechar inteligência" onClick={() => setOpen(false)}/>
      <aside className="bbos-ai-panel">
        <header><div className="bbos-ai-panel-icon"><BrainCircuit size={18}/></div><div><span>BBOS Intelligence</span><strong>{context.title}</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar"><X size={17}/></button></header>
        <div className="bbos-ai-context"><span>Contexto atual</span><strong>{context.title}</strong><small>A ajuda acompanha você sem tirar você da tarefa.</small></div>
        <div className="bbos-ai-conversation" aria-live="polite">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`bbos-ai-message bbos-ai-message-${message.role}`}><p>{message.text}</p>{message.facts?.length ? <div className="bbos-ai-facts">{message.facts.map((fact) => <a key={`${fact.label}-${fact.href}`} href={fact.href}><span>{fact.label}</span><strong>{fact.value}</strong></a>)}</div> : null}</div>)}{sending ? <div className="bbos-ai-message bbos-ai-message-assistant bbos-ai-thinking">Consultando os dados oficiais…</div> : null}</div>
        <div className="bbos-ai-prompts">{context.prompts.map((prompt) => <button key={prompt} type="button" disabled={sending} onClick={() => void ask(prompt)}>{prompt}<ArrowRight size={11}/></button>)}</div>
        <form onSubmit={(event) => { event.preventDefault(); void ask(input); }} className="bbos-ai-input"><input value={input} disabled={sending} onChange={(event) => setInput(event.target.value)} placeholder="Pergunte como falaria com alguém da equipe…" aria-label="Perguntar ao BBOS Intelligence"/><button type="submit" disabled={sending} aria-label="Enviar pergunta"><Send size={15}/></button></form>
        <p className="bbos-ai-trust">Análise operacional por regras e dados oficiais. A camada generativa ainda não está habilitada. Decisões críticas exigem confirmação humana.</p>
      </aside>
    </div>}
  </>;
}
