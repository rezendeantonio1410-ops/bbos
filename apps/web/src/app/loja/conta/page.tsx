"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Coffee, PackageCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./account.module.css";

export default function CustomerAccountEntryPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [developmentCode, setDevelopmentCode] = useState("");

  useEffect(() => {
    fetch("/api/storefront/customer/me", { cache: "no-store" })
      .then((response) => {
        if (response.ok) router.replace("/loja/conta/painel");
      })
      .catch(() => undefined);
  }, [router]);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/storefront/customer/auth/request-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Não foi possível enviar o código.");
      setDevelopmentCode(body.developmentCode || "");
      setStage("code");
      setMessage(`Enviamos um código de seis dígitos para ${email}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o código.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/storefront/customer/auth/verify-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Código inválido ou expirado.");
      router.replace("/loja/conta/painel");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Código inválido ou expirado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.entryPage}>
      <header className={styles.entryHeader}>
        <Link href="/loja" aria-label="Bispo Coffees — voltar à loja">
          <Image src="/brand/logo/bispo-logo-official-transparent.png" width={176} height={58} alt="Bispo Coffees" priority />
        </Link>
        <Link href="/loja"><ArrowLeft /> Voltar à loja</Link>
      </header>

      <div className={styles.entryGrid}>
        <section className={styles.entryStory}>
          <span className={styles.eyebrow}>MINHA BISPO</span>
          <h1>Sua relação com o café continua aqui.</h1>
          <p>Acompanhe cada pedido, guarde seus cafés preferidos e escolha quando quer reencontrá-los.</p>
          <div className={styles.entryPromises}>
            <article><PackageCheck /><div><strong>Pedidos acompanhados</strong><span>Da escolha à chegada na sua casa.</span></div></article>
            <article><RefreshCw /><div><strong>Recompra sem atrito</strong><span>Refaça uma escolha quando quiser. Sem renovação automática.</span></div></article>
            <article><Coffee /><div><strong>Uma memória de sabor</strong><span>Seus perfis e cafés reunidos em um só lugar.</span></div></article>
          </div>
          <blockquote>“A confiança começa quando cada escolha já foi cuidada.”<cite>Bispo Coffees · True Coffee</cite></blockquote>
        </section>

        <section className={styles.entryAccess} aria-labelledby="access-title">
          <span className={styles.previewFlag}>ACESSO PROTEGIDO</span>
          <div>
            <small>ACESSO SEM SENHA</small>
            <h2 id="access-title">Entre na sua Bispo.</h2>
            <p>Enviaremos um código seguro para o seu e-mail. Nada de criar ou lembrar mais uma senha.</p>
          </div>
          {stage === "email" ? (
            <form className={styles.previewForm} onSubmit={requestCode}>
              <label htmlFor="customer-email">E-mail usado nas compras</label>
              <input id="customer-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="voce@exemplo.com" required />
              <button disabled={loading} type="submit">{loading ? "Enviando…" : "Receber código"} <ArrowRight /></button>
            </form>
          ) : (
            <form className={styles.previewForm} onSubmit={verifyCode}>
              <label htmlFor="customer-code">Código enviado para {email}</label>
              <input id="customer-code" className={styles.codeInput} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required minLength={6} maxLength={6} />
              <button disabled={loading || code.length !== 6} type="submit">{loading ? "Verificando…" : "Entrar na minha Bispo"} <ArrowRight /></button>
              <button className={styles.textButton} type="button" onClick={() => { setStage("email"); setCode(""); setMessage(""); }}>Usar outro e-mail</button>
            </form>
          )}
          {message && <p className={styles.accessMessage} role="status">{message}</p>}
          {developmentCode && <p className={styles.developmentCode}>Código local: <strong>{developmentCode}</strong></p>}
          <p className={styles.securityNote}><ShieldCheck /> O código expira em 10 minutos e só pode ser usado uma vez.</p>
          <footer>
            <span>Primeira compra?</span>
            <Link href="/loja#cafes">Conhecer os cafés →</Link>
          </footer>
        </section>
      </div>
    </main>
  );
}
