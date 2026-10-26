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
import { notifyNewOrder, notifyUser } from "./push";
import { kitchenStatus } from "@/lib/hours";
import { onOrderLive, onSubscriptionActive, onSubscriptionChanged, onSubscriptionCreated, onSubscriptionEndingSoon, onSubscriptionFinished } from "./notifications";

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
  notify?: { whatsapp: boolean };
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
    roundOff: t.roundOff,
    total: t.total,
    paymentMode: input.paymentMode,
    paymentStatus: "pending",
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.notify ? { notify: input.notify } : {}),
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(sub);

  if (input.paymentMode === "online") {
    let rzp;
    try {
      rzp = await createRazorpayOrder(t.total, `SUB-${ref.id.slice(0, 12)}`, { leafliSubscriptionId: ref.id, plan: plan.name });
    } catch (e) {
      await ref.update({ status: "cancelled", notes: `Online payment could not be started: ${(e as Error).message}`.slice(0, 500) });
      throw new HttpError(502, "We couldn't start the online payment. Please try again in a moment.");
    }
    await ref.update({ payment: { provider: "razorpay", rzpOrderId: rzp.id } });
    return { id: ref.id, total: t.total, checkout: { keyId: razorpayKeyId(), rzpOrderId: rzp.id, amount: rzp.amount, currency: rzp.currency } };
  }
  await onSubscriptionCreated(ref.id);
  return { id: ref.id, total: t.total };
}

