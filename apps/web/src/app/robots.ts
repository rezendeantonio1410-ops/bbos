import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/loja", "/aviso-privacidade"],
        disallow: [
          "/api/",
          "/login",
          "/loja/conta",
          "/loja/finalizar",
          "/loja/pagar/",
          "/loja/pedido/",
        ],
      },
    ],
    sitemap: "https://loja.bispocoffees.com.br/sitemap.xml",
  };
}
