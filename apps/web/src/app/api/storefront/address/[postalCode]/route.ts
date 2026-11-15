import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ postalCode: string }> },
) {
  const { postalCode } = await context.params;
  const cep = postalCode.replace(/\D/g, "");
  if (cep.length !== 8)
    return NextResponse.json({ message: "CEP inválido." }, { status: 400 });
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { accept: "application/json" },
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error("lookup");
    const data = await response.json();
    if (data.erro)
      return NextResponse.json(
        { message: "CEP não encontrado." },
        { status: 404 },
      );
    return NextResponse.json({
      postalCode: cep,
      street: data.logradouro || "",
      district: data.bairro || "",
      city: data.localidade || "",
      state: data.uf || "",
      ibgeCityCode: data.ibge || "",
    });
  } catch {
    return NextResponse.json(
      { message: "Não foi possível consultar o CEP agora." },
      { status: 502 },
    );
  }
}
