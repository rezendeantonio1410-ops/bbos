import { getApiBaseUrl } from "@/lib/api-url";

export type StorefrontMediaAsset = {
  id: string;
  productId: string | null;
  category: string;
  entityKey: string | null;
  placement: string | null;
  title: string;
  altText: string;
  caption: string | null;
  credit: string | null;
  sortOrder: number;
  isPrimary: boolean;
  updatedAt: string;
  url: string;
};

export type StorefrontMediaLibrary = {
  assets: StorefrontMediaAsset[];
  slots: Record<string, StorefrontMediaAsset>;
  productProofs: Record<string, StorefrontMediaAsset[]>;
};

export async function loadStorefrontMedia(): Promise<StorefrontMediaLibrary> {
  try {
    const api = getApiBaseUrl();
    const response = await fetch(`${api}/storefront/media`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return emptyLibrary();
    const rows = (await response.json()) as Omit<StorefrontMediaAsset, "url">[];
    const assets = rows.map((asset) => ({
      ...asset,
      url: `${api}/storefront/media/${asset.id}?v=${encodeURIComponent(asset.updatedAt)}`,
    }));
    const slots: Record<string, StorefrontMediaAsset> = {};
    for (const asset of [...assets].sort(primaryFirst)) {
      if (asset.placement && !slots[asset.placement]) slots[asset.placement] = asset;
    }
    const productProofs: Record<string, StorefrontMediaAsset[]> = {};
    for (const asset of assets) {
      if (asset.category !== "PRODUCT_PROOF") continue;
      const keys = [asset.productId, asset.entityKey].filter((value): value is string => Boolean(value));
      for (const key of keys) (productProofs[key] ??= []).push(asset);
    }
    return { assets, slots, productProofs };
  } catch {
    return emptyLibrary();
  }
}

function primaryFirst(a: StorefrontMediaAsset, b: StorefrontMediaAsset) {
  if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
  return a.sortOrder - b.sortOrder;
}

function emptyLibrary(): StorefrontMediaLibrary {
  return { assets: [], slots: {}, productProofs: {} };
}
