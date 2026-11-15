import { isProtectedSystemPath } from "./system-routes";

const MANAGEMENT_HOSTS = new Set([
  "bbos.bispocoffees.com.br",
  "bbos-app-rc1.onrender.com",
]);

const STOREFRONT_HOSTS = new Set([
  "loja.bispocoffees.com.br",
  "bbos-ecommerce-preview-v2.onrender.com",
]);

export function normalizeHostname(value: string | null | undefined) {
  const firstHost = (value ?? "").split(",")[0] ?? "";

  return firstHost
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

type DomainRedirectInput = {
  hostname: string;
  pathname: string;
  search: string;
  hasSession: boolean;
};

export function resolveDomainRedirect({
  hostname,
  pathname,
  search,
  hasSession,
}: DomainRedirectInput) {
  if (MANAGEMENT_HOSTS.has(hostname)) {
    if (pathname === "/") {
      return hasSession ? "/home" : "/login?returnTo=%2Fhome";
    }

    if (pathname === "/loja" || pathname.startsWith("/loja/")) {
      return `https://loja.bispocoffees.com.br${pathname}${search}`;
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

  return null;
}
