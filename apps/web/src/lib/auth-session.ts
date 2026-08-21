export type SessionIdentity = {
  id: string;
  companyId: string;
  name: string;
  email?: string;
  role: string;
  active: boolean;
  avatarUrl?: string | null;
};

export type SessionErrorKind = "unauthenticated" | "unavailable";

export class SessionError extends Error {
  status?: number;
  constructor(
    public readonly kind: SessionErrorKind,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "SessionError";
  }
}

export type SessionFetchOptions = {
  timeoutMs?: number;
  retryDelaysMs?: number[];
};

const DEFAULT_RETRY_DELAYS_MS = [0, 1000, 2000, 4000, 8000];

export function getApiRoot() {
  if (typeof window !== "undefined") return "/api";
  const configured = process.env.NEXT_PUBLIC_API_URL;
  return configured?.replace(/\/$/, "") ?? "http://localhost:3001/api";
}

export async function fetchSessionIdentity(
  apiRoot: string,
  options: SessionFetchOptions = {},
): Promise<SessionIdentity> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  let lastError: SessionError | null = null;

  for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
    const delay = retryDelaysMs[attempt] ?? 0;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      return await fetchSessionAttempt(apiRoot, timeoutMs);
    } catch (cause) {
      const error = cause instanceof SessionError
        ? cause
        : new SessionError("unavailable", "Não foi possível conectar ao BBOS.", true);
      if (error.kind === "unauthenticated" || !error.retryable || attempt === retryDelaysMs.length - 1) {
        throw error;
      }
      lastError = error;
      console.warn("[BBOS] transient session failure; retrying", { attempt: attempt + 1, status: error.status });
    }
  }
  throw lastError ?? new SessionError("unavailable", "Não foi possível conectar ao BBOS.");
}

async function fetchSessionAttempt(apiRoot: string, timeoutMs: number): Promise<SessionIdentity> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${apiRoot}/auth/me`, { credentials: "include", signal: controller.signal });
  } catch {
    throw new SessionError("unavailable", "Não foi possível conectar ao BBOS.", true);
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 401 || response.status === 403) {
    throw new SessionError("unauthenticated", "Sessão não autenticada ou expirada.");
  }
  const payload = await response.json().catch(() => ({}));
  const user = payload?.user as SessionIdentity | undefined;
  if (!response.ok) {
    const retryable = response.status === 502 || response.status === 503 || response.status === 504;
    const error = new SessionError("unavailable", "Não foi possível conectar ao BBOS.", retryable);
    (error as SessionError & { status?: number }).status = response.status;
    throw error;
  }
  if (!user?.id || !user.companyId || user.active === false) {
    throw new SessionError("unauthenticated", "Sessão não autenticada ou expirada.");
  }
  return user;
}
