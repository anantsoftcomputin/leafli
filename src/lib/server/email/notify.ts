import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { Order, Subscription } from "@/lib/types";
import { getSettings } from "../orders";
import type { Brand } from "./layout";
import { sendEmail, staffAlertEmails } from "./send";
import * as T from "./templates";

/**
 * Which email goes out when. Every function here is safe to call from business
 * code: it never throws and each send is de-duplicated by a stable key.
 */

let brandCache: { at: number; brand: Brand } | null = null;
export async function brand(): Promise<Brand> {
  if (brandCache && Date.now() - brandCache.at < 60_000) return brandCache.brand;
  const s = await getSettings();
  const a = s.address;
  const b: Brand = {
    name: s.name || "Leafli",
    phone: s.phone || undefined,
    email: s.email || process.env.SMTP_USER || undefined,
    address: [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ") || undefined,
    gstin: s.gstin || undefined,
  };
  brandCache = { at: Date.now(), brand: b };
  return b;
}

const safe =
  <A extends unknown[]>(fn: (...a: A) => Promise<unknown>) =>
  async (...a: A) => {
    try {
      await fn(...a);
    } catch (e) {
      console.error("email notify failed", e);
    }
  };

async function emailFor(doc: { customer?: { email?: string | null }; customerUid?: string | null }) {
  if (doc.customer?.email) return doc.customer.email;
  if (!doc.customerUid) return null;
  const u = await adminDb.collection("users").doc(doc.customerUid).get();
  return ((u.get("email") || u.get("contactEmail")) as string | undefined) ?? null;
}

async function freshOrder(id: string) {
  const s = await adminDb.collection("orders").doc(id).get();
  return s.exists ? ({ ...(s.data() as Omit<Order, "id">), id } as Order & { cancelReason?: string }) : null;
}

async function freshSub(id: string) {
  const s = await adminDb.collection("subscriptions").doc(id).get();
  return s.exists ? ({ ...(s.data() as Omit<Subscription, "id">), id } as Subscription) : null;
}

async function dishImages(ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return {};
  const snaps = await adminDb.getAll(...unique.map((id) => adminDb.collection("menuItems").doc(id)));
  return Object.fromEntries(snaps.map((s) => [s.id, (s.get("imageUrl") as string | null) ?? null]));
}

// ── accounts ────────────────────────────────────────────

export const emailWelcome = safe(async (u: { uid: string; name?: string; email?: string | null }) => {
  if (!u.email) return;
  await sendEmail({ to: u.email, ...T.welcome(await brand(), { name: u.name }), kind: "welcome", key: `welcome-${u.uid}`, ref: u.uid });
});

// ── orders ──────────────────────────────────────────────

/** The order is live for the kitchen: receipt to the customer, alert to the team. */
export const emailOrderLive = safe(async (orderId: string) => {
  const o = await freshOrder(orderId);
  if (!o) return;
  const b = await brand();
  const to = await emailFor(o);
  if (to) await sendEmail({ to, ...T.orderReceived(b, o, await dishImages(o.lines.map((l) => l.menuItemId))), kind: "order_received", key: `order-received-${o.id}`, ref: o.id });
  if (o.source !== "pos" && !o.subscriptionId)
    await sendEmail({ to: staffAlertEmails(), ...T.staffNewOrder(b, o), kind: "staff_new_order", key: `staff-order-${o.id}`, ref: o.id });
});

export const emailOrderStatus = safe(async (orderId: string, status: string) => {
  if (!["ready", "dispatched", "delivered", "cancelled"].includes(status)) return;
  const o = await freshOrder(orderId);
  if (!o || o.source === "zomato" || o.subscriptionId) return; // Zomato customers are Zomato's; plan meals would be daily noise
  const pickup = o.delivery?.provider === "pickup";
  if (status === "ready" && !pickup) return;
  if (status === "dispatched" && pickup) return;
  // An online order that was never paid never went live — no cancellation email.
  if (status === "cancelled" && o.paymentMode === "online" && !o.payment?.paymentId) return;
  const to = await emailFor(o);
  if (!to) return;
  const b = await brand();
  const settings = await getSettings();
  const e =
    status === "ready"
      ? T.orderReadyForPickup(b, o)
      : status === "dispatched"
        ? T.orderOnTheWay(b, o)
        : status === "delivered"
          ? T.orderDelivered(b, o, settings.googleReviewUrl)
          : T.orderCancelled(b, o);
  await sendEmail({ to, ...e, kind: `order_${status}`, key: `order-${o.id}-${status}`, ref: o.id });
});

export const emailPaymentLink = safe(async (orderId: string, url: string) => {
  const o = await freshOrder(orderId);
  if (!o) return;
  const to = await emailFor(o);
  if (to) await sendEmail({ to, ...T.paymentLink(await brand(), o, url), kind: "payment_link", key: `paylink-${o.id}-${url}`, ref: o.id });
});

// ── refunds ─────────────────────────────────────────────

type Target = { kind: "order" | "subscription"; id: string };

async function refundContext(t: Target) {
  if (t.kind === "order") {
    const o = await freshOrder(t.id);
    return o && { doc: o, what: `order ${o.orderNo}`, url: `/account/orders/${o.id}`, name: o.customer.name };
  }
  const s = await freshSub(t.id);
  return s && { doc: s, what: s.planName, url: `/account/subscriptions/${s.id}`, name: s.customer.name };
}

export const emailRefundStarted = safe(async (t: Target, a: { refundId: string; amount: number; full: boolean; reason?: string }) => {
  const c = await refundContext(t);
  if (!c) return;
  const to = await emailFor(c.doc);
  if (!to) return;
  await sendEmail({ to, ...T.refundStarted(await brand(), { name: c.name, what: c.what, url: c.url, ...a }), kind: "refund_started", key: `refund-started-${a.refundId}`, ref: t.id });
});

export const emailRefundCompleted = safe(async (t: Target, a: { refundId: string; amount: number }) => {
  const c = await refundContext(t);
  if (!c) return;
  const to = await emailFor(c.doc);
  if (!to) return;
  await sendEmail({ to, ...T.refundCompleted(await brand(), { name: c.name, what: c.what, url: c.url, amount: a.amount }), kind: "refund_completed", key: `refund-done-${a.refundId}`, ref: t.id });
});

export const emailStaffIssue = safe(async (a: { key: string; title: string; detail: string; url: string }) => {
  await sendEmail({ to: staffAlertEmails(), ...T.staffPaymentIssue(await brand(), a), kind: "staff_issue", key: `issue-${a.key}`, ref: a.url });
});

// ── subscriptions ───────────────────────────────────────

export const emailSubscriptionCreated = safe(async (subId: string) => {
  const s = await freshSub(subId);
  if (!s) return;
  const b = await brand();
  // Online buyers are mid-checkout; they get the "active" email once paid.
  if (s.paymentMode === "offline") {
    const to = await emailFor(s);
    if (to) await sendEmail({ to, ...T.subscriptionAwaitingPayment(b, s), kind: "subscription_pending", key: `sub-pending-${s.id}`, ref: s.id });
    await sendEmail({ to: staffAlertEmails(), ...T.staffNewSubscription(b, s), kind: "staff_new_subscription", key: `staff-sub-${s.id}`, ref: s.id });
  }
});

export const emailSubscriptionActive = safe(async (subId: string) => {
  const s = await freshSub(subId);
  if (!s) return;
  const b = await brand();
  const to = await emailFor(s);
  if (to) await sendEmail({ to, ...T.subscriptionActive(b, s), kind: "subscription_active", key: `sub-active-${s.id}`, ref: s.id });
  if (s.paymentMode === "online")
    await sendEmail({ to: staffAlertEmails(), ...T.staffNewSubscription(b, s), kind: "staff_new_subscription", key: `staff-sub-${s.id}`, ref: s.id });
});

export const emailSubscriptionChanged = safe(async (subId: string, change: "paused" | "resumed" | "cancelled") => {
  const s = await freshSub(subId);
  if (!s) return;
  const to = await emailFor(s);
  if (!to) return;
  await sendEmail({ to, ...T.subscriptionChanged(await brand(), s, change), kind: `subscription_${change}`, key: `sub-${s.id}-${change}-${s.updatedAt}`, ref: s.id });
});

export const emailSubscriptionEndingSoon = safe(async (subId: string, left: number) => {
  const s = await freshSub(subId);
  if (!s) return;
  const to = await emailFor(s);
  if (to) await sendEmail({ to, ...T.subscriptionEndingSoon(await brand(), s, left), kind: "subscription_ending", key: `sub-ending-${s.id}`, ref: s.id });
});

export const emailSubscriptionFinished = safe(async (subId: string, expired: boolean) => {
  const s = await freshSub(subId);
  if (!s) return;
  const to = await emailFor(s);
  if (to) await sendEmail({ to, ...T.subscriptionCompleted(await brand(), s, expired), kind: expired ? "subscription_expired" : "subscription_completed", key: `sub-finished-${s.id}`, ref: s.id });
});
