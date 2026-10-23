import "server-only";
import { subscriptionTotals } from "@/lib/billing";
import { createRazorpayOrder, razorpayConfigured, razorpayKeyId } from "@/lib/integrations/razorpay";
import { istDate } from "@/lib/site";
import {
  addDays,
  canChange,
  daysBetween,
  dishFor,
  eligibleDishes,
  isDue,
  mealsRemaining,
  perMeal,
} from "@/lib/subscriptions";
import type { Address, DietPref, MenuItem, Plan, Subscription } from "@/lib/types";
import { HttpError, type Actor } from "./http";
import { col, financialYear, nextCounter } from "./inventory";
import { createOrder, getSettings } from "./orders";
import { notifyUser } from "./push";

const subs = () => col.orders().firestore.collection("subscriptions");
const plans = () => col.orders().firestore.collection("plans");

export interface NewSubscriptionInput {
  planId: string;
  startDate: string;
  deliveryDays: number[];
  slot: "lunch" | "dinner";
  diet: DietPref;
  address: Address;
  customer: { name: string; phone: string };
  paymentMode: "online" | "offline";
  notes?: string;
}

export async function createSubscription(input: NewSubscriptionInput, actor: Actor & { email?: string | null }) {
  const planSnap = await plans().doc(input.planId).get();
  if (!planSnap.exists || !planSnap.get("active")) throw new HttpError(404, "This plan isn't available");
  const plan = { ...(planSnap.data() as Plan), id: planSnap.id };

  const today = istDate();
  if (input.startDate <= today) throw new HttpError(400, "Start date must be tomorrow or later");
  if (input.startDate > addDays(today, 30)) throw new HttpError(400, "Start within the next 30 days");
  const days = [...new Set(input.deliveryDays)].filter((d) => d >= 0 && d <= 6).sort();
  if (!days.length) throw new HttpError(400, "Choose at least one delivery day");
  if (input.address.lat == null || input.address.lng == null)
    throw new HttpError(400, "Share your location so our riders can find you");
  if (input.paymentMode === "online" && !razorpayConfigured())
    throw new HttpError(503, "Online payment isn't available right now — choose pay on first delivery");

  const settings = await getSettings();
  const t = subscriptionTotals(plan.price, settings.gstRate);
  const now = Date.now();
  const ref = subs().doc();
  const sub: Omit<Subscription, "id"> = {
    planId: plan.id,
    planName: plan.name,
    customerUid: actor.uid,
    customer: { name: input.customer.name, phone: input.customer.phone, email: actor.email ?? null },
    address: input.address,
    slot: input.slot,
    deliveryDays: days,
    diet: input.diet,
    startDate: input.startDate,
    endDate: addDays(input.startDate, plan.validityDays - 1),
    mealsTotal: plan.meals,
    mealsUsed: 0,
    selections: {},
    skipped: [],
    fulfilled: {},
    status: "pending_payment",
    pausedFrom: null,
    price: plan.price,
    taxableValue: t.taxableValue,
    cgst: t.cgst,
    sgst: t.sgst,
    total: t.total,
    paymentMode: input.paymentMode,
    paymentStatus: "pending",
    ...(input.notes ? { notes: input.notes } : {}),
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(sub);

  if (input.paymentMode === "online") {
    const rzp = await createRazorpayOrder(t.total, `SUB-${ref.id.slice(0, 12)}`, { leafliSubscriptionId: ref.id, plan: plan.name });
    await ref.update({ payment: { provider: "razorpay", rzpOrderId: rzp.id } });
    return { id: ref.id, total: t.total, checkout: { keyId: razorpayKeyId(), rzpOrderId: rzp.id, amount: rzp.amount, currency: rzp.currency } };
  }
  return { id: ref.id, total: t.total };
}

/** Activate after payment (Razorpay verify/webhook, or a manager confirming cash/UPI). Idempotent. */
export async function activateSubscription(subId: string, payment: { rzpOrderId: string; paymentId: string } | null) {
  const ref = subs().doc(subId);
  const r = await ref.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "Subscription not found");
    const s = snap.data() as Subscription;
    if (payment && s.payment?.rzpOrderId !== payment.rzpOrderId) throw new HttpError(400, "Payment does not belong to this subscription");
    if (s.paymentStatus === "paid") return { alreadyActive: true };
    const counter = await nextCounter(tx, `invoice-${financialYear()}`);
    tx.set(counter.ref, { value: counter.value }, { merge: true });
    tx.update(ref, {
      status: s.status === "pending_payment" ? "active" : s.status,
      paymentStatus: "paid",
      invoiceNo: `LF/${financialYear()}/${String(counter.value).padStart(5, "0")}`,
      ...(payment ? { "payment.paymentId": payment.paymentId, "payment.paidAt": Date.now() } : {}),
      updatedAt: Date.now(),
    });
    return { alreadyActive: false, customerUid: s.customerUid, planName: s.planName, startDate: s.startDate };
  });
  if (!r.alreadyActive && "customerUid" in r && r.customerUid)
    await notifyUser(r.customerUid, {
      title: `${r.planName} is active 🎉`,
      body: `Your first bowl arrives ${new Date(`${r.startDate}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })}. Pick your bowls anytime.`,
      url: `/account/subscriptions/${subId}`,
      tag: `sub-${subId}`,
    });
  return { alreadyActive: r.alreadyActive };
}

export type CustomerAction =
  | { type: "pause" }
  | { type: "resume" }
  | { type: "skip"; date: string }
  | { type: "unskip"; date: string }
  | { type: "choose"; date: string; menuItemId: string | null }
  | { type: "cancel" };

/** Customer self-service (and staff acting on their behalf). */
export async function updateSubscription(subId: string, action: CustomerAction, actor: Actor, isStaff: boolean, menu: MenuItem[]) {
  const ref = subs().doc(subId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Subscription not found");
  const s = { ...(snap.data() as Subscription), id: snap.id };
  if (s.customerUid !== actor.uid && !isStaff) throw new HttpError(403, "Not your subscription");
  const today = istDate();
  const firstChangeable = canChange(addDays(today, 1)) ? addDays(today, 1) : addDays(today, 2);
  const patch: Record<string, unknown> = { updatedAt: Date.now() };

  switch (action.type) {
    case "pause":
      if (s.status !== "active") throw new HttpError(409, "Only an active plan can be paused");
      Object.assign(patch, { status: "paused", pausedFrom: firstChangeable < s.startDate ? s.startDate : firstChangeable });
      break;
    case "resume": {
      if (s.status !== "paused") throw new HttpError(409, "This plan isn't paused");
      // Give back the paused days so the customer doesn't lose validity.
      const lost = Math.max(0, daysBetween(s.pausedFrom ?? today, firstChangeable));
      Object.assign(patch, { status: "active", pausedFrom: null, endDate: addDays(s.endDate, Math.min(lost, 30)) });
      break;
    }
    case "skip":
    case "unskip":
      if (!isStaff && !canChange(action.date)) throw new HttpError(409, "Changes for that day closed at 9 pm the day before");
      if (action.date < s.startDate || action.date > s.endDate) throw new HttpError(400, "That date is outside your plan");
      patch.skipped = action.type === "skip" ? [...new Set([...s.skipped, action.date])] : s.skipped.filter((d) => d !== action.date);
      break;
    case "choose": {
      if (!isStaff && !canChange(action.date)) throw new HttpError(409, "Changes for that day closed at 9 pm the day before");
      const planSnap = await plans().doc(s.planId).get();
      const eligible = eligibleDishes(menu, (planSnap.get("eligibleMenuIds") as string[]) ?? [], s.diet);
      if (action.menuItemId && !eligible.some((m) => m.id === action.menuItemId)) throw new HttpError(400, "That bowl isn't part of your plan");
      const selections = { ...s.selections };
      if (action.menuItemId) selections[action.date] = action.menuItemId;
      else delete selections[action.date];
      patch.selections = selections;
      break;
    }
    case "cancel":
      if (s.status !== "pending_payment" && !isStaff) throw new HttpError(409, "To cancel an active plan, please contact us — we'll refund unused bowls");
      Object.assign(patch, { status: "cancelled" });
      break;
  }
  await ref.update(patch);
  return { ok: true };
}

/**
 * Create today's (or any date's) kitchen orders from active subscriptions.
 * Safe to run repeatedly: each subscription/date pair produces exactly one order.
 */
export async function generateSubscriptionOrders(date: string, actor: Actor, menu: MenuItem[]) {
  const [snap, planSnap] = await Promise.all([subs().where("status", "in", ["active", "paused"]).get(), plans().get()]);
  const planMap = new Map(planSnap.docs.map((d) => [d.id, { ...(d.data() as Plan), id: d.id }]));
  const created: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const doc of snap.docs) {
    const s = { ...(doc.data() as Subscription), id: doc.id };
    if (s.endDate < date && mealsRemaining(s) > 0 && s.status === "active") {
      await doc.ref.update({ status: "expired", updatedAt: Date.now() });
      continue;
    }
    if (!isDue(s, date)) continue;
    const plan = planMap.get(s.planId);
    const dish = dishFor(s, date, eligibleDishes(menu, plan?.eligibleMenuIds ?? [], s.diet));
    if (!dish) {
      skipped.push({ id: s.id, reason: "No eligible bowl available" });
      continue;
    }
    const order = await createOrder(
      {
        source: "website",
        externalId: `sub-${s.id}-${date}`,
        customerUid: s.customerUid,
        customer: { name: s.customer.name, phone: s.customer.phone, email: s.customer.email ?? undefined, address: s.address },
        lines: [{ menuItemId: dish.id, qty: 1, notes: `Subscription · ${s.planName}` }],
        paymentMode: "online",
        paymentStatus: "paid",
        deliveryProvider: "porter",
        notes: `${s.slot === "lunch" ? "Lunch" : "Dinner"} subscription delivery${s.notes ? ` — ${s.notes}` : ""}`,
        autoAccept: true,
        prepaid: { subscriptionId: s.id, unitPrice: perMeal(s.price, s.mealsTotal) },
      },
      actor,
    );
    await doc.ref.firestore.runTransaction(async (tx) => {
      const fresh = (await tx.get(doc.ref)).data() as Subscription;
      if (fresh.fulfilled?.[date]) return;
      const used = fresh.mealsUsed + 1;
      tx.update(doc.ref, {
        [`fulfilled.${date}`]: order.id,
        mealsUsed: used,
        status: used >= fresh.mealsTotal ? "completed" : fresh.status,
        updatedAt: Date.now(),
      });
    });
    if (!order.duplicate) created.push(order.orderNo);
  }
  return { date, created, skipped };
}
