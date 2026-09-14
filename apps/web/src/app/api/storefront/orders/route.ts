import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const configuredBase =
    process.env.BBOS_API_INTERNAL_URL ||
    process.env.API_INTERNAL_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL;
  if (!configuredBase)
    return NextResponse.json(
      { message: "A conexão segura com o BBOS ainda não está configurada." },
      { status: 503 },
    );
  const root = configuredBase.replace(/\/$/, "");
  const apiBase = root.endsWith("/api") ? root : `${root}/api`;
  const response = await fetch(
    `${apiBase.replace(/\/$/, "")}/storefront/orders`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
      cache: "no-store",
    },
  );
  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}
