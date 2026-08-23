import ConfirmationClient, { type PublicConfirmation } from "./confirmation-client";

const configuredApi = [
  process.env.BBOS_API_INTERNAL_URL,
  process.env.API_INTERNAL_URL,
  process.env.NEXT_PUBLIC_API_URL,
]
  .map((value) => value?.trim())
  .find((value): value is string => Boolean(value));
const API_INTERNAL = (configuredApi
  ? configuredApi.endsWith("/api")
    ? configuredApi
    : `${configuredApi}/api`
  : "http://localhost:3001/api").replace(/\/$/, "");

async function getPublicConfirmation(token: string): Promise<PublicConfirmation | null> {
  try {
    const response = await fetch(`${API_INTERNAL}/purchase-acceptance/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as PublicConfirmation;
  } catch {
    return null;
  }
}

export default async function PublicConfirmationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getPublicConfirmation(token);
  if (!data) {
    return <main className="grid min-h-screen place-items-center bg-stone-50 p-6 text-center"><div className="max-w-lg rounded-3xl bg-white p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.16em] text-forest-700">Bispo Coffees</p><h1 className="mt-3 text-xl font-semibold text-forest-950">Confirmação indisponível</h1><p className="mt-3 text-sm text-stone-600">Este link é inválido, expirou ou não está disponível.</p></div></main>;
  }
  return <ConfirmationClient token={token} initialData={data} />;
}
