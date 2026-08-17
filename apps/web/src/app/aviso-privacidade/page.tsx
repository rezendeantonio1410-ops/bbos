import Image from "next/image";

export default function PrivacyNoticePage() {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 text-forest-950 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm sm:p-10">
        <Image src="/brand/logo/bispo-logo-official.jpg" alt="Bispo Coffees" width={860} height={240} className="h-auto w-44 rounded bg-white object-contain" priority />
        <p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-forest-700">Bispo Coffees</p>
        <h1 className="mt-2 text-3xl font-semibold">Aviso de Privacidade</h1>
        <p className="mt-5 leading-7 text-stone-700">
          Os dados pessoais informados e os registros eletrônicos relacionados às confirmações de negócio são tratados pela Bispo Coffees para formalização, execução e administração da relação contratual, segurança da operação, manutenção de registros e exercício regular de direitos, observada a Lei nº 13.709/2018 (LGPD).
        </p>
        <p className="mt-4 leading-7 text-stone-700">
          O tratamento observa os princípios de segurança, necessidade e confidencialidade. Os registros são mantidos pelo período necessário às finalidades contratuais, legais e de auditoria aplicáveis.
        </p>
        <p className="mt-4 leading-7 text-stone-700">
          Para informações sobre seus dados e exercício dos direitos previstos na legislação aplicável, utilize os canais de contato já informados pela Bispo Coffees na relação comercial.
        </p>
      </article>
    </main>
  );
}
