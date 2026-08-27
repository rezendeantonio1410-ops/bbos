"use client";

import { useEffect, useState } from "react";
import { Check, Upload } from "lucide-react";
import { Button, Card, HumanPageHeader } from "@bbos/ui";
import { ProfileAvatarField } from "@/components/profile-avatar-field";
import { fetchSessionIdentity, getApiRoot, type SessionIdentity } from "@/lib/auth-session";

export default function ProfilePage() {
  const [user, setUser] = useState<SessionIdentity | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void fetchSessionIdentity(getApiRoot()).then(setUser).catch(() => undefined); }, []);
  const select = (next: File | null) => { setFile(next); if (!next) return setPreview(null); const reader = new FileReader(); reader.onload = () => setPreview(typeof reader.result === "string" ? reader.result : null); reader.readAsDataURL(next); };
  const confirm = async () => { if (!preview || !user) return; setBusy(true); setMessage(""); try { const response = await fetch(`${getApiRoot()}/auth/me/avatar`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ avatarUrl: preview }) }); if (!response.ok) throw new Error("Não foi possível atualizar a foto."); const body = await response.json() as { user: SessionIdentity }; setUser(body.user); window.dispatchEvent(new CustomEvent("bbos:avatar-updated", { detail: body.user })); setFile(null); setPreview(null); setMessage("Foto oficial atualizada no BBOS."); } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível atualizar a foto."); } finally { setBusy(false); } };
  return <div className="mx-auto max-w-3xl"><HumanPageHeader eyebrow="Minha conta" title="Perfil" description="Sua identidade central no BBOS." /><Card className="mt-6 p-6"><h2 className="text-lg font-bold">Foto oficial</h2><p className="mt-1 text-sm text-stone-500">Uma única foto é usada nas áreas internas do BBOS. Redes sociais e materiais já publicados permanecem independentes.</p><div className="mt-5"><ProfileAvatarField name={user?.name ?? "Usuário"} value={preview ?? user?.avatarUrl} onChange={select} /></div>{file && <Button type="button" disabled={busy} onClick={() => void confirm()} className="mt-5"><Check size={15} /> {busy ? "Atualizando…" : "Confirmar foto"}</Button>}{message && <p role="status" className="mt-4 text-sm text-emerald-700">{message}</p>}<p className="mt-5 flex items-center gap-2 text-xs text-stone-400"><Upload size={13} /> JPG, PNG ou WebP · até 2 MB</p></Card></div>;
}
