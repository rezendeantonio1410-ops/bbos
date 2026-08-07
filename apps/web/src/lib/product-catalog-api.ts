import {
  PRODUCT_CATALOG_DEMO,
  type CatalogProduct,
} from "@bbos/shared/product-presentation";

export const PRODUCTS_API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/products`;

export async function loadProductCatalog(): Promise<{
  products: CatalogProduct[];
  source: "database" | "compatibility";
}> {
  try {
    const response = await fetch(PRODUCTS_API_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Catálogo persistente indisponível.");
    return {
      products: (await response.json()) as CatalogProduct[],
      source: "database",
    };
  } catch {
    return { products: PRODUCT_CATALOG_DEMO, source: "compatibility" };
  }
}

export async function loadProduct(id: string): Promise<CatalogProduct | null> {
  try {
    const response = await fetch(`${PRODUCTS_API_URL}/${id}`, {
      cache: "no-store",
    });
    if (response.ok) return (await response.json()) as CatalogProduct;
  } catch {}
  return PRODUCT_CATALOG_DEMO.find((product) => product.id === id) ?? null;
}
