"use client";

import * as React from "react";
import Image from "next/image";
import {
  Check,
  Eye,
  EyeOff,
  Images,
  LoaderCircle,
  Save,
  Sparkles,
  Upload,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type Category =
  | "FOUNDERS"
  | "PRODUCT_PROOF"
  | "ORIGIN"
  | "PRODUCERS"
  | "HERO"
  | "EDITORIAL";

type Product = { id: string; name: string; slug: string };
type Asset = {
  id: string;
  productId: string | null;
  product: Product | null;
  category: Category;
  entityKey: string | null;
  placement: string | null;
  title: string;
  altText: string;
  caption: string | null;
  credit: string | null;
  sortOrder: number;
  isPrimary: boolean;
  active: boolean;
  updatedAt: string;
};

const categoryOptions: Array<{ value: Category; label: string; help: string }> = [
  { value: "FOUNDERS", label: "Fundadores", help: "José, Suzi e a história da marca" },
  { value: "PRODUCT_PROOF", label: "Provas e produtos", help: "Degustação, xícara, preparo e detalhes" },
  { value: "ORIGIN", label: "Origem e território", help: "Lavoura, paisagem e trabalho de campo" },
  { value: "PRODUCERS", label: "Produtores", help: "Pessoas, fazendas e relações" },
  { value: "HERO", label: "Destaques da loja", help: "Imagens principais e campanhas" },
  { value: "EDITORIAL", label: "Editorial", help: "Bastidores, rituais e conteúdo" },
];

const placementOptions = [
  { value: "", label: "Biblioteca — ainda sem posição" },
  { value: "founder.jose.portrait", label: "Início · retrato de José" },
  { value: "founder.suzi.portrait", label: "Início · retrato de Suzi" },
  { value: "home.origin", label: "Início · história da origem" },
  { value: "home.hero.caramelo", label: "Início · destaque Caramelo" },
  { value: "home.hero.essencial", label: "Início · destaque Essencial" },
  { value: "home.hero.singular", label: "Início · destaque Singular" },
  { value: "home.hero.sublime", label: "Início · destaque Sublime" },
  { value: "about.jose.field", label: "Sobre · José na origem" },
  { value: "about.suzi.cupping", label: "Sobre · Suzi na prova" },
  { value: "origin.suzi", label: "Origem · Suzi no campo" },
  { value: "origin.jose", label: "Origem · José na origem" },
  { value: "product.proof", label: "Produto · galeria de prova" },
];

const categoryLabel = (value: Category) =>
  categoryOptions.find((option) => option.value === value)?.label ?? value;

export default function StorefrontMediaPage() {
  const api = getApiBaseUrl();
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [category, setCategory] = React.useState<Category>("FOUNDERS");
  const [filter, setFilter] = React.useState<"ALL" | Category>("ALL");
  const [files, setFiles] = React.useState<File[]>([]);
  const [placement, setPlacement] = React.useState("");
  const [productId, setProductId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [altText, setAltText] = React.useState("");
  const [caption, setCaption] = React.useState("");
  const [credit, setCredit] = React.useState("");
  const [isPrimary, setIsPrimary] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    const [mediaResponse, productsResponse] = await Promise.all([
      fetch(`${api}/admin/storefront-media`, { credentials: "include", cache: "no-store" }),
      fetch(`${api}/products`, { credentials: "include", cache: "no-store" }),
    ]);
    if (mediaResponse.ok) setAssets(await mediaResponse.json());
    if (productsResponse.ok) {
      const rows = (await productsResponse.json()) as Array<Product & { product?: { id: string; name: string; slug: string } }>;
      const normalized = rows.map((row) => {
        const product = row.product ?? row;
        return { ...product, slug: product.slug || productSlug(product.name) };
      });
      setProducts(
        normalized.filter((row, index, all) =>
          Boolean(row?.id) && all.findIndex((item) => item.id === row.id) === index,
        ),
      );
    }
    if (!mediaResponse.ok) {
      const payload = await mediaResponse.json().catch(() => ({}));
      setMessage(payload.message ?? "Não foi possível carregar a biblioteca.");
    }
    setLoading(false);
  }, [api]);

  React.useEffect(() => { void load(); }, [load]);

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!files.length) return setMessage("Selecione uma ou mais fotos.");
    if (!title.trim()) return setMessage("Dê um título para este conjunto de fotos.");
    setBusy(true);
    setMessage("");
    let completed = 0;
    for (const [index, file] of files.entries()) {
      const data = new FormData();
      data.set("file", file);
      data.set("category", category);
      data.set("placement", placement);
      data.set("productId", productId);
      data.set("entityKey", products.find((product) => product.id === productId)?.slug ?? "");
      data.set("title", files.length > 1 ? `${title.trim()} · ${index + 1}` : title.trim());
      data.set("altText", altText.trim() || title.trim());
      data.set("caption", caption);
      data.set("credit", credit);
      data.set("isPrimary", String(isPrimary && index === 0));
      const response = await fetch(`${api}/admin/storefront-media`, {
        method: "POST",
        credentials: "include",
        body: data,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setMessage(payload.message ?? `Falha ao enviar ${file.name}.`);
        break;
      }
      completed += 1;
    }
    if (completed === files.length) {
      setMessage(`${completed} ${completed === 1 ? "foto adicionada" : "fotos adicionadas"} à biblioteca.`);
      setFiles([]);
      setTitle("");
      setAltText("");
      setCaption("");
      setCredit("");
      setIsPrimary(false);
      const input = document.getElementById("media-files") as HTMLInputElement | null;
      if (input) input.value = "";
    }
    await load();
    setBusy(false);
  };

  const visible = filter === "ALL" ? assets : assets.filter((asset) => asset.category === filter);
  const activeCount = assets.filter((asset) => asset.active).length;
  const placedCount = assets.filter((asset) => asset.placement).length;

  return (
    <div className="mx-auto max-w-[1500px] pb-16">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-black/10 pb-7">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#087568]">
            <Images size={15} /> Presença visual da Bispo
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.03em] text-[#132927]">Biblioteca da marca</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#526461]">
            Organize fotos dos fundadores, provas, produtos, origens e produtores. Cada imagem pode ficar apenas arquivada ou ocupar uma posição específica na loja.
          </p>
        </div>
        <a href="/loja" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 border border-[#132927] px-4 text-xs font-semibold text-[#132927] transition hover:bg-[#132927] hover:text-white">
          <Eye size={15} /> Ver a loja
        </a>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Metric value={assets.length} label="fotos na biblioteca" />
        <Metric value={activeCount} label="publicadas" />
        <Metric value={placedCount} label="com posição definida" />
      </section>

      <section className="mt-8 grid gap-8 xl:grid-cols-[420px_1fr]">
        <form onSubmit={upload} className="h-fit border border-black/10 bg-white p-6 shadow-[0_18px_60px_rgba(25,45,41,.06)] xl:sticky xl:top-6">
          <div className="flex items-start gap-3">
            <div className="grid size-9 place-items-center bg-[#e8f1ed] text-[#087568]"><Upload size={17} /></div>
            <div><h2 className="font-semibold text-[#132927]">Adicionar fotos</h2><p className="mt-1 text-xs text-[#687875]">JPG, PNG ou WebP · até 10 MB cada</p></div>
          </div>

          <label className="mt-6 block text-xs font-semibold text-[#243b38]">Arquivos</label>
          <label className="mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center border border-dashed border-[#9eb3ad] bg-[#f7faf8] px-5 text-center hover:border-[#087568]">
            <Upload size={20} className="text-[#087568]" />
            <span className="mt-2 text-sm font-medium">Escolher várias fotos</span>
            <small className="mt-1 text-[#687875]">{files.length ? `${files.length} selecionada(s)` : "Você pode selecionar um ensaio inteiro"}</small>
            <input id="media-files" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
          </label>

          <Field label="Categoria">
            <select value={category} onChange={(event) => setCategory(event.target.value as Category)} className={controlClass}>
              {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label} — {option.help}</option>)}
            </select>
          </Field>
          <Field label="Onde usar">
            <select value={placement} onChange={(event) => setPlacement(event.target.value)} className={controlClass}>
              {placementOptions.map((option) => <option key={option.value || "library"} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Produto relacionado" hint="Opcional; use para provas, preparo e detalhes de um café.">
            <select value={productId} onChange={(event) => setProductId(event.target.value)} className={controlClass}>
              <option value="">Nenhum produto específico</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </Field>
          <Field label="Título interno"><input value={title} onChange={(event) => setTitle(event.target.value)} className={controlClass} placeholder="Ex.: José provando a safra 2026" /></Field>
          <Field label="Texto alternativo" hint="Descreva o que há na foto para acessibilidade e busca."><input value={altText} onChange={(event) => setAltText(event.target.value)} className={controlClass} placeholder="Ex.: José Rezende avaliando uma xícara" /></Field>
          <Field label="Legenda"><textarea value={caption} onChange={(event) => setCaption(event.target.value)} className={`${controlClass} min-h-20 resize-y`} placeholder="Contexto que pode acompanhar a foto" /></Field>
          <Field label="Crédito"><input value={credit} onChange={(event) => setCredit(event.target.value)} className={controlClass} placeholder="Fotógrafo, fazenda ou acervo" /></Field>
          <label className="mt-5 flex cursor-pointer items-start gap-3 border border-black/10 bg-[#faf8f3] p-3 text-xs leading-5 text-[#465955]">
            <input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} className="mt-0.5 size-4 accent-[#087568]" />
            <span><b className="block text-[#132927]">Usar como foto principal</b>Se houver mais de uma na mesma posição, esta terá prioridade.</span>
          </label>
          <button disabled={busy} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 bg-[#132927] px-5 text-xs font-bold uppercase tracking-[.12em] text-white disabled:opacity-60">
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}{busy ? "Enviando…" : "Adicionar à biblioteca"}
          </button>
          {message && <p role="status" className="mt-4 border-l-2 border-[#087568] pl-3 text-xs leading-5 text-[#3c514d]">{message}</p>}
        </form>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><h2 className="text-xl font-semibold text-[#132927]">Acervo visual</h2><p className="mt-1 text-xs text-[#687875]">Retire uma foto da loja sem apagá-la do acervo.</p></div>
            <select value={filter} onChange={(event) => setFilter(event.target.value as "ALL" | Category)} className="h-10 border border-black/15 bg-white px-3 text-xs">
              <option value="ALL">Todas as categorias</option>
              {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          {loading ? (
            <div className="mt-6 flex min-h-56 items-center justify-center border border-black/10 bg-white text-sm text-[#687875]"><LoaderCircle className="mr-2 animate-spin" size={18} /> Carregando biblioteca…</div>
          ) : visible.length ? (
            <div className="mt-5 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {visible.map((asset) => <AssetCard key={asset.id} asset={asset} products={products} api={api} onChanged={load} />)}
            </div>
          ) : (
            <div className="mt-6 min-h-56 border border-dashed border-black/15 bg-[#f8faf9] p-10 text-center"><Images className="mx-auto text-[#86a19b]" /><h3 className="mt-4 font-semibold text-[#132927]">Esta categoria ainda está vazia</h3><p className="mt-2 text-sm text-[#687875]">As fotos atuais da loja continuam aparecendo até você enviar novas.</p></div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div className="border border-black/10 bg-[#f8faf9] px-5 py-4"><strong className="text-2xl font-semibold text-[#132927]">{value}</strong><span className="ml-2 text-xs text-[#687875]">{label}</span></div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="mt-4 block"><span className="text-xs font-semibold text-[#243b38]">{label}</span>{hint && <small className="mt-1 block leading-4 text-[#75837f]">{hint}</small>}<span className="mt-2 block">{children}</span></label>;
}

function AssetCard({ asset, products, api, onChanged }: { asset: Asset; products: Product[]; api: string; onChanged: () => Promise<void> }) {
  const [draft, setDraft] = React.useState(asset);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  React.useEffect(() => setDraft(asset), [asset]);
  const image = `${api}/storefront/media/${asset.id}?v=${encodeURIComponent(asset.updatedAt)}`;

  const patch = async (changes: Partial<Asset>, success: string) => {
    setSaving(true);
    setNotice("");
    const response = await fetch(`${api}/admin/storefront-media/${asset.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(changes),
    });
    const payload = await response.json().catch(() => ({}));
    setNotice(response.ok ? success : payload.message ?? "Não foi possível salvar.");
    if (response.ok) await onChanged();
    setSaving(false);
  };

  return (
    <article className={`overflow-hidden border bg-white ${asset.active ? "border-black/10" : "border-black/5 opacity-75"}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-[#edf2ef]">
        <Image src={image} alt={asset.altText} fill unoptimized sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw" className="object-cover" />
        <span className="absolute left-3 top-3 bg-white/90 px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#132927] backdrop-blur">{categoryLabel(asset.category)}</span>
        {asset.isPrimary && <span className="absolute right-3 top-3 inline-flex items-center gap-1 bg-[#132927] px-2 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-white"><Sparkles size={10} /> Principal</span>}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-[#132927]">{asset.title}</h3><p className="mt-1 text-[11px] text-[#687875]">{asset.placement ? placementOptions.find((item) => item.value === asset.placement)?.label ?? asset.placement : "Somente na biblioteca"}{asset.product ? ` · ${asset.product.name}` : ""}</p></div><span className={`size-2.5 shrink-0 rounded-full ${asset.active ? "bg-[#0a8d76]" : "bg-[#aab4b1]"}`} title={asset.active ? "Publicada" : "Arquivada"} /></div>
        <div className="mt-4 flex gap-2">
          <button disabled={saving} onClick={() => void patch({ active: !asset.active }, asset.active ? "Foto retirada da loja; o arquivo foi preservado." : "Foto publicada.")} className="inline-flex h-9 flex-1 items-center justify-center gap-2 border border-black/15 text-[11px] font-semibold text-[#253c38] hover:bg-[#f2f6f4]">{asset.active ? <EyeOff size={14} /> : <Eye size={14} />}{asset.active ? "Retirar" : "Publicar"}</button>
          {!asset.isPrimary && <button disabled={saving} onClick={() => void patch({ isPrimary: true, active: true }, "Foto definida como principal.")} className="inline-flex h-9 flex-1 items-center justify-center gap-2 bg-[#132927] text-[11px] font-semibold text-white"><Sparkles size={14} /> Destacar</button>}
        </div>
        <details className="mt-4 border-t border-black/10 pt-3">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[.1em] text-[#526461]">Editar informações</summary>
          <div className="pt-1">
            <Field label="Título"><input className={controlClass} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
            <Field label="Texto alternativo"><input className={controlClass} value={draft.altText} onChange={(event) => setDraft({ ...draft, altText: event.target.value })} /></Field>
            <Field label="Legenda"><textarea className={`${controlClass} min-h-16`} value={draft.caption ?? ""} onChange={(event) => setDraft({ ...draft, caption: event.target.value })} /></Field>
            <Field label="Crédito"><input className={controlClass} value={draft.credit ?? ""} onChange={(event) => setDraft({ ...draft, credit: event.target.value })} /></Field>
            <Field label="Onde usar"><select className={controlClass} value={draft.placement ?? ""} onChange={(event) => setDraft({ ...draft, placement: event.target.value || null })}>{placementOptions.map((option) => <option key={option.value || "library"} value={option.value}>{option.label}</option>)}</select></Field>
            <Field label="Produto"><select className={controlClass} value={draft.productId ?? ""} onChange={(event) => setDraft({ ...draft, productId: event.target.value || null })}><option value="">Nenhum</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></Field>
            <Field label="Ordem"><input className={controlClass} type="number" min="0" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></Field>
            <button disabled={saving} onClick={() => void patch({ title: draft.title, altText: draft.altText, caption: draft.caption, credit: draft.credit, placement: draft.placement, productId: draft.productId, entityKey: products.find((product) => product.id === draft.productId)?.slug ?? null, sortOrder: draft.sortOrder }, "Informações salvas.")} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 bg-[#087568] text-[11px] font-bold uppercase tracking-[.1em] text-white disabled:opacity-60">{saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />} Salvar</button>
          </div>
        </details>
        {notice && <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-[#37615a]"><Check size={13} className="mt-0.5 shrink-0" />{notice}</p>}
      </div>
    </article>
  );
}

const controlClass = "h-10 w-full border border-black/15 bg-white px-3 text-xs text-[#213632] outline-none transition focus:border-[#087568] focus:ring-1 focus:ring-[#087568]";

function productSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
