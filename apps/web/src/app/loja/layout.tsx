import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Cafés especiais brasileiros | Bispo Coffees",
    template: "%s | Bispo Coffees",
  },
  description: "Cafés especiais brasileiros escolhidos por José e Suzi, torrados pela Bispo e enviados de Londrina para a sua xícara.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Bispo Coffees",
    images: [{ url: "/brand/visuals/bispo-hero-chemex-v2.png", width: 1586, height: 992, alt: "Ritual de café Bispo Coffees" }],
  },
  twitter: { card: "summary_large_image" },
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
