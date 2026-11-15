import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Aviso de privacidade | Bispo Coffees", alternates: { canonical: "/aviso-privacidade" } };

export default function PrivacyNoticePage() {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 text-forest-950 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm sm:p-10">
        <Link href="/loja" className="text-sm text-forest-900">← Voltar à loja</Link>
        <Image src="/brand/logo/bispo-logo-official-transparent.png" alt="Bispo Coffees" width={860} height={240} className="h-auto w-44 object-contain" priority />
        <p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-forest-700">Bispo Coffees</p>
        <h1 className="mt-2 text-3xl font-semibold">Aviso de Privacidade</h1>
        <p className="mt-5 leading-7 text-stone-700">
          Os dados pessoais informados e os registros eletrônicos relacionados às confirmações de negócio são tratados pela Bispo Coffees para formalização, execução e administração da relação contratual, segurança da operação, manutenção de registros e exercício regular de direitos, observada a Lei nº 13.709/2018 (LGPD).
        </p>
        <p className="mt-4 leading-7 text-stone-700">
          O tratamento observa os princípios de segurança, necessidade e confidencialidade. Os registros são mantidos pelo período necessário às finalidades contratuais, legais e de auditoria aplicáveis.
        </p>
        <p className="mt-4 leading-7 text-stone-700">
          Você pode solicitar confirmação de tratamento, acesso, correção, portabilidade, informação sobre compartilhamentos, eliminação quando cabível e revisão de decisões automatizadas. Para exercer seus direitos, escreva para <a className="underline" href="mailto:pedidos@bispocoffees.com.br">pedidos@bispocoffees.com.br</a>.
        </p>
        <h2 className="mt-8 text-xl font-semibold">Dados e finalidades</h2>
        <p className="mt-3 leading-7 text-stone-700">Podemos tratar identificação, contato, endereço, dados do pedido, pagamento tokenizado, atendimento e registros técnicos para processar compras, entregar produtos, prevenir fraude, cumprir obrigações legais e melhorar a experiência.</p>
        <h2 className="mt-8 text-xl font-semibold">Compartilhamento e segurança</h2>
        <p className="mt-3 leading-7 text-stone-700">Dados estritamente necessários podem ser compartilhados com operadores de pagamento, logística, hospedagem e atendimento. Adotamos controles técnicos e organizacionais proporcionais ao risco e não comercializamos dados pessoais.</p>
        <p className="mt-8 text-xs text-stone-500">Controladora: Bispo Coffees Ltda · CNPJ 13.008.726/0001-12 · Londrina, PR. Atualizado em 29 de setembro de 2026.</p>
      </article>
    </main>
  );
}
