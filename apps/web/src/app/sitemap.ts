import type { MetadataRoute } from "next";
import { microlots } from "./loja/microlots";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://loja.bispocoffees.com.br";
  const now = new Date();
  const pages = ["/loja", "/loja/descobrir", "/loja/sobre", "/loja/origem", "/aviso-privacidade", "/loja/entrega-e-devolucoes", "/loja/termos-de-compra"];
  return [
    ...pages.map((path, index) => ({ url: `${base}${path}`, lastModified: now, changeFrequency: index === 0 ? "weekly" as const : "monthly" as const, priority: index === 0 ? 1 : .7 })),
    ...microlots.map(({ slug }) => ({ url: `${base}/loja/cafes/${slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: .8 })),
  ];
}
