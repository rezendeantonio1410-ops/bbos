"use client";

import * as React from "react";
import { Check, ImagePlus, LoaderCircle, MonitorUp, Star, Trash2 } from "lucide-react";
import type { StorefrontProductImage } from "@bbos/shared/product-presentation";
import { getApiBaseUrl } from "@/lib/api-url";

const api = getApiBaseUrl();

type Props = {
  productId: string;
  productName: string;
  initialImages: StorefrontProductImage[];
};

const imageUrl = (image: StorefrontProductImage) =>
  `${api}/storefront/catalog/images/${image.id}?v=${encodeURIComponent(image.updatedAt)}`;

export function StorefrontProductImages({ productId, productName, initialImages }: Props) {
  const [images, setImages] = React.useState(initialImages);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy("upload");
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${api}/products/${productId}/storefront-images`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Não foi possível enviar a imagem.");
      setImages((current) => [...current, body]);
      setMessage("Imagem enviada. A loja já pode usá-la.");
      if (inputRef.current) inputRef.current.value = "";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar a imagem.");
    } finally {
      setBusy(null);
    }
  };

  const update = async (
    image: StorefrontProductImage,
    patch: { isPrimary?: boolean; useInHero?: boolean },
    success: string,
  ) => {
    setBusy(image.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `${api}/products/${productId}/storefront-images/${image.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Não foi possível atualizar a imagem.");
      setImages((current) =>
        current.map((item) => ({
          ...item,
          ...(patch.isPrimary === true ? { isPrimary: item.id === image.id } : {}),
          ...(patch.useInHero === true ? { useInHero: item.id === image.id } : {}),
          ...(item.id === image.id ? body : {}),
        })),
      );
      setMessage(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar a imagem.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (image: StorefrontProductImage) => {
    if (!window.confirm(`Excluir ${image.fileName}?`)) return;
    setBusy(image.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `${api}/products/${productId}/storefront-images/${image.id}`,
        { method: "DELETE", credentials: "include" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Não foi possível excluir a imagem.");
      setImages((current) => {
        const remaining = current.filter((item) => item.id !== image.id);
        if (!remaining.length) return remaining;
        return remaining.map((item, index) => ({
          ...item,
          isPrimary: image.isPrimary ? index === 0 : item.isPrimary,
          useInHero: image.useInHero ? index === 0 : item.useInHero,
        }));
      });
      setMessage("Imagem excluída.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível excluir a imagem.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-7 overflow-hidden rounded-[22px] border border-[var(--vnext-border)] bg-white shadow-[var(--vnext-shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--vnext-border)] px-5 py-5 sm:px-6">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--vnext-green)]">Loja online</p>
          <h2 className="mt-1 text-xl font-bold">Imagens da loja</h2>
          <p className="mt-1 text-xs text-[var(--vnext-text-2)]">Gerencie as fotos de {productName}. A publicação na vitrine é automática.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#10211D] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#18332c]">
          {busy === "upload" ? <LoaderCircle className="animate-spin" size={15} /> : <ImagePlus size={15} />}
          Adicionar imagem
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy !== null}
            onChange={(event) => void upload(event.target.files?.[0])}
          />
        </label>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="mb-5 grid gap-2 rounded-2xl bg-[var(--vnext-bg-soft)] p-4 text-xs text-[var(--vnext-text-2)] sm:grid-cols-3">
          <span><b className="text-[var(--vnext-text)]">Formatos:</b> JPG, PNG ou WebP</span>
          <span><b className="text-[var(--vnext-text)]">Limite:</b> 5 MB por arquivo</span>
          <span><b className="text-[var(--vnext-text)]">Recomendado:</b> vertical, mínimo 1200 px</span>
        </div>

        {error && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">{error}</div>}
        {message && <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800"><Check size={14}/>{message}</div>}

        {images.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {images.map((image) => (
              <article key={image.id} className="overflow-hidden rounded-2xl border border-[var(--vnext-border)] bg-white">
                <div className="relative aspect-[4/3] bg-[#f4f2ed]">
                  {/* Public API URL is intentionally used so this preview matches the storefront source. */}
                  <img src={imageUrl(image)} alt={`${productName} — ${image.fileName}`} className="size-full object-contain" />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    {image.isPrimary && <span className="rounded-full bg-[#10211D] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-white">Principal</span>}
                    {image.useInHero && <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-[#10211D] shadow">Destaque</span>}
                  </div>
                </div>
                <div className="p-4">
                  <p className="truncate text-xs font-bold" title={image.fileName}>{image.fileName}</p>
                  <div className="mt-3 grid gap-2">
                    <button
                      type="button"
                      disabled={busy !== null || image.isPrimary}
                      onClick={() => void update(image, { isPrimary: true }, "Imagem principal atualizada na loja.")}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold disabled:cursor-default disabled:bg-emerald-50 disabled:text-emerald-800"
                    >
                      <Star size={13}/>{image.isPrimary ? "Imagem principal" : "Definir como principal"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null || image.useInHero}
                      onClick={() => void update(image, { useInHero: true }, "Imagem de destaque atualizada.")}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold disabled:cursor-default disabled:bg-sky-50 disabled:text-sky-800"
                    >
                      <MonitorUp size={13}/>{image.useInHero ? "Usada no destaque" : "Usar no destaque"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void remove(image)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[10px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {busy === image.id ? <LoaderCircle className="animate-spin" size={13}/> : <Trash2 size={13}/>} Excluir
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-[var(--vnext-border)] bg-[var(--vnext-bg-soft)] p-8 text-center">
            <div>
              <ImagePlus className="mx-auto text-[var(--vnext-text-3)]" size={30}/>
              <p className="mt-3 text-sm font-bold">Nenhuma imagem administrável</p>
              <p className="mt-1 max-w-md text-xs text-[var(--vnext-text-2)]">A loja mantém a foto atual até você enviar a primeira substituição.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
