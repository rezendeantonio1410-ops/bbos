import { NextResponse } from "next/server";

function apiBase() {
  const configured =
    process.env.BBOS_API_INTERNAL_URL ||
    process.env.API_INTERNAL_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL;
  if (!configured) return null;
  const root = configured.replace(/\/$/, "");
  return root.endsWith("/api") ? root : `${root}/api`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const base = apiBase();
  if (!base)
    return NextResponse.json(
      { message: "A conexão segura com o BBOS ainda não está configurada." },
      { status: 503 },
    );
  const token = request.headers.get("x-storefront-order-token");
  const { orderId } = await context.params;
  const response = await fetch(
    `${base}/storefront/orders/${encodeURIComponent(orderId)}/status`,
    {
      headers: token ? { "x-storefront-order-token": token } : {},
      cache: "no-store",
    },
  );
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}
