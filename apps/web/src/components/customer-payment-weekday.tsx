"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/**
 * Dia fixo de pagamento do cliente (ex.: hospital que só paga às quintas).
 * Os vencimentos a prazo passam para o próximo dia escolhido. Só José ou Suzi.
 */
export function CustomerPaymentWeekday({ customerId }: { customerId: string }) {
  const [weekday, setWeekday] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const base = `${getApiBaseUrl()}/customers/${customerId}/payment-weekday`;

  useEffect(() => {
    let active = true;
    void fetch(base, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: { weekday: number | null } | null) => {
        if (!active) return;
        setWeekday(payload?.weekday == null ? "" : String(payload.weekday));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => { active = false; };
  }, [base]);

  const save = async (value: string) => {
    const previous = weekday;
    setWeekday(value);
    setBusy(true);
    setMessage("");
    setError("");
    const response = await fetch(base, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weekday: value === "" ? null : Number(value) }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const payload = response ? ((await response.json().catch(() => ({}))) as { message?: string }) : {};
      setWeekday(previous);
      setError(payload.message ?? "Não foi possível salvar o dia de pagamento.");
      return;
    }
    setMessage(value === "" ? "Sem dia fixo: vence no prazo normal." : `Salvo. Os próximos vencimentos a prazo cairão ${Number(value) === 0 || Number(value) === 6 ? "no" : "na"} ${DAYS[Number(value)]!.toLowerCase()}.`);
  };

  return (
    <div className="sm:col-span-2">
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
        <CalendarDays size={13} /> Dia de pagamento do cliente
      </label>
      <select
        aria-label="Dia de pagamento do cliente"
        disabled={!loaded || busy}
        value={weekday}
        onChange={(e) => void save(e.target.value)}
        className="w-full rounded-xl border bg-white px-3 py-3 text-sm"
      >
        <option value="">Qualquer dia (prazo normal)</option>
        {DAYS.map((day, index) => <option key={day} value={String(index)}>Só paga {index === 0 || index === 6 ? "no" : "na"} {day.toLowerCase()}</option>)}
      </select>
      <p className="mt-1 text-[10px] text-stone-500">Os vencimentos a prazo passam para o próximo dia escolhido, nunca antes. Só José ou Suzi alteram. Salva na hora.</p>
      {message && <p role="status" className="mt-1 text-[11px] font-semibold text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-1 text-[11px] text-red-700">{error}</p>}
    </div>
  );
}
