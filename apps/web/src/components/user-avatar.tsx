import Image from "next/image";

type AvatarSize = "small" | "medium" | "large";

const sizes: Record<AvatarSize, { box: string; pixels: number; text: string }> = {
  small: { box: "size-8", pixels: 32, text: "text-xs" },
  medium: { box: "size-10", pixels: 40, text: "text-sm" },
  large: { box: "size-16", pixels: 64, text: "text-xl" },
};

export function UserAvatar({ name, avatarUrl, size = "medium" }: { name: string; avatarUrl?: string | null; size?: AvatarSize }) {
  const style = sizes[size];
  const initials = name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
  return <span className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-stone-200 bg-forest-100 font-bold text-forest-800 ${style.box} ${style.text}`} aria-label={name}>
    {avatarUrl ? (avatarUrl.startsWith("data:") ? <img src={avatarUrl} alt="" className="absolute inset-0 size-full object-cover" /> : <Image src={`${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}v=1`} alt="" fill sizes={`${style.pixels}px`} className="object-cover" />) : initials}
  </span>;
}
