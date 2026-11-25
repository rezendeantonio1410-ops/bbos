/** Business days (Mon–Fri) left in the month after today. */
export function businessDaysLeft(today = new Date()) {
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  let days = 0;
  for (let d = today.getDate() + 1; d <= last; d++) {
    const w = new Date(today.getFullYear(), today.getMonth(), d).getDay();
    if (w !== 0 && w !== 6) days++;
  }
  return days;
}

/** Roast pace: how much should be done by today and how much per business day is left. */
export function roastPace(actualKg: number, plannedKg: number, today = new Date()) {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const expectedKg = plannedKg > 0 ? Math.round((plannedKg * today.getDate()) / daysInMonth) : 0;
  const behindKg = Math.max(0, expectedKg - actualKg);
  const missingKg = Math.max(0, plannedKg - actualKg);
  const daysLeft = businessDaysLeft(today);
  const perDayKg = daysLeft > 0 ? Math.ceil(missingKg / daysLeft) : missingKg;
  return { expectedKg, behindKg, missingKg, daysLeft, perDayKg };
}

