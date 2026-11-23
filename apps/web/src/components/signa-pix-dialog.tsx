"use client";

import { useEffect, useRef, useState } from "react";

type PixView = {
  orderCode: string;
  beneficiary: string;
  pixKey: string;
  openCents: number;
  dueDate: string;
  copyPaste: string;
  qrSvg: string;
  notice: string;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * One click → static Bispo Coffees Pix (QR Code + copia e cola) for an open
 * receivable. Read-only: settlement is confirmed by Bispo's finance team.
 */
export function SignaPixButton({ orderId, orderCode }: { orderId: string; orderCode: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PixView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  async function show() {
    setOpen(true); setError(""); setCopied(false);
    if (data) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/partner-portal/orders/${encodeURIComponent(orderId)}/pix`, { credentials: "include", cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(" ") : body.message || "Não foi possível gerar o Pix.");
      setData(body as PixView);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o Pix.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function copy() {
    if (!data) return;
    try { await navigator.clipboard.writeText(data.copyPaste); setCopied(true); }
    catch { setCopied(false); setError("Não foi possível copiar automaticamente. Selecione o código e copie."); }
  }

  return <>
    <button type="button" onClick={() => void show()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#0E191D] px-3 py-2 text-xs font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25734c]">
      Pagar com Pix
    </button>
    {open && <div role="dialog" aria-modal="true" aria-labelledby={`pix-title-${orderId}`} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#25734c]">Pagamento via Pix</p>
            <h3 id={`pix-title-${orderId}`} className="text-lg font-semibold text-[#0E191D]">Pedido {data?.orderCode || orderCode}</h3>
          </div>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Fechar Pix" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold">Fechar</button>
        </div>
        {loading && <p role="status" className="mt-6 text-sm text-slate-600">Gerando o QR Code...</p>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {data && <>
          <div className="mx-auto mt-4 w-56 max-w-full [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label={`QR Code Pix de ${currency.format(data.openCents / 100)}`} dangerouslySetInnerHTML={{ __html: data.qrSvg }} />
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-slate-500">Valor</dt><dd className="font-semibold tabular-nums">{currency.format(data.openCents / 100)}</dd></div>
            <div><dt className="text-xs text-slate-500">Vencimento</dt><dd className="font-semibold">{new Date(`${data.dueDate}T12:00:00Z`).toLocaleDateString("pt-BR")}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-slate-500">Favorecido</dt><dd className="font-medium">{data.beneficiary} · CNPJ {data.pixKey}</dd></div>
          </dl>
          <label className="mt-4 block text-xs font-semibold text-slate-700">Pix copia e cola
            <textarea readOnly value={data.copyPaste} rows={3} onFocus={event => event.currentTarget.select()} className="mt-1 w-full resize-none rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono text-[11px] text-slate-800" />
          </label>
          <button type="button" onClick={() => void copy()} className="mt-2 w-full rounded-lg bg-[#25734c] px-4 py-3 text-sm font-semibold text-white">{copied ? "Código copiado ✓" : "Copiar código Pix"}</button>
          <p className="mt-3 text-xs text-slate-500">{data.notice}</p>
        </>}
      </div>
    </div>}
  </>;
}
