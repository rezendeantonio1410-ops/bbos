export type SessionIdentity = {
  id: string;
  companyId: string;
  name: string;
  email?: string;
  role: string;
  active: boolean;
};

export type SessionErrorKind = "unauthenticated" | "unavailable";

export class SessionError extends Error {
  constructor(public readonly kind: SessionErrorKind, message: string) {
    super(message);
    this.name = "SessionError";
  }
}

export function getApiRoot() {
  if (typeof window !== "undefined") return "/api";
  const configured = process.env.NEXT_PUBLIC_API_URL;
  return configured?.replace(/\/$/, "") ?? "http://localhost:3001/api";
}

export async function fetchSessionIdentity(apiRoot: string): Promise<SessionIdentity> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response: Response;
  try {
    response = await fetch(`${apiRoot}/auth/me`, { credentials: "include", signal: controller.signal });
  } catch {
    throw new SessionError("unavailable", "Não foi possível conectar ao BBOS.");
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 401 || response.status === 403) {
    throw new SessionError("unauthenticated", "Sessão não autenticada ou expirada.");
  }
  const payload = await response.json().catch(() => ({}));
  const user = payload?.user as SessionIdentity | undefined;
  if (!response.ok) {
    throw new SessionError("unavailable", "Não foi possível conectar ao BBOS.");
  }
  if (!user?.id || !user.companyId || user.active === false) {
    throw new SessionError("unauthenticated", "Sessão não autenticada ou expirada.");
  }
  return user;
}
