/**
 * Preview/test API instances that share a database with production must not
 * run the in-process reconciliation timers (payments, shipments, packaging).
 * Default (variable absent) keeps the current behavior: timers enabled.
 */
export function scheduledJobsDisabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.BBOS_SCHEDULED_JOBS_DISABLED?.trim().toLowerCase() === "true";
}
