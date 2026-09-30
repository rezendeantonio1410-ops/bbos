import type { CSSProperties } from "react";
import Image from "next/image";
import type { StoreProductStory } from "./StorefrontCart";
import styles from "./sensory-signature.module.css";

type Props = {
  name: string;
  notes: string;
  sensory?: StoreProductStory["sensory"];
  compact?: boolean;
};

const profilePalettes: Record<string, string[]> = {
  Essencial: ["#e3b64b", "#c98c67", "#8ba47c", "#e08b73"],
  Intenso: ["#6f3428", "#a84b31", "#d08d35", "#394f46"],
  Caramelo: ["#dc941f", "#7c3e28", "#d2aa72", "#b65c32"],
  "Doce de Leite": ["#d39b5f", "#b96f48", "#f0ca86", "#8e583d"],
  Tangerina: ["#f08a25", "#f2bf37", "#7e9b58", "#db5e35"],
  Singular: ["#8a4e79", "#c75d74", "#566f86", "#c3983d"],
  Sublime: ["#6d392a", "#a76032", "#c7953f", "#714b61"],
  Raro: ["#315f53", "#8c3e37", "#c29138", "#617486"],
};
const fallbackPalette = ["#d8a02f", "#a85f3d", "#6f8f63", "#c75d43"];

function withAlpha(hex: string, value: number) {
  const rgb = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((part) => Number.parseInt(part, 16));
  const alpha = Math.max(0.48, Math.min(0.96, value / 100));
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : hex;
}

function sensation(value: number) {
  if (value >= 85) return "marcante";
  if (value >= 68) return "presente";
  if (value >= 50) return "equilibrado";
  return "delicado";
}

function sensoryRing(
  attributes: NonNullable<StoreProductStory["sensory"]>,
  palette: string[],
) {
  const values = Array.from(
    { length: 4 },
    (_, index) => attributes[index]?.value ?? [72, 58, 46, 62][index]!,
  );
  const total = values.reduce((sum, value) => sum + value, 0);
  const available = 94;
  const gap = 1.5;
  let cursor = 0;
  const stops: string[] = [];

  values.forEach((value, index) => {
    const end = cursor + (value / total) * available;
    stops.push(
      `${withAlpha(palette[index]!, value)} ${cursor.toFixed(2)}% ${end.toFixed(2)}%`,
      `#fffaf2 ${end.toFixed(2)}% ${(end + gap).toFixed(2)}%`,
    );
    cursor = end + gap;
  });

  return `conic-gradient(from -18deg, ${stops.join(", ")})`;
}

export default function SensorySignature({
  name,
  notes,
  sensory = [],
  compact = false,
}: Props) {
  const attributes = sensory.slice(0, 4);
  const palette = profilePalettes[name] ?? fallbackPalette;
  const flavors = notes
    .split("·")
    .map((note) => note.trim())
    .filter(Boolean)
    .slice(0, 3);
  const ring = sensoryRing(attributes, palette);
  const signatureStyle = {
    "--profile-a": palette[0],
    "--profile-b": palette[1],
    "--profile-c": palette[2],
    "--profile-d": palette[3],
  } as CSSProperties;

  return (
    <section
      className={`${styles.signature} ${compact ? styles.compact : styles.full}`}
      aria-label={`Assinatura sensorial do café ${name}`}
      style={signatureStyle}
    >
      <div
        className={styles.wheel}
        style={{ "--sensory-ring": ring } as CSSProperties}
        aria-hidden="true"
      >
        <Image
          className={styles.seal}
          src="/brand/logo/bispo-seal-black.jpg"
          alt=""
          width={132}
          height={132}
        />
      </div>
      <div className={styles.copy}>
        <small>{compact ? "PERFIL SENSORIAL" : "ASSINATURA SENSORIAL"}</small>
        <div className={styles.flavors}>
          {flavors.map((flavor, index) => (
            <span
              key={flavor}
              style={{ "--flavor-color": palette[index] } as CSSProperties}
            >
              {flavor}
            </span>
          ))}
        </div>
        {!compact && attributes.length > 0 && (
          <div className={styles.attributes}>
            {attributes.map((attribute, index) => (
              <div key={attribute.label}>
                <i style={{ background: palette[index] }} />
                <span>{attribute.label}</span>
                <b>{sensation(attribute.value)}</b>
              </div>
            ))}
          </div>
        )}
        {!compact && (
          <p>
            Uma leitura de sensação para imaginar a xícara — não uma nota de
            qualidade.
          </p>
        )}
      </div>
    </section>
  );
}
