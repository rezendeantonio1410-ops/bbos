"use client";

import { useEffect, useState } from "react";
import { UserAvatar } from "./user-avatar";

const accepted = ["image/jpeg", "image/png", "image/webp"];

export function ProfileAvatarField({ name, value, onChange }: { name: string; value?: string | null; onChange?: (file: File | null) => void }) {
  const [preview, setPreview] = useState(value ?? null);
  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);
  function select(file: File | undefined) {
    if (!file) return;
    if (!accepted.includes(file.type)) return;
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    onChange?.(file);
  }
  return <div className="flex items-center gap-4"><UserAvatar name={name} avatarUrl={preview} size="large" /><label className="cursor-pointer rounded-xl border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">Foto do perfil<input className="sr-only" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => select(event.target.files?.[0])} /></label></div>;
}
