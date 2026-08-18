/**
 * URL única da API para páginas client-side e públicas.
 * No navegador, usa o proxy same-origin do Next.js para preservar
 * a sessão e evitar 401 entre domínios distintos no staging.
 */
export function getApiBaseUrl() {
  if (typeof window !== "undefined") return "/api";

  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  return "http://localhost:3001/api";
}
