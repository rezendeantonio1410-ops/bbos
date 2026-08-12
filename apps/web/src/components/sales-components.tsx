import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";

export function SalesPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; href: string } | ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-stone-500">{description}</p>
      </div>
      {action && (typeof action === "object" && action !== null && "href" in action ? (
        <Link href={action.href} className="inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-forest-800">
          {action.label} <ArrowRight size={15} />
        </Link>
      ) : action)}
    </header>
  );
}

export function SalesEmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  description: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-8 text-center">
      <span className="mx-auto grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><Info size={17} /></span>
      <h2 className="mt-3 text-sm font-bold">{title}</h2>
      <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-stone-500">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {primaryAction && <Link href={primaryAction.href} className="rounded-xl bg-forest-900 px-4 py-2.5 text-xs font-bold text-white">{primaryAction.label}</Link>}
          {secondaryAction && <Link href={secondaryAction.href} className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700">{secondaryAction.label}</Link>}
        </div>
      )}
    </div>
  );
}

export function SalesKpi({ label, value, tone = "neutral", detail }: { label: string; value: ReactNode; tone?: "neutral" | "info" | "success" | "warning" | "danger"; detail?: string }) {
  const tones = { neutral: "text-stone-900", info: "text-blue-700", success: "text-emerald-700", warning: "text-amber-700", danger: "text-red-700" };
  return <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"><p className="text-xs text-stone-500">{label}</p><strong className={`mt-2 block text-xl ${tones[tone]}`}>{value}</strong>{detail && <p className="mt-1 text-[11px] text-stone-500">{detail}</p>}</div>;
}
