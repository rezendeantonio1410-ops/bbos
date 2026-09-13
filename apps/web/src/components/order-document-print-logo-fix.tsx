"use client";

import { useEffect } from "react";

const OFFICIAL_LOGO = "/brand/logo/bispo-logo-official-transparent.png";

export function OrderDocumentPrintLogoFix() {
  useEffect(() => {
    const apply = () => {
      const logo = document.querySelector<HTMLImageElement>(".order-sheet header img");
      if (!logo) return;
      logo.removeAttribute("srcset");
      logo.removeAttribute("sizes");
      logo.src = OFFICIAL_LOGO;
      logo.loading = "eager";
      logo.decoding = "sync";
      logo.alt = "Bispo Coffees - True Coffee";
      logo.style.display = "block";
      logo.style.width = "230px";
      logo.style.height = "auto";
      logo.style.objectFit = "contain";
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("beforeprint", apply);

    return () => {
      observer.disconnect();
      window.removeEventListener("beforeprint", apply);
    };
  }, []);

  return null;
}
