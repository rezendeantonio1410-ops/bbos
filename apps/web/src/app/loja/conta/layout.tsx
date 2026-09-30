import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Minha Bispo",
  description: "Acompanhe seus pedidos, preferências e reencontros com os cafés Bispo.",
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
