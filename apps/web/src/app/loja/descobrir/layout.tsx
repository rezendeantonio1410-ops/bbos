import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Descubra o seu café",
  description: "Encontre o café Bispo que combina com a sensação, o preparo e o momento que você procura.",
  alternates: { canonical: "/loja/descobrir" },
};

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
