import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Entrega e devoluções", alternates: { canonical: "/loja/entrega-e-devolucoes" } };

export default function DeliveryPage() {
  return <main className="min-h-screen bg-[#fffaf2] px-5 py-10 text-[#0d1d17]">
    <article className="mx-auto max-w-3xl">
      <Link href="/loja" className="text-sm">← Voltar à loja</Link>
      <p className="mt-16 text-xs font-semibold uppercase tracking-[.16em]">Atendimento Bispo</p>
      <h1 className="mt-3 text-5xl font-semibold tracking-tight">Entrega e devoluções</h1>
      <div className="mt-10 space-y-8 text-base leading-7 text-stone-700">
        <section><h2 className="text-xl font-semibold text-[#0d1d17]">Prazos e frete</h2><p className="mt-2">O prazo e o valor disponíveis para o seu CEP são apresentados na sacola antes da compra. A contagem começa após a confirmação do pagamento e pode variar conforme a transportadora e a região.</p></section>
        <section><h2 className="text-xl font-semibold text-[#0d1d17]">Recebimento</h2><p className="mt-2">Ao receber, confira a embalagem. Se houver avaria, item divergente ou violação, fotografe o pacote e fale conosco o quanto antes para que possamos acompanhar o caso.</p></section>
        <section><h2 className="text-xl font-semibold text-[#0d1d17]">Arrependimento e devolução</h2><p className="mt-2">Compras on-line podem ser canceladas dentro do prazo legal aplicável. Por se tratar de alimento, o produto deverá estar lacrado, íntegro e sem sinais de uso, salvo em caso de defeito ou divergência.</p></section>
        <section><h2 className="text-xl font-semibold text-[#0d1d17]">Fale com a Bispo</h2><p className="mt-2">Envie o número do pedido e uma descrição para <a className="underline" href="mailto:pedidos@bispocoffees.com.br">pedidos@bispocoffees.com.br</a>. Bispo Coffees Ltda · CNPJ 13.008.726/0001-12 · Londrina, PR.</p></section>
      </div>
    </article>
  </main>;
}
