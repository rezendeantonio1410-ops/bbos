import { notFound } from "next/navigation";
import PreviewClient from "./preview-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function CuppingMobilePreviewPage() {
  const previewEnabled = process.env.NODE_ENV === "development" || process.env.CUPPING_PREVIEW_ENABLED === "true";
  if (!previewEnabled) notFound();
  return <PreviewClient />;
}
