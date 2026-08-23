import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const cx = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ');

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-ui-card className={cx('rounded-2xl border border-[var(--bbos-border)] bg-[var(--bbos-surface-elevated)] shadow-card', className)} {...props} />;
}

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cx('rounded-xl bg-[var(--bbos-action-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--bbos-text-on-action)] transition hover:bg-[var(--bbos-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bbos-focus-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    neutral: 'bg-stone-100 text-stone-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
  };
  return <span role="status" className={cx('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone])}>{children}</span>;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx('w-full rounded-xl border border-[var(--bbos-border)] bg-[var(--bbos-surface-base)] px-3 py-2.5 text-sm text-[var(--bbos-text-primary)] outline-none placeholder:text-[var(--bbos-text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--bbos-focus-ring)] focus-visible:ring-offset-1', className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx('w-full rounded-xl border border-[var(--bbos-border)] bg-[var(--bbos-surface-base)] px-3 py-2.5 text-sm text-[var(--bbos-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bbos-focus-ring)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-[var(--bbos-surface-subtle)] disabled:text-[var(--bbos-text-muted)]', className)} {...props} />;
}

export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="alert" className={cx('rounded-xl border border-[var(--bbos-border)] bg-[var(--bbos-surface-subtle)] px-4 py-3 text-sm text-[var(--bbos-text-secondary)]', className)} {...props} />;
}

export function Status({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'success' | 'information' | 'attention' | 'critical'; className?: string }) {
  const tones = {
    neutral: 'text-[var(--bbos-state-neutral)]',
    success: 'text-[var(--bbos-state-success)]',
    information: 'text-[var(--bbos-state-information)]',
    attention: 'text-[var(--bbos-state-attention)]',
    critical: 'text-[var(--bbos-state-critical)]',
  };
  return <span role="status" className={cx('inline-flex items-center gap-1.5 text-sm font-semibold', tones[tone], className)}><span aria-hidden="true" className="size-2 rounded-full bg-current" />{children}</span>;
}

export function HumanPageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      {eyebrow ? <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bbos-text-muted)]">{eyebrow}</p> : null}
      <h1 className="text-2xl font-bold tracking-tight text-[var(--bbos-text-primary)]">{title}</h1>
      {description ? <p className="mt-1 max-w-2xl text-sm text-[var(--bbos-text-secondary)]">{description}</p> : null}
    </div>
    {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
  </header>;
}

export function HumanEmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[var(--bbos-border)] bg-[var(--bbos-surface-subtle)] px-5 py-8 text-center">
    <p className="text-sm font-semibold text-[var(--bbos-text-primary)]">{title}</p>
    {description ? <p className="mx-auto mt-1 max-w-md text-sm text-[var(--bbos-text-secondary)]">{description}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>;
}

export function ActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex flex-wrap items-center justify-end gap-2 border-t border-[var(--bbos-border)] pt-3', className)}>{children}</div>;
}

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'information' | 'attention' | 'critical' }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-current/15 px-2.5 py-1 text-xs font-semibold" data-status-tone={tone}><Status tone={tone}>{children}</Status></span>;
}
