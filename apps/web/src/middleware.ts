import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = ["/home", "/dashboard", "/dashboard-industrial", "/recebimento", "/compras-cafe-verde", "/laboratorio", "/estoque", "/producao", "/financeiro", "/custos", "/pedidos", "/vendas", "/commerce", "/bi", "/produtos"];

function stagingProtection(request: NextRequest) {
  const username = process.env.BBOS_STAGING_USER;
  const password = process.env.BBOS_STAGING_PASSWORD;
  if (process.env.NODE_ENV !== "production" || !username || !password) return null;
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    try {
      const decoded = atob(authorization.slice(6));
      if (decoded === `${username}:${password}`) return null;
    } catch {
      // Fall through to the challenge for malformed credentials.
    }
  }
  return new NextResponse("Acesso restrito ao staging BBOS.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="BBOS Staging", charset="UTF-8"' },
  });
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/_next/") && pathname !== "/favicon.ico") {
    const challenge = stagingProtection(request);
    if (challenge) return challenge;
  }
  if (protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) && !request.cookies.has("bbos_session")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/:path*"] };