/** Activate after payment (Razorpay verify/webhook, or a manager confirming cash/UPI). Idempotent. */
export async function activateSubscription(
  subId: string,
  payment: { rzpOrderId: string; paymentId: string; method?: string } | null,
) {
  const ref = subs().doc(subId);
  const r = await ref.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "Subscription not found");
    const s = snap.data() as Subscription;
    if (payment && s.payment?.rzpOrderId !== payment.rzpOrderId) throw new HttpError(400, "Payment does not belong to this subscription");
    if (payment && s.payment?.paymentId === payment.paymentId) return { alreadyActive: true, stray: false };
    // Paid twice, or paid after it was cancelled: the caller refunds this payment.
    if (s.paymentStatus !== "pending" || s.status === "cancelled") return { alreadyActive: true, stray: Boolean(payment) };
    const counter = await nextCounter(tx, `invoice-${financialYear()}`);
    tx.set(counter.ref, { value: counter.value }, { merge: true });
    tx.update(ref, {
      status: s.status === "pending_payment" ? "active" : s.status,
      paymentStatus: "paid",
      invoiceNo: `LF/${financialYear()}/${String(counter.value).padStart(5, "0")}`,
      invoicedAt: Date.now(),
      ...(payment
        ? { "payment.paymentId": payment.paymentId, "payment.paidAt": Date.now(), ...(payment.method ? { "payment.method": payment.method } : {}) }
        : {}),
      updatedAt: Date.now(),
    });
    return { alreadyActive: false, stray: false, customerUid: s.customerUid, planName: s.planName, startDate: s.startDate };
  });
  if (!r.alreadyActive && "customerUid" in r && r.customerUid)
    await notifyUser(r.customerUid, {
      title: `${r.planName} is active 🎉`,
      body: `Your first bowl arrives ${new Date(`${r.startDate}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })}. Pick your bowls anytime.`,
      url: `/account/subscriptions/${subId}`,
      tag: `sub-${subId}`,
    });
  if (!r.alreadyActive) await onSubscriptionActive(subId);
  return { alreadyActive: r.alreadyActive, stray: r.stray };
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
  if (action.type === "pause" || action.type === "cancel") await onSubscriptionChanged(subId, action.type === "pause" ? "paused" : "cancelled");
  if (action.type === "resume") await onSubscriptionChanged(subId, "resumed");
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
      await onSubscriptionFinished(s.id, true);
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
    const left = await doc.ref.firestore.runTransaction(async (tx) => {
      const fresh = (await tx.get(doc.ref)).data() as Subscription;
      if (fresh.fulfilled?.[date]) return null;
      const used = fresh.mealsUsed + 1;
      tx.update(doc.ref, {
        [`fulfilled.${date}`]: order.id,
        mealsUsed: used,
        status: used >= fresh.mealsTotal ? "completed" : fresh.status,
        updatedAt: Date.now(),
      });
      return fresh.mealsTotal - used;
    });
    if (left === 0) await onSubscriptionFinished(s.id, false);
    else if (left === 2) await onSubscriptionEndingSoon(s.id, left);
    if (!order.duplicate) created.push(order.orderNo);
  }
  return { date, created, skipped };
}

/** Most bowls a subscriber can order in one go from their balance. */
export const ORDER_NOW_MAX = 5;

/**
 * "Order now": the subscriber spends bowls from their balance on an immediate delivery
 * (outside their schedule). The bowls are reserved first, so two taps can never spend
 * the same bowl; if the kitchen order can't be created the reservation is given back.
 * `requestId` makes retries safe.
 */
export async function orderNowFromSubscription(
  subId: string,
  picks: { menuItemId: string; qty: number }[],
  requestId: string,
  actor: Actor,
  menu: MenuItem[],
) {
  const ref = subs().doc(subId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Subscription not found");
  const s = { ...(snap.data() as Subscription), id: snap.id };
  if (s.customerUid !== actor.uid) throw new HttpError(403, "Not your subscription");
  const done = s.onDemand?.[requestId];
  if (done && done !== "pending") return { orderId: done, duplicate: true };

  if (s.paymentStatus !== "paid" || (s.status !== "active" && s.status !== "paused"))
    throw new HttpError(409, s.status === "pending_payment" ? "Complete payment for your plan first" : "This plan has no bowls to order from");
  const today = istDate();
  if (today > s.endDate) throw new HttpError(409, "This plan has expired");

  const lines = picks.filter((p) => p.qty > 0);
  const qty = lines.reduce((n, p) => n + p.qty, 0);
  if (!qty) throw new HttpError(400, "Pick at least one bowl");
  if (qty > ORDER_NOW_MAX) throw new HttpError(400, `You can order up to ${ORDER_NOW_MAX} bowls at a time`);
  if (qty > mealsRemaining(s)) throw new HttpError(409, `You have ${mealsRemaining(s)} bowl${mealsRemaining(s) === 1 ? "" : "s"} left in this plan`);

  const kitchen = kitchenStatus(await getSettings());
  if (!kitchen.open) throw new HttpError(409, kitchen.message);

  const planSnap = await plans().doc(s.planId).get();
  const eligible = eligibleDishes(menu, (planSnap.get("eligibleMenuIds") as string[]) ?? [], s.diet);
  for (const l of lines) {
    if (!eligible.some((m) => m.id === l.menuItemId)) throw new HttpError(400, "That bowl isn't part of your plan or is sold out today");
  }

  // 1. Reserve the bowls.
  const prev = await ref.firestore.runTransaction(async (tx) => {
    const fresh = (await tx.get(ref)).data() as Subscription;
    if (fresh.onDemand?.[requestId]) throw new HttpError(409, "This order is already being placed");
    if (fresh.mealsTotal - fresh.mealsUsed < qty) throw new HttpError(409, "Not enough bowls left in this plan");
    const used = fresh.mealsUsed + qty;
    tx.update(ref, {
      mealsUsed: used,
      [`onDemand.${requestId}`]: "pending",
      status: used >= fresh.mealsTotal ? "completed" : fresh.status,
      updatedAt: Date.now(),
    });
    return { status: fresh.status, left: fresh.mealsTotal - used };
  });

  // 2. Send it to the kitchen like any new website order (it rings staff phones).
  let order: Awaited<ReturnType<typeof createOrder>>;
  try {
    order = await createOrder(
      {
        source: "website",
        externalId: `sub-${s.id}-now-${requestId}`,
        customerUid: s.customerUid,
        customer: { name: s.customer.name, phone: s.customer.phone, email: s.customer.email ?? undefined, address: s.address },
        lines: lines.map((l) => ({ menuItemId: l.menuItemId, qty: l.qty, notes: `Subscription · ${s.planName}` })),
        paymentMode: "online",
        paymentStatus: "paid",
        deliveryProvider: "porter",
        notes: `Order now from subscription (${qty} bowl${qty > 1 ? "s" : ""} from balance)${s.notes ? ` — ${s.notes}` : ""}`,
        prepaid: { subscriptionId: s.id, unitPrice: perMeal(s.price, s.mealsTotal) },
      },
      actor,
    );
  } catch (e) {
    // 3. Give the bowls back if the order couldn't be created.
    await ref.firestore.runTransaction(async (tx) => {
      const fresh = (await tx.get(ref)).data() as Subscription;
      if (fresh.onDemand?.[requestId] !== "pending") return;
      const onDemand = { ...fresh.onDemand };
      delete onDemand[requestId];
      tx.update(ref, { mealsUsed: fresh.mealsUsed - qty, onDemand, status: fresh.status === "completed" ? prev.status : fresh.status, updatedAt: Date.now() });
    });
    throw e;
  }
  await ref.update({ [`onDemand.${requestId}`]: order.id });

  if (!order.duplicate) {
    await notifyNewOrder(order);
    await onOrderLive(order.id);
  }
  if (prev.left === 0) await onSubscriptionFinished(s.id, false);
  else if (prev.left <= 2) await onSubscriptionEndingSoon(s.id, prev.left);
  return { orderId: order.id, orderNo: order.orderNo, left: prev.left, duplicate: order.duplicate };
}
