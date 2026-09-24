const CANONICAL_PUBLIC_APP_URL = "https://app.bispocoffees.com.br";

export function publicAppUrl() {
  const environment = String(process.env.NODE_ENV ?? "").trim().toLowerCase();
  const isLocalRuntime = environment === "development" || environment === "test";

  if (!isLocalRuntime) return CANONICAL_PUBLIC_APP_URL;

  return (
    process.env.PUBLIC_APP_URL ??
    process.env.PUBLIC_WEB_URL ??
    process.env.WEB_URL?.split(",")[0] ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
