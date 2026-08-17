import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = ["/home", "/dashboard", "/dashboard-industrial", "/recebimento", "/compras-cafe-verde", "/laboratorio", "/estoque", "/producao", "/financeiro", "/custos", "/pedidos", "/vendas", "/commerce", "/bi", "/produtos"];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) && !request.cookies.has("bbos_session")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/:path*"] };
