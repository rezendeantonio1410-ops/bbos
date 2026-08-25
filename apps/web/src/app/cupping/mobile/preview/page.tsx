import { notFound } from "next/navigation";
import PreviewClient from "./preview-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function CuppingMobilePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PreviewClient />;
}
