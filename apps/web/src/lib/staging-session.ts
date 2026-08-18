export const STAGING_SESSION_COOKIE = "bbos_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export function stagingCredentials() {
  const username = process.env.BBOS_STAGING_USER?.trim();
  const password = process.env.BBOS_STAGING_PASSWORD;
  return username && password ? { username, password } : null;
}

export async function stagingSessionToken() {
  const credentials = stagingCredentials();
  if (!credentials) return null;
  const material = `${credentials.username}\u0000${credentials.password}\u0000bbos-staging`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function isValidStagingSession(value?: string | null) {
  const expected = await stagingSessionToken();
  return Boolean(expected && value && value === expected);
}

export function stagingIdentity() {
  const credentials = stagingCredentials();
  if (!credentials) return null;
  return {
    id: "staging-user",
    companyId: "staging-company",
    name: credentials.username,
    email: credentials.username,
    role: "ADMIN",
    active: true,
  };
}

export const stagingSessionMaxAge = SESSION_TTL_SECONDS;
