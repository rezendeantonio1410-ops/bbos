import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';

export default function SystemLayout({ children }: { children: ReactNode }) {
  return <div className="bbos-system-vnext"><AppShell>{children}</AppShell></div>;
}
