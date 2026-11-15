import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Termos de compra", alternates: { canonical: "/loja/termos-de-compra" } };

export default function TermsPage() {
  return <main className="min-h-screen bg-[#fffaf2] px-5 py-10 text-[#0d1d17]">
    <article className="mx-auto max-w-3xl">
      <Link href="/loja" className="text-sm">← Voltar à loja</Link>
      <p className="mt-16 text-xs font-semibold uppercase tracking-[.16em]">Bispo Coffees</p>
      <h1 className="mt-3 text-5xl font-semibold tracking-tight">Termos de compra</h1>
      <div className="mt-10 space-y-8 text-base leading-7 text-stone-700">
        <section><h2 className="text-xl font-semibold text-[#0d1d17]">Produtos e disponibilidade</h2><p className="mt-2">Safras, microlotes e estoques são limitados. A compra somente é concluída após confirmação do pagamento e disponibilidade do produto.</p></section>
        <section><h2 className="text-xl font-semibold text-[#0d1d17]">Preço e pagamento</h2><p className="mt-2">Preços, descontos, frete e valor total são exibidos antes da confirmação. Cupons seguem suas condições de validade e não geram saldo residual.</p></section>
        <section><h2 className="text-xl font-semibold text-[#0d1d17]">Dados do pedido</h2><p className="mt-2">O cliente é responsável pela exatidão do endereço e dos dados informados. Entraremos em contato quando uma correção for necessária.</p></section>
        <section><h2 className="text-xl font-semibold text-[#0d1d17]">Atendimento</h2><p className="mt-2">Dúvidas sobre pedidos: <a className="underline" href="mailto:pedidos@bispocoffees.com.br">pedidos@bispocoffees.com.br</a>. Bispo Coffees Ltda · CNPJ 13.008.726/0001-12 · Londrina, PR.</p></section>
      </div>
    </article>
  </main>;
}
