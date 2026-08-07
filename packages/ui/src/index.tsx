import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

const cx = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ');

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-ui-card className={cx('rounded-2xl border border-stone-200 bg-white shadow-card', className)} {...props} />;
}

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cx('rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:opacity-50', className)} {...props} />;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    neutral: 'bg-stone-100 text-stone-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
  };
  return <span className={cx('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone])}>{children}</span>;
}
