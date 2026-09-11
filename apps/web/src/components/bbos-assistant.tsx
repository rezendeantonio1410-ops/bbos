"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, BrainCircuit, Send, Sparkles, X } from "lucide-react";

type Message = { role: "assistant" | "user"; text: string };

const routeContext: Record<string, { title: string; intro: string; prompts: string[] }> = {
  "/home": {
    title: "Central de comando",
    intro: "Posso ajudar a priorizar o dia, explicar alertas e indicar o próximo passo.",
    prompts: ["O que merece minha atenção agora?", "O que faço primeiro?", "Existe algum risco hoje?"],
  },
  "/dashboard": {
    title: "Visão executiva",
    intro: "Posso interpretar os indicadores e transformar variações em decisões.",
    prompts: ["O que mudou no período?", "Onde está o maior risco?", "Explique o ROI e a margem."],
  },
  "/dashboard-industrial": {
    title: "Operação industrial",
    intro: "Posso conectar produção, perdas, capacidade e estoque para orientar a operação.",
    prompts: ["Existe gargalo de produção?", "O que pode atrasar?", "Onde estamos perdendo eficiência?"],
  },
  "/cafe-verde": {
    title: "Café Verde",
    intro: "Posso ajudar a acompanhar compras, recebimentos, lotes, qualidade e disponibilidade.",
    prompts: ["Qual lote pede atenção?", "O que está aguardando ação?", "Tenho café suficiente para produzir?"],
  },
  "/producao": {
    title: "Produção",
    intro: "Posso sugerir a próxima ação usando pedidos, estoque, capacidade e programação.",
    prompts: ["O que devo produzir primeiro?", "Há risco de falta?", "Ajude a preparar uma OP."],
  },
  "/clientes": {
    title: "Clientes",
    intro: "Posso ajudar a entender carteira, crédito, comportamento e próxima melhor ação comercial.",
    prompts: ["Quem merece contato hoje?", "Há cliente em risco?", "Qual próxima ação comercial?"],
  },
  "/pedidos": {
    title: "Pedidos",
    intro: "Posso apontar pendências, riscos e o caminho mais curto até a expedição.",
    prompts: ["Qual pedido está travado?", "O que precisa ser resolvido agora?", "Há risco de atraso?"],
  },
  "/vendas": {
    title: "Vendas",
    intro: "Posso interpretar desempenho, tendência, mix, margem e oportunidades.",
    prompts: ["O que explica as vendas?", "Qual produto merece foco?", "Como está a margem?"],
  },
  "/commerce": {
    title: "Commerce",
    intro: "Posso conectar loja, pedidos, estoque e operação para antecipar problemas no canal digital.",
    prompts: ["A loja está saudável?", "Existe pedido online em atenção?", "O que falta integrar?"],
  },
  "/financeiro": {
    title: "Financeiro",
    intro: "Posso ajudar a interpretar caixa, recebíveis, pagamentos, projeção e impacto operacional.",
    prompts: ["O que pressiona o caixa?", "Qual compromisso merece atenção?", "Como está a projeção?"],
  },
};

function getContext(pathname: string) {
  const exact = routeContext[pathname];
  if (exact) return exact;
  const prefix = Object.keys(routeContext).find((key) => key !== "/home" && pathname.startsWith(`${key}/`));
  return prefix ? routeContext[prefix]! : routeContext["/home"]!;
}

function localAnswer(question: string, context: ReturnType<typeof getContext>) {
  const q = question.toLowerCase();
  if (q.includes("primeiro") || q.includes("próxima") || q.includes("proxima")) {
    return `Eu começaria pelas exceções em ${context.title}. Se não houver alerta, siga para o item com impacto mais próximo em cliente, estoque, produção ou caixa. Posso conduzir esse caminho sem você precisar procurar telas.`;
  }
  if (q.includes("risco") || q.includes("atenção") || q.includes("atencao")) {
    return `Nesta etapa, eu priorizo risco real e deixo o que está normal silencioso. Quando houver dados suficientes, vou explicar a causa, o impacto e a ação recomendada — não apenas exibir um alerta.`;
  }
  if (q.includes("op") || q.includes("produ")) {
    return "Para uma recomendação de produção confiável, eu cruzo pedidos, estoque disponível, reservas, capacidade e matéria-prima. Quando algum desses dados faltar, eu aviso em vez de inventar uma resposta.";
  }
  if (q.includes("margem") || q.includes("roi") || q.includes("caixa")) {
    return "Eu separo faturamento, margem, caixa e ROI porque são decisões diferentes. A recomendação só deve aparecer quando a origem do número estiver rastreável no BBOS.";
  }
  return `${context.intro} Esta primeira camada já entende onde você está e reduz procura por menus. A próxima camada conecta o modelo generativo aos dados oficiais do BBOS para análises mais profundas, sempre com origem e confiança visíveis.`;
}

export function BbosAssistant() {
  const pathname = usePathname();
  const context = getContext(pathname);
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([]);

  const isSystem = pathname === "/home" || pathname === "/dashboard" || pathname === "/dashboard-industrial" || pathname.startsWith("/cafe-verde") || pathname.startsWith("/producao") || pathname.startsWith("/clientes") || pathname.startsWith("/pedidos") || pathname.startsWith("/vendas") || pathname.startsWith("/commerce") || pathname.startsWith("/financeiro") || pathname.startsWith("/produtos") || pathname.startsWith("/blends") || pathname.startsWith("/laboratorio") || pathname.startsWith("/custos") || pathname.startsWith("/bi");

  React.useEffect(() => {
    setMessages([{ role: "assistant", text: context.intro }]);
  }, [pathname, context.intro]);

  React.useEffect(() => {
    const openAssistant = () => setOpen(true);
    window.addEventListener("bbos:open-assistant", openAssistant);
    return () => window.removeEventListener("bbos:open-assistant", openAssistant);
  }, []);

  if (!isSystem) return null;

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((current) => [...current, { role: "user", text: trimmed }, { role: "assistant", text: localAnswer(trimmed, context) }]);
    setInput("");
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="bbos-ai-fab" aria-label="Abrir BBOS Intelligence">
        <Sparkles size={16}/><span>IA</span>
      </button>
      {open && (
        <div className="bbos-ai-overlay" role="dialog" aria-modal="true" aria-label="BBOS Intelligence">
          <button className="bbos-ai-backdrop" aria-label="Fechar inteligência" onClick={() => setOpen(false)}/>
          <aside className="bbos-ai-panel">
            <header>
              <div className="bbos-ai-panel-icon"><BrainCircuit size={18}/></div>
              <div><span>BBOS Intelligence</span><strong>{context.title}</strong></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar"><X size={17}/></button>
            </header>
            <div className="bbos-ai-conversation">
              {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`bbos-ai-message bbos-ai-message-${message.role}`}>{message.text}</div>)}
            </div>
            <div className="bbos-ai-prompts">
              {context.prompts.map((prompt) => <button key={prompt} type="button" onClick={() => ask(prompt)}>{prompt}<ArrowRight size={11}/></button>)}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); ask(input); }} className="bbos-ai-input">
              <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Pergunte em linguagem natural…" aria-label="Perguntar ao BBOS Intelligence"/>
              <button type="submit" aria-label="Enviar pergunta"><Send size={15}/></button>
            </form>
            <p className="bbos-ai-trust">A IA orienta; ações críticas continuam sob confirmação humana. Recomendações devem usar dados rastreáveis do BBOS.</p>
          </aside>
        </div>
      )}
    </>
  );
}
