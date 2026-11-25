"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SensoryConcierge.module.css";

/** Pages where the customer is paying or filling data: no floating bubble on top of fields and buttons. */
const QUIET_PATHS = ["/loja/finalizar", "/loja/pagar", "/loja/pedido", "/loja/conta", "/loja/descobrir"];

export default function SensoryConcierge() {
  const pathname = usePathname() ?? "";
  if (QUIET_PATHS.some((path) => pathname.startsWith(path))) return null;
  return (
    <Link
      className={styles.floatingGuide}
      href="/loja/descobrir"
      aria-label="O Bispo ajuda você a escolher o seu café"
    >
      <span aria-hidden="true">
        <i>B</i>
      </span>
      <b>
        <strong>Posso ajudar a escolher seu café →</strong>
        <small>3 escolhas · menos de um minuto</small>
      </b>
    </Link>
  );
}
