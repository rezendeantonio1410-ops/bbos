import { NextRequest, NextResponse } from "next/server";
const SESSION_COOKIE = "bbos_session";

const protectedPrefixes = ["/home", "/dashboard", "/dashboard-industrial", "/recebimento", "/compras-cafe-verde", "/laboratorio", "/estoque", "/producao", "/financeiro", "/custos", "/pedidos", "/vendas", "/commerce", "/bi", "/produtos"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedRoute = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  // The API owns session validity. Middleware only avoids rendering protected
  // pages when there is no session cookie; AppShell verifies it through the
  // real API and redirects invalid/expired sessions.
  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (protectedRoute && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/:path*"] };
