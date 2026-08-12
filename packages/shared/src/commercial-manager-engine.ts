export type CommercialRepresentativeStatus =
  | "ABOVE_TARGET"
  | "ON_TRACK"
  | "ATTENTION"
  | "CRITICAL";

export type CommercialPeriod = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  elapsedRatio: number;
};

const DAY = 86_400_000;

const businessDays = (start: Date, end: Date) => {
  let total = 0;
  for (let time = start.getTime(); time <= end.getTime(); time += DAY) {
    const day = new Date(time).getDay();
    if (day !== 0 && day !== 6) total += 1;
  }
  return total;
};

export function commercialPeriod(now = new Date()): CommercialPeriod {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const elapsedEnd = now < end ? now : end;
  const totalDays = businessDays(start, end);
  const elapsedDays = businessDays(start, elapsedEnd);
  return {
    start,
    end,
    previousStart,
    previousEnd,
    elapsedRatio: totalDays ? Math.min(1, elapsedDays / totalDays) : 0,
  };
}

export function weightedPipeline(
  opportunities: Array<{ estimatedValue: number; probability: number }>,
) {
  return opportunities.reduce(
    (total, item) => total + item.estimatedValue * (item.probability / 100),
    0,
  );
}

export function representativeStatus(input: {
  revenue: number;
  target: number;
  weightedPipeline: number;
  elapsedRatio: number;
}): CommercialRepresentativeStatus {
  if (input.target <= 0) return "ON_TRACK";
  const achievement = input.revenue / input.target;
  const projection = (input.revenue + input.weightedPipeline) / input.target;
  if (achievement >= 1) return "ABOVE_TARGET";
  if (projection >= 1 && achievement >= input.elapsedRatio * 0.8) return "ON_TRACK";
  if (
    input.elapsedRatio >= 0.5 &&
    projection < 0.65 &&
    achievement < input.elapsedRatio * 0.6
  )
    return "CRITICAL";
  return "ATTENTION";
}

export function percentChange(current: number, previous: number) {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

export function isInactiveCustomer(lastPurchase: Date | null, now = new Date()) {
  return lastPurchase == null || now.getTime() - lastPurchase.getTime() > 60 * DAY;
}

export function isOrderAttention(
  expectedDeliveryDate: Date | null,
  status: string,
  now = new Date(),
) {
  return expectedDeliveryDate != null && expectedDeliveryDate < now && status !== "DELIVERED" && status !== "CANCELLED";
}

export function prioritizeCommercialAttention<
  T extends { priority: "CRITICAL" | "HIGH" | "NORMAL" | "OPPORTUNITY" },
>(items: T[], limit = 6) {
  const priority = { CRITICAL: 0, HIGH: 1, NORMAL: 2, OPPORTUNITY: 3 };
  return [...items].sort((a, b) => priority[a.priority] - priority[b.priority]).slice(0, limit);
}
