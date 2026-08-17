/**
 * URL única da API para páginas client-side e públicas.
 * Em LAN, o host acompanha o host usado para abrir o Web; em staging/produção
 * NEXT_PUBLIC_API_URL deve apontar para a origem pública da API.
 */
export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3001/api`;
  }
  return "http://localhost:3001/api";
}
