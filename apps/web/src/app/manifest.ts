import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name: "BBOS — Bispo Coffees",
    short_name: "BBOS",
    description: "Provas, decisões e atenções da operação Bispo Coffees.",
    start_url: "/home?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#f7f4ed",
    theme_color: "#123b35",
    orientation: "portrait-primary",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/bbos-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/bbos-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
