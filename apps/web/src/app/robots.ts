import type { MetadataRoute } from "next";
import { getStorefrontOrigin } from "@/lib/storefront-url";

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
    sitemap: `${getStorefrontOrigin()}/sitemap.xml`,
  };
}
