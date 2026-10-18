import type { Metadata, Viewport } from 'next';
import '@fontsource/inter/100.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/montserrat/300.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/600.css';
import './globals.css';
import './human-experience.css';
import './intelligence-native.css';
import './vnext.css';
import './sidebar-vnext.css';
import './order-drawer-vnext.css';
import { SYSTEM_CREATOR, SYSTEM_NAME } from '@bbos/shared';
import { BbosAssistant } from '@/components/bbos-assistant';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://loja.bispocoffees.com.br'),
  title: 'BBOS — Bispo Coffees',
  description: SYSTEM_NAME,
  creator: SYSTEM_CREATOR,
  authors: [{ name: SYSTEM_CREATOR }],
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/bbos-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/bbos-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/bbos-apple-touch.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'BBOS' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#123b35',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className="font-[var(--font-inter)] antialiased">{children}<BbosAssistant /></body></html>;
}
