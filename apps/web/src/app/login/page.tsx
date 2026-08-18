"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@bbos/ui";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }), signal: controller.signal });
      await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error("Credenciais inválidas.");
        throw new Error("Não foi possível entrar no BBOS.");
      }
      const requestedReturnTo = new URLSearchParams(window.location.search).get("returnTo");
      const destination = requestedReturnTo && requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") ? requestedReturnTo : "/home";
      router.replace(destination);
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "Credenciais inválidas." ? cause.message : "Não foi possível conectar ao BBOS.");
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-forest-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-28 -top-28 size-[420px] rounded-full border-[80px] border-white/[.035]" />
        <Logo variant="login" />
        <div className="relative max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-coffee-400">Bispo Business Operating System</p>
          <h1 className="mt-6 text-balance font-[var(--font-manrope)] text-5xl font-bold leading-[1.08] tracking-tight">Toda a operação industrial, em uma visão clara.</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/60">Decisões orientadas por dados, custos rastreáveis e execução conectada para a Bispo Coffees.</p>
          <div className="mt-10 flex gap-8">{["Custos reais", "Operação integrada", "Decisões rápidas"].map((item) => <span key={item} className="flex items-center gap-2 text-xs font-semibold text-white/80"><CheckCircle2 size={15} className="text-coffee-400" />{item}</span>)}</div>
        </div>
        <p className="text-xs text-white/35">© 2026 Bispo Coffees. Ambiente industrial.</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-12 lg:hidden"><Logo variant="login" /></div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-forest-700">Bem-vindo</p>
          <h2 className="mt-3 font-[var(--font-manrope)] text-3xl font-bold tracking-tight">Acesse o BBOS</h2>
          <p className="mt-2 text-sm text-stone-500">Entre com suas credenciais corporativas.</p>
          <form onSubmit={submit} className="mt-9 space-y-5">
            <label className="block"><span className="text-xs font-semibold text-stone-700">E-mail</span><span className="mt-2 flex items-center gap-3 rounded-xl border bg-stone-50 px-4 py-3.5 focus-within:border-forest-700"><Mail size={17} className="text-stone-400" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full bg-transparent text-sm outline-none" /></span></label>
            <label className="block"><span className="text-xs font-semibold text-stone-700">Senha</span><span className="mt-2 flex items-center gap-3 rounded-xl border bg-stone-50 px-4 py-3.5 focus-within:border-forest-700"><LockKeyhole size={17} className="text-stone-400" /><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-transparent text-sm outline-none" /></span></label>
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <Button disabled={busy} type="submit" className="flex w-full items-center justify-center gap-2 py-3.5">{busy ? "Entrando…" : "Entrar no BBOS"} <ArrowRight size={16} /></Button>
          </form>
          <p className="mt-8 text-center text-xs text-stone-400">Ambiente seguro • Acesso restrito à equipe Bispo</p>
        </div>
      </section>
    </main>
  );
}
