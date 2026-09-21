import { getApiBaseUrl } from "@/lib/api-url";

type PublicImage = {
  id: string;
  isPrimary: boolean;
  useInHero: boolean;
  updatedAt: string;
};

type PublicProductImages = {
  name: string;
  storefrontImages: PublicImage[];
};

export type StorefrontImageSelection = Record<
  string,
  { primary?: string; hero?: string }
>;

export async function loadStorefrontImages(): Promise<StorefrontImageSelection> {
  try {
    const api = getApiBaseUrl();
    const response = await fetch(`${api}/storefront/catalog/images`, {
      cache: "no-store",
    });
    if (!response.ok) return {};
    const products = (await response.json()) as PublicProductImages[];
    return Object.fromEntries(
      products.map((product) => {
        const primary =
          product.storefrontImages.find((image) => image.isPrimary) ??
          product.storefrontImages[0];
        const hero =
          product.storefrontImages.find((image) => image.useInHero) ?? primary;
        const url = (image?: PublicImage) =>
          image
            ? `${api}/storefront/catalog/images/${image.id}?v=${encodeURIComponent(image.updatedAt)}`
            : undefined;
        return [product.name, { primary: url(primary), hero: url(hero) }];
      }),
    );
  } catch {
    return {};
  }
}
