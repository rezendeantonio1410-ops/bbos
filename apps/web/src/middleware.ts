import { NextRequest, NextResponse } from "next/server";
import { isValidStagingSession, STAGING_SESSION_COOKIE } from "@/lib/staging-session";

const protectedPrefixes = ["/home", "/dashboard", "/dashboard-industrial", "/recebimento", "/compras-cafe-verde", "/laboratorio", "/estoque", "/producao", "/financeiro", "/custos", "/pedidos", "/vendas", "/commerce", "/bi", "/produtos"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedRoute = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const sessionCookie = request.cookies.get(STAGING_SESSION_COOKIE)?.value;
  const hasSession = request.cookies.has(STAGING_SESSION_COOKIE) && (await isValidStagingSession(sessionCookie));
  if (protectedRoute && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/:path*"] };
