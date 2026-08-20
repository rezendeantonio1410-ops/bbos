import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function headersFor(request: NextRequest) {
  const headers = new Headers();
  for (const name of ["cookie", "authorization", "content-type", "accept"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

export async function GET(request: NextRequest) {
  try {
    // The Nest purchase controller declares /:id before /suppliers, so a GET
    // to /suppliers is interpreted as purchase id "suppliers". References is
    // a static route declared before /:id and already returns the same active
    // supplier directory used by the purchase form. Use it as the canonical
    // read source until the API routes are split into dedicated controllers.
    const state = request.nextUrl.searchParams.get("state") ?? "";
    const target = new URL(`${apiBaseUrl()}/green-coffee-purchases/references`);
    if (state) target.searchParams.set("state", state);
    const response = await fetch(target, {
      headers: headersFor(request),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    const suppliers = Array.isArray(data?.suppliers) ? data.suppliers : [];
    const active = request.nextUrl.searchParams.get("active");
    const filtered = active === "false" ? [] : suppliers;
    return NextResponse.json(filtered);
  } catch (error) {
    console.error("BBOS supplier directory proxy failed", error);
    return NextResponse.json(
      { message: "Não foi possível carregar fornecedores." },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const target = `${apiBaseUrl()}/green-coffee-purchases/suppliers`;
    const response = await fetch(target, {
      method: "POST",
      headers: headersFor(request),
      body: await request.arrayBuffer(),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("BBOS supplier create proxy failed", error);
    return NextResponse.json(
      { message: "Não foi possível salvar fornecedor." },
      { status: 502 },
    );
  }
}
