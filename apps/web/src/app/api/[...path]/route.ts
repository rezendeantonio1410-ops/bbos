import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

function apiBaseUrl() {
  const configured = [process.env.BBOS_API_INTERNAL_URL, process.env.API_INTERNAL_URL, process.env.NEXT_PUBLIC_API_URL]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));
  if (!configured) throw new Error("API interna não configurada.");
  const base = configured.replace(/\/$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}

async function proxy(request: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params;
    const target = new URL(`${apiBaseUrl()}/${path.map(encodeURIComponent).join("/")}`);
    target.search = request.nextUrl.search;
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("content-length");
    headers.delete("connection");
    headers.delete("accept-encoding");
    const method = request.method.toUpperCase();
    const response = await fetch(target, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
    });
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    responseHeaders.delete("transfer-encoding");
    responseHeaders.delete("connection");
    const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    if (getSetCookie) {
      responseHeaders.delete("set-cookie");
      for (const cookie of getSetCookie.call(response.headers)) responseHeaders.append("set-cookie", cookie);
    }
    return new NextResponse(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
  } catch (error) {
    console.error("BBOS API proxy failed", error);
    return NextResponse.json({ message: "Não foi possível conectar ao BBOS." }, { status: 502 });
  }
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
