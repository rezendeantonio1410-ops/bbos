import type { ReactNode } from 'react';
import { AppShellV2 } from '@/components/app-shell-v2';

export default function SystemLayout({ children }: { children: ReactNode }) {
  return <div className="bbos-system-vnext"><AppShellV2>{children}</AppShellV2></div>;
}
