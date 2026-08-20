import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

function apiBaseUrl() {
  const configured = [
    process.env.BBOS_API_INTERNAL_URL,
    process.env.API_INTERNAL_URL,
    process.env.NEXT_PUBLIC_API_URL,
  ]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));
  if (!configured) throw new Error("API interna não configurada.");
  const base = configured.replace(/\/$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}

function upstreamHeaders(request: NextRequest) {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const cookie = request.headers.get("cookie");
  const authorization = request.headers.get("authorization");
  const accept = request.headers.get("accept");
  const userAgent = request.headers.get("user-agent");

  if (contentType) headers.set("content-type", contentType);
  if (cookie) headers.set("cookie", cookie);
  if (authorization) headers.set("authorization", authorization);
  if (accept) headers.set("accept", accept);
  if (userAgent) headers.set("user-agent", userAgent);
  headers.set("x-forwarded-host", request.nextUrl.host);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));
  return headers;
}

async function proxy(request: NextRequest, context: RouteContext) {
  try {
    const { path } = await context.params;
    const target = new URL(
      `${apiBaseUrl()}/${path.map(encodeURIComponent).join("/")}`,
    );
    target.search = request.nextUrl.search;

    const method = request.method.toUpperCase();
    const hasBody = method !== "GET" && method !== "HEAD";
    const body = hasBody ? await request.arrayBuffer() : undefined;

    const response = await fetch(target, {
      method,
      headers: upstreamHeaders(request),
      body,
      redirect: "manual",
      cache: "no-store",
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    responseHeaders.delete("transfer-encoding");
    responseHeaders.delete("connection");

    const getSetCookie = (
      response.headers as Headers & { getSetCookie?: () => string[] }
    ).getSetCookie;
    if (getSetCookie) {
      responseHeaders.delete("set-cookie");
      for (const cookie of getSetCookie.call(response.headers)) {
        responseHeaders.append("set-cookie", cookie);
      }
    }

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("BBOS API proxy failed", error);
    const message =
      error instanceof Error ? error.message : "Falha desconhecida no proxy.";
    return NextResponse.json(
      {
        message: "Não foi possível conectar ao BBOS.",
        detail: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
