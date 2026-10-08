import { isProtectedSystemPath } from "./system-routes";
import { getStorefrontOrigin } from "./storefront-url";

const MANAGEMENT_HOSTS = new Set([
  "bbos.bispocoffees.com.br",
  "bbos-app-rc1.onrender.com",
]);

const STOREFRONT_HOSTS = new Set([
  "bispocoffees.com.br",
  "www.bispocoffees.com.br",
  "loja.bispocoffees.com.br",
  "bbos-ecommerce-preview-v2.onrender.com",
]);

const LEGACY_STOREFRONT_PATHS = new Map<string, string>([
  ["/produtos", "/loja#cafes"],
  ["/produtos/essencial-500g", "/loja#essencial"],
  ["/produtos/intenso-500g", "/loja#intenso"],
  ["/produtos/caramelo-500g", "/loja#caramelo"],
  ["/produtos/doce-de-leite-500g", "/loja#doce-de-leite"],
  ["/produtos/tangerina-500g", "/loja#tangerina"],
  ["/produtos/singular-500g", "/loja#singular"],
  ["/produtos/sublime-500g", "/loja#sublime"],
  ["/produtos/raro-250g", "/loja#raro"],
  ["/contato", "/loja/entrega-e-devolucoes"],
  ["/quem-somos", "/loja/sobre"],
  ["/account", "/loja/conta"],
  ["/account/login", "/loja/conta"],
  ["/account/register", "/loja/conta"],
]);

export function normalizeHostname(value: string | null | undefined) {
  const firstHost = (value ?? "").split(",")[0] ?? "";

  return firstHost.trim().toLowerCase().replace(/:\d+$/, "");
}

type DomainRedirectInput = {
  hostname: string;
  pathname: string;
  search: string;
  hasSession: boolean;
  storefrontOrigin?: string;
  enforceStorefrontCanonicalHost?: boolean;
};

type LegacyRedirectInput = Pick<
  DomainRedirectInput,
  "hostname" | "pathname" | "search" | "storefrontOrigin"
>;

function normalizedPathname(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "").toLowerCase();
}

function destinationWithSearch(
  origin: string,
  destination: string,
  search: string,
) {
  const [path, fragment] = destination.split("#");
  return `${origin}${path}${search}${fragment ? `#${fragment}` : ""}`;
}

export function resolveLegacyStorefrontRedirect({
  hostname,
  pathname,
  search,
  storefrontOrigin = getStorefrontOrigin(),
}: LegacyRedirectInput) {
  if (!STOREFRONT_HOSTS.has(hostname)) return null;

  const destination = LEGACY_STOREFRONT_PATHS.get(normalizedPathname(pathname));

  if (!destination) return null;
  return destinationWithSearch(storefrontOrigin, destination, search);
}

export function resolveDomainRedirect({
  hostname,
  pathname,
  search,
  hasSession,
  storefrontOrigin = getStorefrontOrigin(),
  enforceStorefrontCanonicalHost = false,
}: DomainRedirectInput) {
  if (MANAGEMENT_HOSTS.has(hostname)) {
    if (pathname === "/") {
      return hasSession ? "/home" : "/login?returnTo=%2Fhome";
    }

    if (pathname === "/loja" || pathname.startsWith("/loja/")) {
      return `${storefrontOrigin}${pathname}${search}`;
    }
  }

  if (
    STOREFRONT_HOSTS.has(hostname) &&
    (pathname === "/login" ||
      pathname === "/bbos" ||
      isProtectedSystemPath(pathname))
  ) {
    return `https://bbos.bispocoffees.com.br${pathname}${search}`;
  }

  if (
    enforceStorefrontCanonicalHost &&
    STOREFRONT_HOSTS.has(hostname) &&
    hostname !== new URL(storefrontOrigin).hostname
  ) {
    const canonicalPath = pathname === "/" ? "/loja" : pathname;
    return `${storefrontOrigin}${canonicalPath}${search}`;
  }

  return null;
}
