"use client";
import { useState } from "react";
import { FileText } from "lucide-react";

export function OrderBillingPdfButton({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/sales-orders/${encodeURIComponent(orderId)}/billing/pdf`,
        { credentials: "include", cache: "no-store" },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Não foi possível gerar a cobrança.");
      }
      if (!response.headers.get("content-type")?.includes("application/pdf"))
        throw new Error(
          "O documento não foi recebido. Atualize a página e tente novamente.",
        );
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `Cobranca-${orderNumber.replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível gerar a cobrança.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-sm" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void download()}
        className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs font-bold text-stone-800 disabled:opacity-50"
      >
        <FileText size={14} />
        {busy ? "Gerando cobrança…" : "PDF de cobrança"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
