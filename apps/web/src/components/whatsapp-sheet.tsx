"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getApiBaseUrl } from "@/lib/api-url";
import { WHATS_LABEL, openWhats, whatsMessage, whatsNumber, whatsUrl, type WhatsKind } from "@/lib/whatsapp";

export type WhatsTarget = {
  customerId: string;
  customerName: string;
  phone: string | null;
  kinds: WhatsKind[]; // a 1ª é a sugerida
  orderNumber?: string | null;
  amount?: number | null;
  date?: string | null;
};

const WhatsContext = createContext<(target: WhatsTarget) => void>(() => undefined);
export const useWhatsApp = () => useContext(WhatsContext);

export function WhatsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.2.1.7-.1 1.3z" />
    </svg>
  );
}

/** Botão verde com o motivo escrito ("Lembrar pelo WhatsApp"). */
export function WhatsButton({ target, label, compact = false }: { target: WhatsTarget; label?: string; compact?: boolean }) {
  const open = useWhatsApp();
  const disabled = !whatsNumber(target.phone);
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? "Cliente sem celular cadastrado" : undefined}
      onClick={() => open(target)}
      aria-label={compact ? `WhatsApp de ${target.customerName}` : undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#25d366] font-extrabold text-white shadow-sm active:scale-[.98] disabled:bg-stone-200 disabled:text-stone-400 ${compact ? "px-3" : "px-3.5 text-[13px]"}`}
    >
      <WhatsIcon size={compact ? 19 : 16} />
      {!compact && <span>{label ?? WHATS_LABEL[target.kinds[0] ?? "FREE"]}</span>}
    </button>
  );
}

/**
 * Janela do WhatsApp: mensagens prontas com os dados reais, uma sugerida.
 * "Abrir no WhatsApp" registra o envio no BBOS e abre a conversa do cliente.
 */
export function WhatsAppProvider({ seller, children }: { seller: string; children: ReactNode }) {
  const [target, setTarget] = useState<WhatsTarget | null>(null);
  const [kind, setKind] = useState<WhatsKind>("FREE");
  const open = useCallback((next: WhatsTarget) => {
    setTarget(next);
    setKind(next.kinds[0] ?? "FREE");
  }, []);
  const kinds = useMemo<WhatsKind[]>(() => (target ? [...new Set<WhatsKind>([...target.kinds, "FREE"])] : []), [target]);
  const ctx = target ? { seller, orderNumber: target.orderNumber, amount: target.amount, date: target.date } : { seller };

  const send = () => {
    if (!target) return;
    const url = whatsUrl(target.phone ?? "", whatsMessage(kind, ctx));
    void fetch(`${getApiBaseUrl()}/field/message`, {
      method: "POST", credentials: "include", keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerId: target.customerId, kind, orderNumber: target.orderNumber ?? null }),
    }).catch(() => undefined);
    setTarget(null);
    openWhats(url);
  };

  return (
    <WhatsContext.Provider value={open}>
      {children}
      {target && typeof document !== "undefined" && createPortal(
        <div role="dialog" aria-modal="true" aria-labelledby="whats-title" className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onClick={() => setTarget(null)}>
          <div className="flex max-h-[100dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[26px] bg-white sm:rounded-[26px]" onClick={(e) => e.stopPropagation()}>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-2">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#25d366] text-white"><WhatsIcon size={22} /></span>
                <div><h2 id="whats-title" className="text-lg font-bold leading-tight">{target.customerName}</h2><p className="text-xs text-stone-500">WhatsApp do cliente · cadastrado no BBOS</p></div>
              </div>
              <div className="mt-3 space-y-2">
                {kinds.map((k) => {
                  const text = whatsMessage(k, ctx);
                  return (
                    <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                      className={`w-full rounded-2xl border-[1.5px] p-3 text-left ${kind === k ? "border-[#25d366] bg-emerald-50" : "border-stone-200 bg-white"}`}>
                      <b className="text-sm">{kind === k ? "✓ " : ""}{WHATS_LABEL[k]}</b>
                      <p className="mt-1 text-[13px] leading-snug text-stone-600">{text || "Abre o WhatsApp na conversa, sem texto."}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="border-t border-stone-100 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <button type="button" onClick={send} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25d366] py-4 text-base font-extrabold text-white"><WhatsIcon size={20} /> Abrir no WhatsApp</button>
              <button type="button" onClick={() => setTarget(null)} className="mt-1 w-full py-2 text-sm font-bold text-stone-500">Cancelar</button>
              <p className="text-center text-[11px] text-stone-400">O BBOS registra o envio no histórico do cliente.</p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </WhatsContext.Provider>
  );
}
