import { NextResponse } from "next/server";
import { isValidStagingSession, stagingIdentity, STAGING_SESSION_COOKIE } from "@/lib/staging-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${STAGING_SESSION_COOKIE}=`))?.slice(STAGING_SESSION_COOKIE.length + 1);
  if (!(await isValidStagingSession(cookie))) return NextResponse.json({ message: "Sessão não encontrada." }, { status: 401 });
  return NextResponse.json({ user: stagingIdentity() });
}
