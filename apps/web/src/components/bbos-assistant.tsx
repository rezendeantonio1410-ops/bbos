"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, BrainCircuit, Send, Sparkles, X } from "lucide-react";

type Message = { role: "assistant" | "user"; text: string };

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

function localAnswer(question: string, context: ReturnType<typeof getContext>) {
  const q = question.toLowerCase();
  if (q.includes("primeiro") || q.includes("próxima") || q.includes("proxima")) return `Eu começaria pelas exceções em ${context.title}. Se não houver alerta, sigo para o item com impacto mais próximo em cliente, estoque, produção ou caixa. Posso conduzir esse caminho sem você precisar procurar telas.`;
  if (q.includes("risco") || q.includes("atenção") || q.includes("atencao")) return "Eu priorizo risco real e deixo o que está normal silencioso. Quando houver dados suficientes, mostro causa, impacto, confiança e a ação recomendada — não apenas um alerta.";
  if (q.includes("op") || q.includes("produ")) return "Para recomendar produção com segurança, cruzo pedidos, estoque disponível, reservas, capacidade e matéria-prima. Se faltar algum dado, eu digo exatamente o que falta em vez de inventar uma resposta.";
  if (q.includes("margem") || q.includes("roi") || q.includes("caixa") || q.includes("custo")) return "Eu separo faturamento, custo, margem, caixa e ROI porque representam decisões diferentes. Só recomendo uma ação quando a origem do número estiver rastreável no BBOS.";
  if (q.includes("qualidade") || q.includes("amostra") || q.includes("lote")) return "Em qualidade, eu posso organizar evidências, pendências e rastreabilidade. Aprovação, bloqueio ou liberação continuam como decisão técnica explícita, registrada no BBOS.";
  return `${context.intro} Estou usando o contexto da tela para reduzir menus e tornar a ajuda parte natural do trabalho. A camada generativa conectada aos dados oficiais entra sobre essa mesma experiência, com origem e confiança visíveis.`;
}

export function BbosAssistant() {
  const pathname = usePathname();
  const context = getContext(pathname);
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const isSystem = pathname === "/home" || pathname === "/dashboard" || pathname === "/dashboard-industrial" || pathname.startsWith("/cafe-verde") || pathname.startsWith("/producao") || pathname.startsWith("/clientes") || pathname.startsWith("/pedidos") || pathname.startsWith("/vendas") || pathname.startsWith("/commerce") || pathname.startsWith("/financeiro") || pathname.startsWith("/produtos") || pathname.startsWith("/blends") || pathname.startsWith("/laboratorio") || pathname.startsWith("/custos") || pathname.startsWith("/bi");

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

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((current) => [...current, { role: "user", text: trimmed }, { role: "assistant", text: localAnswer(trimmed, context) }]);
    setInput("");
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} className="bbos-ai-fab" aria-label="Abrir BBOS Intelligence"><Sparkles size={16}/><span>IA</span></button>
    {open && <div className="bbos-ai-overlay" role="dialog" aria-modal="true" aria-label="BBOS Intelligence">
      <button className="bbos-ai-backdrop" aria-label="Fechar inteligência" onClick={() => setOpen(false)}/>
      <aside className="bbos-ai-panel">
        <header><div className="bbos-ai-panel-icon"><BrainCircuit size={18}/></div><div><span>BBOS Intelligence</span><strong>{context.title}</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar"><X size={17}/></button></header>
        <div className="bbos-ai-context"><span>Contexto atual</span><strong>{context.title}</strong><small>A ajuda acompanha você sem tirar você da tarefa.</small></div>
        <div className="bbos-ai-conversation" aria-live="polite">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`bbos-ai-message bbos-ai-message-${message.role}`}>{message.text}</div>)}</div>
        <div className="bbos-ai-prompts">{context.prompts.map((prompt) => <button key={prompt} type="button" onClick={() => ask(prompt)}>{prompt}<ArrowRight size={11}/></button>)}</div>
        <form onSubmit={(event) => { event.preventDefault(); ask(input); }} className="bbos-ai-input"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Pergunte como falaria com alguém da equipe…" aria-label="Perguntar ao BBOS Intelligence"/><button type="submit" aria-label="Enviar pergunta"><Send size={15}/></button></form>
        <p className="bbos-ai-trust">A IA orienta e explica. Decisões críticas continuam sob confirmação humana.</p>
      </aside>
    </div>}
  </>;
}
