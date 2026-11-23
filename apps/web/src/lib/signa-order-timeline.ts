/** Events are scoped to the selected order; never show another order's history. */
export type SignaOrderTimelineEvent = {
  orderId: string;
  occurredAt: string;
};

export function getSignaOrderTimelineEvents<T extends SignaOrderTimelineEvent>(
  events: readonly T[],
  orderId: string | null,
): T[] {
  if (!orderId) return [];
  return events
    .filter((event) => event.orderId === orderId)
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
}
