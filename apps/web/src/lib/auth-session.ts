export type SessionIdentity = {
  id: string;
  companyId: string;
  name: string;
  email?: string;
  role: string;
  active: boolean;
};

export async function fetchSessionIdentity(apiRoot: string): Promise<SessionIdentity> {
  const response = await fetch(`${apiRoot}/auth/me`, { credentials: "include" });
  const payload = await response.json().catch(() => ({}));
  const user = payload?.user as SessionIdentity | undefined;
  if (!response.ok || !user?.id || !user.companyId || user.active === false) {
    throw new Error("Sessão não autenticada ou expirada.");
  }
  return user;
}
