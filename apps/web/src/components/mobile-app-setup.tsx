"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Bell,
  BellRing,
  Check,
  Download,
  ExternalLink,
  RefreshCw,
  Share,
  Smartphone,
  X,
} from "lucide-react";
import { Button, Card } from "@bbos/ui";
import {
  currentPushSubscription,
  disablePushSubscription,
  enablePushSubscription,
  mobileInstallState,
  registerBbosServiceWorker,
  type MobileInstallState,
  type PushServerStatus,
} from "@/lib/push-client";

type MobileNotification = {
  id: string;
  title: string;
  message: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

const initialInstallState: MobileInstallState = {
  isIos: false,
  isStandalone: false,
  supportsPush: false,
};

export function MobileAppSetup() {
  const [install, setInstall] = useState(initialInstallState);
  const [server, setServer] = useState<PushServerStatus | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    const nextInstall = mobileInstallState();
    setInstall(nextInstall);
    if (nextInstall.supportsPush)
      await registerBbosServiceWorker().catch(() => undefined);
    const [statusResponse, notificationsResponse] = await Promise.all([
      fetch("/api/push/status", { credentials: "include", cache: "no-store" }),
      fetch("/api/push/notifications", {
        credentials: "include",
        cache: "no-store",
      }),
    ]);
    if (!statusResponse.ok)
      throw new Error("Não foi possível consultar o aplicativo.");
    const nextServer = (await statusResponse.json()) as PushServerStatus;
    setServer(nextServer);
    if (notificationsResponse.ok) {
      const payload = (await notificationsResponse.json()) as {
        items: MobileNotification[];
      };
      setNotifications(payload.items);
    }
    if (nextInstall.supportsPush) {
      const current = await currentPushSubscription().catch(() => null);
      setSubscribed(Boolean(current));
    }
  }, []);

  useEffect(() => {
    void refresh().catch((cause) =>
      setError(
        cause instanceof Error ? cause.message : "Não foi possível carregar.",
      ),
    );
  }, [refresh]);

  const activate = async () => {
    if (!server?.publicKey) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await enablePushSubscription(server.publicKey);
      setSubscribed(true);
      setMessage("Notificações ativadas neste dispositivo.");
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível ativar as notificações.",
      );
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await disablePushSubscription();
      setSubscribed(false);
      setMessage("Notificações desativadas neste dispositivo.");
      await refresh();
    } catch {
      setError("Não foi possível desativar este dispositivo.");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/push/test", {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload?.message || "O teste não pôde ser enviado.");
      setMessage("Notificação de teste enviada para este dispositivo.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "O teste falhou.");
    } finally {
      setBusy(false);
    }
  };

  const installed = install.isStandalone;
  const ready = Boolean(server?.enabled && server.publicKey);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-[#f8f4e9] via-white to-emerald-50 p-0">
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_230px] md:p-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-emerald-800">
              <Smartphone size={16} /> BBOS Mobile
            </div>
            <h2 className="mt-3 text-2xl font-black text-stone-950">
              Provas e atenções no iPhone
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              Instale o BBOS na tela inicial e receba alertas individuais quando
              existir uma amostra para provar ou uma decisão operacional
              necessária.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-white px-3 py-2 text-stone-700 shadow-sm">
                {installed ? "✓ Instalado" : "1. Instalar"}
              </span>
              <span className="rounded-full bg-white px-3 py-2 text-stone-700 shadow-sm">
                {subscribed
                  ? "✓ Notificações ativas"
                  : "2. Ativar notificações"}
              </span>
              <span className="rounded-full bg-white px-3 py-2 text-stone-700 shadow-sm">
                3. Testar
              </span>
            </div>
          </div>
          <div className="mx-auto grid w-44 place-items-center rounded-[2.25rem] border-[7px] border-stone-900 bg-[#123b35] p-5 text-center text-white shadow-xl md:mx-0">
            <Image
              src="/icons/bbos-192.png"
              alt="Ícone BBOS"
              width={80}
              height={80}
              className="size-20 rounded-2xl bg-white object-cover"
            />
            <p className="mt-4 text-sm font-black">BBOS</p>
            <p className="mt-1 text-[10px] text-emerald-100">Bispo Coffees</p>
          </div>
        </div>
      </Card>

      {!installed && install.isIos && (
        <Card className="border-amber-200 bg-amber-50/60 p-5">
          <div className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-amber-700 shadow-sm">
              <Download size={18} />
            </span>
            <div>
              <h3 className="font-black">1. Adicionar à Tela de Início</h3>
              <ol className="mt-3 space-y-2 text-sm text-stone-700">
                <li className="flex items-center gap-2">
                  <Share size={15} /> No Safari, toque em Compartilhar.
                </li>
                <li className="flex items-center gap-2">
                  <ExternalLink size={15} /> Escolha “Adicionar à Tela de
                  Início”.
                </li>
                <li className="flex items-center gap-2">
                  <Check size={15} /> Confirme “Adicionar” e abra pelo novo
                  ícone.
                </li>
              </ol>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-stone-400">
                Este dispositivo
              </p>
              <h3 className="mt-2 text-lg font-black">Notificações</h3>
            </div>
            <span
              className={`grid size-10 place-items-center rounded-2xl ${subscribed ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-500"}`}
            >
              {subscribed ? <BellRing size={18} /> : <Bell size={18} />}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {!install.supportsPush
              ? "Este navegador não oferece suporte às notificações do aplicativo."
              : !ready
                ? "O aplicativo está preparado, mas o servidor de notificações ainda precisa ser ativado no ambiente de testes."
                : subscribed
                  ? "Este dispositivo está vinculado ao seu usuário do BBOS."
                  : installed || !install.isIos
                    ? "Ative para receber provas e atenções mesmo com o BBOS fechado."
                    : "Abra o BBOS pelo ícone da Tela de Início antes de ativar."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {!subscribed ? (
              <Button
                type="button"
                disabled={
                  busy ||
                  !ready ||
                  !install.supportsPush ||
                  (install.isIos && !installed)
                }
                onClick={() => void activate()}
              >
                <BellRing size={15} />{" "}
                {busy ? "Ativando…" : "Ativar notificações"}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void test()}
                >
                  <Bell size={15} /> Enviar teste
                </Button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void deactivate()}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-bold text-stone-600"
                >
                  <X size={14} /> Desativar neste aparelho
                </button>
              </>
            )}
          </div>
          <p className="mt-4 text-[11px] text-stone-400">
            {server?.activeSubscriptions ?? 0} dispositivo(s) ativo(s) para este
            usuário.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-stone-400">
                Alertas individuais
              </p>
              <h3 className="mt-2 text-lg font-black">Últimas notificações</h3>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-xl border p-2 text-stone-500"
              aria-label="Atualizar"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">
                Nenhuma notificação individual ainda.
              </p>
            ) : (
              notifications.slice(0, 8).map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="block rounded-2xl border border-stone-100 p-3 hover:bg-stone-50"
                >
                  <div className="flex gap-2">
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${item.readAt ? "bg-stone-200" : "bg-amber-500"}`}
                    />
                    <span>
                      <strong className="block text-sm text-stone-900">
                        {item.title}
                      </strong>
                      <span className="mt-1 block text-xs leading-5 text-stone-500">
                        {item.message}
                      </span>
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      {(message || error) && (
        <p
          role="status"
          className={`rounded-2xl p-4 text-sm font-semibold ${error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
        >
          {error || message}
        </p>
      )}
    </div>
  );
}
