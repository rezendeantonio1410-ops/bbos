import type { CatalogProduct } from "@bbos/shared/product-presentation";

export const PRODUCTS_API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/products`;

export async function loadProductCatalog(): Promise<{
  products: CatalogProduct[];
  source: "database";
}> {
  const response = await fetch(PRODUCTS_API_URL, { cache: "no-store", credentials: "include" });
  if (!response.ok) throw new Error("Não foi possível carregar o catálogo persistente.");
  return { products: (await response.json()) as CatalogProduct[], source: "database" };
}

export async function loadProduct(id: string): Promise<CatalogProduct | null> {
  const response = await fetch(`${PRODUCTS_API_URL}/${id}`, { cache: "no-store", credentials: "include" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Não foi possível carregar o produto persistente.");
  return (await response.json()) as CatalogProduct;
}
