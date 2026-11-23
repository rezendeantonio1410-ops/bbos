/**
 * Upstream selection for the same-origin API proxy.
 *
 * The legacy public staging API is only a last resort when NOTHING is
 * configured. Once an environment names its API (RC1, homologation,
 * previews), requests must never leak to a different backend/database.
 * Non-idempotent requests are never replayed on another upstream: the
 * first one may already have been processed (orders, payments, logins).
 */
export const LEGACY_STAGING_API = "https://bbos-api-staging.onrender.com";

function normalizeApiBase(value: string) {
  let base = value.trim().replace(/\/$/, "");
  // Render's private service reference is "host:port" without a scheme.
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
  return base.endsWith("/api") ? base : `${base}/api`;
}

export function proxyUpstreamBases(env: Record<string, string | undefined>): string[] {
  const configured = [env.BBOS_API_INTERNAL_URL, env.API_INTERNAL_URL, env.NEXT_PUBLIC_API_URL]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .map(normalizeApiBase);
  const candidates = configured.length ? configured : [normalizeApiBase(LEGACY_STAGING_API)];
  return [...new Set(candidates)];
}

export function mayRetryOnAnotherUpstream(method: string): boolean {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}
