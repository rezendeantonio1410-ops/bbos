export const CUPPING_API = "/api";

const tokenKey = (sessionId: string) => `cupping-token:${sessionId}`;
const participantKey = (sessionId: string) => `cupping-participant:${sessionId}`;
export const sessionCacheKey = (sessionId: string) => `cupping-session:${sessionId}`;
export const maskCuppingToken = (token?: string | null) =>
  token ? `${token.slice(0, 6)}…${token.slice(-4)}` : "ausente";

type CurrentCuppingSession = {
  id: string;
  sample: { id: string; sampleNumber?: string | null; [key: string]: unknown };
  evaluations?: Array<{ sampleId?: string; status?: string; completedAt?: string | null }>;
  [key: string]: unknown;
};

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

export async function fetchCurrentCuppingSession(sessionId: string, token?: string | null) {
  const response = await cuppingFetch(`${CUPPING_API}/cupping/sessions`, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  }, { retries: 1, timeoutMs: 8_000 });
  if (!response.ok) throw new Error("Não foi possível carregar a sessão de cupping.");
  const sessions = await response.json() as CurrentCuppingSession[];
  const current = sessions.find((item) => item.id === sessionId);
  if (!current) throw new Error("Sessão de cupping não encontrada.");
  const sample = current.sample;
  return {
    session: {
      ...current,
      evaluations: current.evaluations?.map((evaluation) => ({ ...evaluation, sampleId: sample.id, status: evaluation.completedAt ? "COMPLETED" : "IN_PROGRESS" })),
      samples: [{ sample: { ...sample, id: sample.id, sampleCode: sample.sampleNumber ?? sample.id } }],
    },
    participant: { id: "current-user", name: "Minha avaliação" },
    progress: { samples: [{ sampleId: sample.id, state: current.evaluations?.some((item) => item.completedAt) ? "COMPLETED" : "IN_PROGRESS" }], overall: { state: current.evaluations?.some((item) => item.completedAt) ? "COMPLETED" : "IN_PROGRESS" } },
  };
}

export async function saveCurrentCuppingEvaluation(sessionId: string, draft: { scores: Record<string, number>; defects?: unknown; sensoryNotes?: unknown }, complete: boolean, token?: string | null) {
  const attributes = { ...draft.scores, fragrance: draft.scores.fragranceAroma ?? draft.scores.fragrance };
  delete (attributes as Record<string, unknown>).fragranceAroma;
  return cuppingFetch(`${CUPPING_API}/cupping/sessions/${sessionId}/evaluation`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ attributes, defects: draft.defects, sensoryNotes: draft.sensoryNotes, complete }),
  }, { retries: 1, timeoutMs: 8_000 });
}
