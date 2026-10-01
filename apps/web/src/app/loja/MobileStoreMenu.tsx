"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./premium-overrides.module.css";

export default function MobileStoreMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <div className={styles.mobileMenu}>
      <button
        type="button"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        aria-controls="menu-loja-mobile"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      {open ? (
        <nav id="menu-loja-mobile" aria-label="Navegação móvel">
          <Link href="/loja#cafes" onClick={() => setOpen(false)}>
            Cafés
          </Link>
          <Link href="/loja#camadas" onClick={() => setOpen(false)}>
            Escolher uma linha
          </Link>
          <Link href="/loja/descobrir" onClick={() => setOpen(false)}>
            Descobrir o meu café
          </Link>
          <Link href="/loja/sobre" onClick={() => setOpen(false)}>
            Sobre a Bispo
          </Link>
          <Link href="/loja/origem" onClick={() => setOpen(false)}>
            A geografia na xícara
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
