import Link from "next/link";
import styles from "./SensoryConcierge.module.css";

export default function SensoryConcierge() {
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
