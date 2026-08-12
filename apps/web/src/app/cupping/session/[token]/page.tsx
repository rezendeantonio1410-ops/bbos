import { redirect } from "next/navigation";

export default async function LegacyCuppingInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/cupping/mobile/invite/${encodeURIComponent(token)}`);
}
