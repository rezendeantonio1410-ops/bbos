import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "bbos_session";

const protectedPrefixes = [
  "/home",
  "/dashboard",
  "/dashboard-industrial",
  "/recebimento",
  "/compras-cafe-verde",
  "/laboratorio",
  "/estoque",
  "/producao",
  "/financeiro",
  "/custos",
  "/pedidos",
  "/vendas",
  "/commerce",
  "/bi",
  "/produtos",
];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  // Session validity belongs to the API. This middleware only prevents a
  // protected page from rendering when the browser has no session cookie.
  const hasSession = request.cookies.has(SESSION_COOKIE);
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
