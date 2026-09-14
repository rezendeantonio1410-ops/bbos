import { NextResponse } from "next/server";
export async function POST(request: Request) {
  const body = await request.json();
  const postalCode = String(body.postalCode || "").replace(/\D/g, "");
  const subtotalCents = Number(body.subtotalCents || 0);
  const weightGrams = Number(body.weightGrams || 0);
  if (postalCode.length !== 8 || subtotalCents <= 0 || weightGrams <= 0)
    return NextResponse.json(
      { message: "Dados de entrega inválidos." },
      { status: 400 },
    );
  const region = Number(postalCode.slice(0, 1));
  const free = subtotalCents >= 27000 && [0, 1, 2, 8, 9].includes(region);
  const priceCents = free
    ? 0
    : 1590 + Math.max(0, Math.ceil(weightGrams / 1000) - 1) * 450;
  return NextResponse.json({
    name: free ? "Entrega Bispo gratuita" : "Entrega econômica",
    priceCents,
    deliveryDays: region >= 8 ? 4 : 7,
  });
}
