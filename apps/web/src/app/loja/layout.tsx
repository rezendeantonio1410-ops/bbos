import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Cafés especiais brasileiros | Bispo Coffees",
    template: "%s | Bispo Coffees",
  },
  description:
    "Cafés especiais brasileiros escolhidos por Suzi e José, torrados pela Bispo e enviados de Londrina para a sua xícara.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Bispo Coffees",
    images: [
      {
        url: "/brand/editorial/real/suzi-jose-escolha.jpg",
        width: 2400,
        height: 1600,
        alt: "Suzi Ninov e José Rezende escolhendo cafés na Bispo Coffees",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: [
      {
        url: "/brand/logo/bispo-favicon-v2.png",
        type: "image/png",
        sizes: "64x64",
      },
      {
        url: "/brand/logo/bispo-icon-v2.png",
        type: "image/png",
        sizes: "192x192",
      },
    ],
    shortcut: "/brand/logo/bispo-favicon-v2.png",
    apple: [
      {
        url: "/brand/logo/bispo-apple-touch-v2.png",
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
};

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
