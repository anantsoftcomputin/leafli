// Pure subscription scheduling — shared by the server, the admin and the customer pages.
// Dates are "YYYY-MM-DD" strings in India time, so there are no timezone surprises.
import type { DietPref, MenuItem, Subscription, SubscriptionStatus } from "./types";

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const SLOT_LABEL = { lunch: "Lunch · 12–2 pm", dinner: "Dinner · 7–9 pm" } as const;

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);

export const mealsRemaining = (s: Pick<Subscription, "mealsTotal" | "mealsUsed">) => Math.max(0, s.mealsTotal - s.mealsUsed);

type Sched = Pick<
  Subscription,
  "startDate" | "endDate" | "deliveryDays" | "skipped" | "fulfilled" | "status" | "pausedFrom" | "mealsTotal" | "mealsUsed"
>;

/** Is `date` a delivery day for this subscription (ignoring credits)? */
export function isDeliveryDay(s: Sched, date: string) {
  if (date < s.startDate || date > s.endDate) return false;
  if (!s.deliveryDays.includes(weekday(date))) return false;
  if (s.skipped.includes(date)) return false;
  if (s.status === "paused" && s.pausedFrom && date >= s.pausedFrom) return false;
  return true;
}

/** Upcoming delivery dates from `from` (inclusive), limited by remaining meals and validity. */
export function upcomingDates(s: Sched, from: string, max = 60): string[] {
  if (s.status !== "active" && s.status !== "paused") return [];
  let left = mealsRemaining(s);
  const out: string[] = [];
  let d = from < s.startDate ? s.startDate : from;
  while (left > 0 && d <= s.endDate && out.length < max) {
    if (!s.fulfilled[d] && isDeliveryDay(s, d)) {
      out.push(d);
      left--;
    }
    d = addDays(d, 1);
  }
  return out;
}

/** Should the kitchen prepare a meal for this subscription on `date`? */
export const isDue = (s: Sched, date: string) => s.status === "active" && !s.fulfilled[date] && mealsRemaining(s) > 0 && isDeliveryDay(s, date);

export function dietAllows(pref: DietPref, dish: MenuItem["diet"]) {
  if (pref === "nonveg") return true;
  if (pref === "egg") return dish !== "nonveg";
  return dish === "veg";
}

/** Dishes this subscription can receive, in a stable order. */
export function eligibleDishes(menu: MenuItem[], eligibleIds: string[], diet: DietPref) {
  return menu
    .filter((m) => m.available && m.channels?.website !== false)
    .filter((m) => (eligibleIds.length ? eligibleIds.includes(m.id) : m.category !== "Fruit & Dessert Bowls" && m.category !== "Desserts"))
    .filter((m) => dietAllows(diet, m.diet))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * The bowl for a date: the customer's pick if it's still valid, otherwise the
 * chef's rotation (cycles through eligible dishes so consecutive days differ).
 */
export function dishFor(
  s: Pick<Subscription, "selections" | "startDate" | "diet">,
  date: string,
  eligible: MenuItem[],
): MenuItem | null {
  if (!eligible.length) return null;
  const chosen = eligible.find((m) => m.id === s.selections[date]);
  if (chosen) return chosen;
  const idx = ((daysBetween(s.startDate, date) % eligible.length) + eligible.length) % eligible.length;
  return eligible[idx]!;
}

/** Customers can change a day's bowl, or skip it, until 9 pm IST the day before. */
export function canChange(date: string, now = new Date()) {
  const cutoff = new Date(`${addDays(date, -1)}T21:00:00+05:30`).getTime();
  return now.getTime() < cutoff;
}

/** Can the subscriber spend bowls on an immediate "order now" delivery? */
export const canOrderNow = (s: Pick<Subscription, "status" | "paymentStatus" | "endDate" | "mealsTotal" | "mealsUsed">, today = istToday()) =>
  (s.status === "active" || s.status === "paused") && s.paymentStatus === "paid" && mealsRemaining(s) > 0 && today <= s.endDate;
const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

export const perMeal = (price: number, meals: number) => Math.round(price / Math.max(meals, 1));
export const savingsPct = (price: number, compareAt: number) => (compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0);

export const SUB_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  pending_payment: "Awaiting payment",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};
