"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  LockKeyhole,
  Mail,
  Smartphone,
} from "lucide-react";
import { Button } from "@bbos/ui";
import { SYSTEM_CREATOR_CREDIT_PT } from "@bbos/shared";
import { Logo } from "@/components/logo";
import { registerBbosServiceWorker } from "@/lib/push-client";

const API_WAKE_TIMEOUT_MS = 75000;
const LOGIN_TIMEOUT_MS = 30000;

type BbosInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [installPrompt, setInstallPrompt] =
    useState<BbosInstallPromptEvent | null>(null);
  const [appInstalled, setAppInstalled] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setAppInstalled(standalone);
    if (!standalone) void registerBbosServiceWorker().catch(() => undefined);

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BbosInstallPromptEvent);
    };
    const handleInstalled = () => {
      setAppInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      await registerBbosServiceWorker().catch(() => undefined);
      setShowInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setAppInstalled(true);
    setInstallPrompt(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("Conectando ao BBOS…");

    try {
      const health = await fetchWithTimeout(
        "/api/health",
        { method: "GET", credentials: "include", cache: "no-store" },
        API_WAKE_TIMEOUT_MS,
      );

      if (!health.ok) {
        throw new Error("A API do BBOS está indisponível no momento.");
      }

      setStatus("Validando credenciais…");
      const response = await fetchWithTimeout(
        "/api/auth/login",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        },
        LOGIN_TIMEOUT_MS,
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 || response.status === 403)
          throw new Error("Credenciais inválidas.");
        if (response.status === 404)
          throw new Error(
            "O serviço de autenticação não está disponível nesta versão.",
          );
        if (response.status >= 500)
          throw new Error("A API do BBOS está indisponível no momento.");
        throw new Error(
          typeof payload?.message === "string"
            ? payload.message
            : "Não foi possível entrar no BBOS.",
        );
      }

      setStatus("Acesso confirmado. Abrindo o BBOS…");
      const requestedReturnTo = new URLSearchParams(window.location.search).get(
        "returnTo",
      );
      const isPartner = payload?.user?.role === "PARTNER";
      const isAccountant = payload?.user?.role === "ACCOUNTANT";
      const safeReturnTo =
        requestedReturnTo &&
        requestedReturnTo.startsWith("/") &&
        !requestedReturnTo.startsWith("//") &&
        requestedReturnTo !== "/login" &&
        !requestedReturnTo.startsWith("/login?")
          ? requestedReturnTo
          : null;
      const destination = isPartner
        ? "/parceiro"
        : isAccountant
          ? "/financeiro"
        : safeReturnTo && !safeReturnTo.startsWith("/parceiro")
          ? safeReturnTo
          : "/home";
      // A full navigation is intentional here. Samsung Internet and installed
      // Android PWAs can occasionally keep the login client tree mounted after
      // a successful cookie-based authentication. Reloading the destination
      // makes the browser apply the new session before rendering the BBOS.
      window.location.replace(destination);
    } catch (cause) {
      setStatus("");
      if (cause instanceof DOMException && cause.name === "AbortError") {
        setError(
          "O BBOS está iniciando os serviços. Aguarde alguns segundos e tente novamente.",
        );
      } else if (cause instanceof TypeError) {
        setError(
          "Não foi possível conectar ao BBOS. Verifique a rede ou tente novamente.",
        );
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível conectar ao BBOS.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      data-bbos-login
      className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]"
    >
      <section className="relative hidden overflow-hidden bg-forest-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-28 -top-28 size-[420px] rounded-full border-[80px] border-white/[.035]" />
        <Logo variant="login" />
        <div className="relative max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-coffee-400">
            Bispo Business Operating System
          </p>
          <h1 className="mt-6 text-balance font-[var(--font-manrope)] text-5xl font-bold leading-[1.08] tracking-tight">
            Toda a operação industrial, em uma visão clara.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/60">
            Decisões orientadas por dados, custos rastreáveis e execução
            conectada para a Bispo Coffees.
          </p>
          <div className="mt-10 flex gap-8">
            {["Custos reais", "Operação integrada", "Decisões rápidas"].map(
              (item) => (
                <span
                  key={item}
                  className="flex items-center gap-2 text-xs font-semibold text-white/80"
                >
                  <CheckCircle2 size={15} className="text-coffee-400" />
                  {item}
                </span>
              ),
            )}
          </div>
        </div>
        <p className="text-xs text-white/35">
          © 2026 Bispo Coffees. Ambiente industrial.
        </p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-12 lg:hidden">
            <Logo variant="login" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-forest-700">
            Bem-vindo
          </p>
          <h2 className="mt-3 font-[var(--font-manrope)] text-3xl font-bold tracking-tight">
            Acesse o BBOS
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            Entre com suas credenciais corporativas.
          </p>
          {!appInstalled && (
            <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-emerald-800 shadow-sm">
                  <Smartphone size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-forest-950">
                    Instalar o BBOS neste tablet
                  </p>
                  <p className="mt-1 text-xs leading-5 text-stone-600">
                    Crie o ícone do BBOS na tela inicial do Samsung.
                  </p>
                  <button
                    type="button"
                    onClick={() => void installApp()}
                    className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest-950 px-4 text-sm font-bold text-white"
                  >
                    <Download size={17} /> Instalar aplicativo
                  </button>
                  {!installPrompt && showInstallHelp && (
                    <div className="mt-3 rounded-xl bg-white px-3 py-2.5 text-xs leading-5 text-stone-700">
                      <p>
                        <b>Chrome:</b> toque em <b>⋮</b>, depois em{" "}
                        <b>Adicionar à tela inicial</b> e <b>Instalar</b>.
                      </p>
                      <p className="mt-2">
                        <b>Samsung Internet:</b> toque em <b>☰</b>, depois em{" "}
                        <b>Adicionar página a</b> e <b>Tela inicial</b>.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
          {appInstalled && (
            <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-center text-xs font-semibold text-emerald-800">
              BBOS instalado neste dispositivo.
            </p>
          )}
          <form onSubmit={submit} className="mt-9 space-y-5">
            <label className="block">
              <span className="text-xs font-semibold text-stone-700">
                E-mail
              </span>
              <span className="mt-2 flex items-center gap-3 rounded-xl border bg-stone-50 px-4 py-3.5 focus-within:border-forest-700">
                <Mail size={17} className="text-stone-400" />
                <input
                  required
                  disabled={busy}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none disabled:opacity-60"
                />
              </span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-stone-700">
                Senha
              </span>
              <span className="mt-2 flex items-center gap-3 rounded-xl border bg-stone-50 px-4 py-3.5 focus-within:border-forest-700">
                <LockKeyhole size={17} className="text-stone-400" />
                <input
                  required
                  disabled={busy}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none disabled:opacity-60"
                />
              </span>
            </label>
            {status && !error && (
              <p
                role="status"
                className="rounded-xl bg-stone-100 p-3 text-sm text-stone-600"
              >
                {status}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <Button
              disabled={busy}
              type="submit"
              className="flex w-full items-center justify-center gap-2 py-3.5"
            >
              {busy ? "Conectando…" : "Entrar no BBOS"} <ArrowRight size={16} />
            </Button>
          </form>
          <p className="mt-8 text-center text-xs text-stone-400">
            Ambiente seguro • Acesso restrito à equipe Bispo
          </p>
          <p className="mt-3 text-center text-[10px] text-stone-300">
            {SYSTEM_CREATOR_CREDIT_PT}
          </p>
        </div>
      </section>
    </main>
  );
}
