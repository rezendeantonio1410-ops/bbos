import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getUpstreamBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return "http://localhost:3001/api";
}

function buildUpstreamUrl(request: NextRequest, path: string[]) {
  const upstream = new URL(
    `${getUpstreamBaseUrl()}/${path.join("/")}`,
  );

  upstream.search = request.nextUrl.search;

  return upstream;
}

function buildUpstreamHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);

  headers.delete("host");
  headers.delete("content-length");
  headers.delete("connection");
  headers.delete("accept-encoding");

  return headers;
}

function buildResponseHeaders(upstream: Response) {
  const headers = new Headers(upstream.headers);

  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  headers.delete("connection");

  return headers;
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await context.params;

    const method = request.method.toUpperCase();
    const hasBody = method !== "GET" && method !== "HEAD";

    const upstream = await fetch(
      buildUpstreamUrl(request, path),
      {
        method,
        headers: buildUpstreamHeaders(request),
        body: hasBody
          ? await request.arrayBuffer()
          : undefined,
        cache: "no-store",
        redirect: "manual",
      },
    );

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: buildResponseHeaders(upstream),
    });
  } catch (error) {
    console.error("BBOS API proxy failed", error);

    return NextResponse.json(
      {
        message:
          "Não foi possível comunicar com a API do BBOS.",
      },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
