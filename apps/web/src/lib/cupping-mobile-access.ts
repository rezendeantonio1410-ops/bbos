export const CUPPING_API = "/api";

const tokenKey = (sessionId: string) => `cupping-token:${sessionId}`;
const participantKey = (sessionId: string) => `cupping-participant:${sessionId}`;
export const sessionCacheKey = (sessionId: string) => `cupping-session:${sessionId}`;
export const maskCuppingToken = (token?: string | null) =>
  token ? `${token.slice(0, 6)}…${token.slice(-4)}` : "ausente";

export function traceCuppingAccess(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") console.info(`[cupping-mobile] ${event}`, details);
}

export function persistCuppingAccess(sessionId: string, token: string, participantId: string) {
  localStorage.setItem(tokenKey(sessionId), token);
  localStorage.setItem(participantKey(sessionId), participantId);
  // Compatibilidade com abas que ainda estejam usando o bundle anterior.
  sessionStorage.setItem(tokenKey(sessionId), token);
  sessionStorage.setItem(participantKey(sessionId), participantId);
}

export function getCuppingToken(sessionId: string) {
  const persistent = localStorage.getItem(tokenKey(sessionId));
  if (persistent) return persistent;
  const legacy = sessionStorage.getItem(tokenKey(sessionId));
  if (legacy) localStorage.setItem(tokenKey(sessionId), legacy);
  return legacy;
}

export function recoverCuppingToken(sessionId: string) {
  const stored = getCuppingToken(sessionId);
  if (stored) return stored;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = hash.get("access");
  if (accessToken) {
    localStorage.setItem(tokenKey(sessionId), accessToken);
    sessionStorage.setItem(tokenKey(sessionId), accessToken);
  }
  return accessToken;
}

export function cacheCuppingSession(sessionId: string, context: unknown) {
  localStorage.setItem(sessionCacheKey(sessionId), JSON.stringify(context));
}

export function readCachedCuppingSession<T>(sessionId: string): T | null {
  try {
    const cached = localStorage.getItem(sessionCacheKey(sessionId));
    return cached ? JSON.parse(cached) as T : null;
  } catch {
    return null;
  }
}

const transientStatus = new Set([502, 503, 504]);
export async function cuppingFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: { retries?: number; timeoutMs?: number } = {},
) {
  const retries = options.retries ?? 1;
  const timeoutMs = options.timeoutMs ?? 8_000;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort("timeout"), timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (!transientStatus.has(response.status) || attempt === retries) return response;
      lastError = new Error(`Falha transitória ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw error;
    } finally {
      window.clearTimeout(timeout);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
  }
  throw lastError;
}
