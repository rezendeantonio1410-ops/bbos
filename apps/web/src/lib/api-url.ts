/**
 * URL única da API para páginas client-side e públicas.
 * No navegador, usa o proxy same-origin do Next.js para preservar
 * a sessão e evitar 401 entre domínios distintos no staging.
 */
export function getApiBaseUrl() {
  // Browser requests go through the same-origin Next proxy. This keeps the
  // staging session cookie available to the API and avoids cross-origin
  // cookie/CORS differences between localhost and Render.
  if (typeof window !== "undefined") return "/api";
  const configured = (process.env.BBOS_API_INTERNAL_URL ?? process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL)?.trim();
  if (configured) {
    const base = configured.replace(/\/$/, "");
    return base.endsWith("/api") ? base : `${base}/api`;
  }
  return "http://localhost:3001/api";
}
