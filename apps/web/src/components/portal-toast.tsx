"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";

type Toast = { id: number; message: string; tone: "success" | "error" };

/** Fire-and-forget confirmation (Fluent "toast" / Fiori "message toast"). */
export function showToast(message: string, tone: Toast["tone"] = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("bbos:toast", { detail: { message, tone } }));
}

/** Polite live region that shows short confirmations for ~4 seconds. */
export function PortalToaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    let next = 1;
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; tone?: Toast["tone"] }>).detail ?? {};
      if (!detail.message) return;
      const toast: Toast = { id: next++, message: detail.message, tone: detail.tone === "error" ? "error" : "success" };
      setToasts((current) => [...current.slice(-2), toast]);
      window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), 4200);
    };
    window.addEventListener("bbos:toast", onToast);
    return () => window.removeEventListener("bbos:toast", onToast);
  }, []);
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl bg-[#0A0A0A] px-4 py-3 text-sm font-medium text-white shadow-lg motion-safe:animate-[fadeIn_.2s_ease]">
          {toast.tone === "success" ? <CheckCircle2 size={18} className="shrink-0 text-[#7fd1a2]" aria-hidden /> : <CircleAlert size={18} className="shrink-0 text-[#f0a39a]" aria-hidden />}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
