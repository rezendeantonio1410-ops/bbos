const FALLBACK_STOREFRONT_ORIGIN = "https://loja.bispocoffees.com.br";

export function getStorefrontOrigin() {
  const configured = process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim();

  if (!configured) return FALLBACK_STOREFRONT_ORIGIN;

  try {
    return new URL(configured).origin;
  } catch {
    return FALLBACK_STOREFRONT_ORIGIN;
  }
}
