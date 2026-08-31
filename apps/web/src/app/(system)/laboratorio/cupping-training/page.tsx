import { redirect } from "next/navigation";

/**
 * Training/calibration uses the same V1 cupping session engine as professional
 * cupping. The desktop is only the session manager; sensory evaluation happens
 * on iPhone/tablet through the participant QR invite.
 *
 * Keep this route as a compatibility entry point for existing Laboratory links
 * and bookmarks, but never render a desktop cupping form here.
 */
export default function CuppingTrainingPage() {
  redirect("/laboratorio/cupping?mode=training");
}
