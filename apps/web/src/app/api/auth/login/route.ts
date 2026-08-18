import { NextResponse } from "next/server";
import { stagingCredentials, stagingIdentity, stagingSessionMaxAge, stagingSessionToken, STAGING_SESSION_COOKIE } from "@/lib/staging-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const credentials = stagingCredentials();
    if (!credentials) return NextResponse.json({ message: "Autenticação de staging não configurada." }, { status: 503 });
    const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
    if (String(body?.email ?? "").trim() !== credentials.username || body?.password !== credentials.password) {
      return NextResponse.json({ message: "Credenciais inválidas." }, { status: 401 });
    }
    const token = await stagingSessionToken();
    if (!token) return NextResponse.json({ message: "Autenticação de staging não configurada." }, { status: 503 });
    const response = NextResponse.json({ user: stagingIdentity() });
    response.cookies.set(STAGING_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: stagingSessionMaxAge,
    });
    return response;
  } catch {
    return NextResponse.json({ message: "Não foi possível entrar no BBOS." }, { status: 500 });
  }
}
