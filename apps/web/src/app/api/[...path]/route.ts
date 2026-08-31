import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

function normalizeApiBase(value: string) {
  const base = value.trim().replace(/\/$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}

function apiBaseUrls() {
  const candidates = [
    process.env.BBOS_API_INTERNAL_URL,
    process.env.API_INTERNAL_URL,
    process.env.NEXT_PUBLIC_API_URL,
    "https://bbos-api-staging.onrender.com",
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .map(normalizeApiBase);

  return [...new Set(candidates)];
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

async function fetchUpstream(
  request: NextRequest,
  target: URL,
  method: string,
  body: ArrayBuffer | undefined,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(target, {
      method,
      headers: upstreamHeaders(request),
      body,
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function proxy(request: NextRequest, context: RouteContext) {
  const bases = apiBaseUrls();
  if (bases.length === 0) {
    console.error("BBOS API proxy failed: no upstream configured");
    return NextResponse.json(
      { message: "Não foi possível conectar ao BBOS." },
      { status: 502 },
    );
  }

  const { path } = await context.params;
  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;
  let lastError: unknown = null;

  for (const base of bases) {
    const target = new URL(`${base}/${path.map(encodeURIComponent).join("/")}`);
    target.search = request.nextUrl.search;

    try {
      const response = await fetchUpstream(request, target, method, body);
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
      lastError = error;
      console.error("BBOS API proxy upstream failed", {
        upstream: base,
        path: request.nextUrl.pathname,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.error("BBOS API proxy exhausted all upstreams", {
    path: request.nextUrl.pathname,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });

  return NextResponse.json(
    { message: "Não foi possível conectar ao BBOS." },
    { status: 502 },
  );
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
