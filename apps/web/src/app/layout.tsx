import type { Metadata } from 'next';
import '@fontsource/inter/100.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/montserrat/300.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/600.css';
import './globals.css';

export const metadata: Metadata = { title: 'BBOS — Bispo Coffees', description: 'Bispo Business Operating System' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className="font-[var(--font-inter)] antialiased">{children}</body></html>;
}
