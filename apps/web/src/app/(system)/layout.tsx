import type { ReactNode } from 'react';
import { AppShellV2 } from '@/components/app-shell-v2';
import { JourneyContextBar } from '@/components/journey-context-bar';

export default function SystemLayout({ children }: { children: ReactNode }) {
  return <div className="bbos-system-vnext"><AppShellV2><JourneyContextBar />{children}</AppShellV2></div>;
}
