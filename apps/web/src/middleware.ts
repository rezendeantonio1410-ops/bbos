import { NextRequest, NextResponse } from "next/server";
import {
  normalizeHostname,
  resolveDomainRedirect,
  resolveLegacyStorefrontRedirect,
} from "@/lib/domain-routing";
import { isProtectedSystemPath } from "@/lib/system-routes";

const SESSION_COOKIE = "bbos_session";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedRoute = isProtectedSystemPath(pathname);
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const hostname = normalizeHostname(
    request.headers.get("x-forwarded-host") ?? request.nextUrl.hostname,
  );
  const legacyRedirect = resolveLegacyStorefrontRedirect({
    hostname,
    pathname,
    search: request.nextUrl.search,
  });

  if (legacyRedirect) {
    return NextResponse.redirect(new URL(legacyRedirect, request.url), 308);
  }

  const domainRedirect = resolveDomainRedirect({
    hostname,
    pathname,
    search: request.nextUrl.search,
    hasSession,
    enforceStorefrontCanonicalHost:
      process.env.STOREFRONT_ENFORCE_CANONICAL_HOST === "true",
  });

  if (domainRedirect) {
    return NextResponse.redirect(new URL(domainRedirect, request.url), 308);
  }

  // Session validity belongs to the API. This middleware only prevents a
  // protected page from rendering when the browser has no session cookie.
  if (protectedRoute && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

// Do not execute auth middleware for Next.js runtime/static assets. On a cold
// Render instance these requests must remain as cheap and direct as possible;
// routing every JS/CSS chunk through middleware can turn a transient wake-up
// into a blank client page even after the HTML endpoint is already live.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
