"use client";

import Link from "next/link";
import { Check, ChevronRight, Circle } from "lucide-react";
import { usePathname } from "next/navigation";

type Step = { label: string; href?: string; match?: string[] };
type Journey = { label: string; steps: Step[] };

const operational: Journey = {
  label: "Ciclo industrial",
  steps: [
    {
      label: "Compra",
      href: "/cafe-verde",
      match: ["/cafe-verde", "/compras-cafe-verde"],
    },
    { label: "Recebimento", href: "/cafe-verde", match: ["/recebimento"] },
    { label: "Laboratório", href: "/laboratorio", match: ["/laboratorio"] },
    { label: "Estoque verde", href: "/cafe-verde", match: ["/cafe-verde"] },
    { label: "Produção", href: "/producao", match: ["/producao", "/blends"] },
    {
      label: "Estoque torrado",
      href: "/estoque#cafe-torrado",
      match: ["/estoque"],
    },
    { label: "Produto acabado", href: "/produtos", match: ["/produtos"] },
  ],
};

const commercial: Journey = {
  label: "Ciclo da venda",
  steps: [
    { label: "Cliente", href: "/clientes", match: ["/clientes"] },
    {
      label: "Atendimento",
      href: "/atendimento",
      match: ["/atendimento"],
    },
    { label: "Preço / crédito", href: "/commerce", match: ["/commerce"] },
    { label: "Pedido", href: "/pedidos", match: ["/pedidos"] },
    { label: "Estoque", href: "/produtos", match: ["/produtos"] },
    {
      label: "Fiscal",
      href: "/financeiro",
      match: ["/fiscal", "/integracoes"],
    },
    { label: "Expedição", href: "/pedidos", match: ["/expedicao"] },
  ],
};

const management: Journey = {
  label: "Ciclo financeiro",
  steps: [
    { label: "Operação", href: "/home", match: ["/home"] },
    {
      label: "Documento",
      href: "/notas-entrada",
      match: ["/notas-entrada", "/fiscal"],
    },
    { label: "Título", href: "/financeiro", match: ["/financeiro"] },
    { label: "Pagamento", href: "/financeiro", match: ["/financeiro"] },
    { label: "Conciliação", href: "/financeiro", match: ["/financeiro"] },
    { label: "Margem / ROI", href: "/custos", match: ["/custos"] },
  ],
};

function journeyForPath(pathname: string): Journey | null {
  if (
    [
      "/cafe-verde",
      "/compras-cafe-verde",
      "/recebimento",
      "/laboratorio",
      "/producao",
      "/blends",
      "/estoque",
      "/produtos",
    ].some((prefix) => pathname.startsWith(prefix))
  )
    return operational;
  if (
    [
      "/clientes",
      "/atendimento",
      "/pedidos",
      "/vendas",
      "/commerce",
      "/expedicao",
    ].some((prefix) => pathname.startsWith(prefix))
  )
    return commercial;
  if (
    [
      "/notas-entrada",
      "/financeiro",
      "/custos",
      "/fiscal",
      "/integracoes",
    ].some((prefix) => pathname.startsWith(prefix))
  )
    return management;
  return null;
}

export function JourneyContextBar() {
  const pathname = usePathname();
  const journey = journeyForPath(pathname);
  if (!journey) return null;

  const activeIndex = Math.max(
    0,
    journey.steps.findIndex((step) =>
      step.match?.some((prefix) => pathname.startsWith(prefix)),
    ),
  );
  const currentStep = journey.steps[activeIndex];
  const nextStep = journey.steps[activeIndex + 1];

  return (
    <>
      <div className="mb-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-[0_6px_20px_rgba(18,34,29,.03)] md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-[9px] font-extrabold uppercase tracking-[.14em] text-stone-400">
              {journey.label} · etapa {activeIndex + 1} de{" "}
              {journey.steps.length}
            </span>
            <span className="mt-1 flex items-center gap-2 text-sm font-bold text-stone-900">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#EAF6F2] text-[#087568]">
                <Circle size={11} />
              </span>
              <span className="truncate">{currentStep?.label}</span>
            </span>
          </div>
          {nextStep?.href && (
            <Link
              href={nextStep.href}
              className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-stone-50 px-3 text-[10px] font-bold text-stone-600"
            >
              Próxima <ChevronRight size={13} />
            </Link>
          )}
        </div>
      </div>
      <div className="mb-5 hidden overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_8px_24px_rgba(18,34,29,.035)] md:block">
        <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-2.5 sm:px-5">
          <span className="text-[9px] font-extrabold uppercase tracking-[.15em] text-stone-400">
            {journey.label}
          </span>
          <span className="text-[10px] font-semibold text-stone-500">
            Você está aqui
          </span>
        </div>
        <div className="flex min-w-max items-center gap-1 overflow-x-auto px-3 py-3 sm:px-4">
          {journey.steps.map((step, index) => {
            const current = index === activeIndex;
            const done = index < activeIndex;
            const content = (
              <>
                <span
                  className={`grid size-6 place-items-center rounded-lg ${current ? "bg-[#EAF6F2] text-[#087568]" : done ? "bg-emerald-50 text-emerald-600" : "bg-stone-50 text-stone-300"}`}
                >
                  {done ? <Check size={12} /> : <Circle size={10} />}
                </span>
                <span
                  className={`text-[11px] font-semibold ${current ? "text-stone-900" : done ? "text-stone-600" : "text-stone-400"}`}
                >
                  {step.label}
                </span>
              </>
            );
            return (
              <div key={step.label} className="flex items-center gap-1">
                {step.href ? (
                  <Link
                    href={step.href}
                    className={`flex items-center gap-2 rounded-xl px-2.5 py-2 transition hover:bg-stone-50 ${current ? "ring-1 ring-[#087568]/15" : ""}`}
                  >
                    {content}
                  </Link>
                ) : (
                  <span className="flex items-center gap-2 rounded-xl px-2.5 py-2">
                    {content}
                  </span>
                )}
                {index < journey.steps.length - 1 && (
                  <ChevronRight size={13} className="text-stone-300" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
