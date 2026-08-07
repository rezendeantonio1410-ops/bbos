import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'BBOS — Bispo Coffees', description: 'Bispo Business Operating System' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className="font-[var(--font-inter)] antialiased">{children}</body></html>;
}
