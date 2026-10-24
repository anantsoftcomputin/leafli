import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { round2 } from "@/lib/costing";
import {
  createPaymentLink,
  ensureCaptured,
  fetchOrderPayments,
  refundPayment,
  type RzpPayment,
  type RzpRefund,
} from "@/lib/integrations/razorpay";
import type { Order, Subscription } from "@/lib/types";
import { HttpError, type Actor } from "./http";
import { col } from "./inventory";
import { markOrderPaid } from "./orders";
import { activateSubscription } from "./subscriptions";
import { onPaymentLink, onRefundCompleted, onRefundStarted, onStaffIssue } from "./notifications";

/**
 * Everything that moves money through Razorpay, in one place:
 * settling captured payments (verify route, webhook, reconciliation), refunds,
 * failure tracking and staff-sent payment links.
 */

export type PayTarget = { kind: "order" | "subscription"; id: string };

const subs = () => col.orders().firestore.collection("subscriptions");
const refOf = (t: PayTarget) => (t.kind === "order" ? col.orders().doc(t.id) : subs().doc(t.id));
const notesOf = (p: { notes?: Record<string, string> | unknown[] }) =>
  (Array.isArray(p.notes) ? {} : (p.notes ?? {})) as Record<string, string>;

const log = (event: string, extra: Record<string, unknown>) =>
  col.logs().add({ provider: "razorpay", direction: "in", event, ...extra, at: Date.now() });

/** Work out which order / subscription a Razorpay payment belongs to. */
export async function targetOfPayment(p: Pick<RzpPayment, "order_id" | "notes">): Promise<(PayTarget & { viaLink: boolean }) | null> {
  const n = notesOf(p);
  if (n.leafliSubscriptionId) return { kind: "subscription", id: n.leafliSubscriptionId, viaLink: false };
  if (n.leafliOrderId) return { kind: "order", id: n.leafliOrderId, viaLink: n.via === "payment_link" };
  if (!p.order_id) return null;
  for (const kind of ["order", "subscription"] as const) {
    const c = kind === "order" ? col.orders() : subs();
    const q = await c.where("payment.rzpOrderId", "==", p.order_id).limit(1).get();
    if (!q.empty) return { kind, id: q.docs[0]!.id, viaLink: false };
  }
  return null;
}

/**
 * Record a captured payment against its order / subscription. Money that can't be
 * kept (a second payment, or the order was cancelled meanwhile) is refunded straight away.
 */
export async function settlePayment(p: RzpPayment, t: PayTarget & { viaLink?: boolean }) {
  if (!p.order_id) throw new HttpError(400, "Payment has no Razorpay order");
  const r =
    t.kind === "subscription"
      ? await activateSubscription(t.id, { rzpOrderId: p.order_id, paymentId: p.id, method: p.method })
      : await markOrderPaid(t.id, p.order_id, p.id, { method: p.method, viaLink: t.viaLink });
  if (r.stray && p.status === "captured" && (p.amount_refunded ?? 0) < p.amount) {
    // Notes deliberately omit leafliOrderId so the refund webhook doesn't touch the kept payment.
    const refund = await refundPayment(p.id, (p.amount - (p.amount_refunded ?? 0)) / 100, {
      reason: "Duplicate payment or already cancelled",
      [t.kind === "order" ? "strayForOrder" : "strayForSubscription"]: t.id,
    });
    await log("auto_refund", { [t.kind === "order" ? "orderId" : "subscriptionId"]: t.id, paymentId: p.id, refundId: refund.id });
    return { ...r, refunded: true };
  }
  return { ...r, refunded: false };
}

/** Browser handed us a signed Checkout result: make sure it's captured, then settle it. */
export async function confirmCheckout(t: PayTarget, rzpOrderId: string, paymentId: string) {
  const p = await ensureCaptured(paymentId);
  if (!p) throw new HttpError(402, "The payment didn't go through. Please try again.");
  if (p.order_id !== rzpOrderId) throw new HttpError(400, "Payment does not belong to this order");
  return settlePayment(p, t);
}

/**
 * Ask Razorpay directly whether a pending order / subscription has been paid.
 * Covers a closed tab plus a missed webhook. Also records the latest failure reason.
 */
export async function reconcile(t: PayTarget) {
  const snap = await refOf(t).get();
  if (!snap.exists) throw new HttpError(404, t.kind === "order" ? "Order not found" : "Subscription not found");
  const doc = snap.data() as Order | Subscription;
  if (doc.paymentStatus !== "pending") return { paymentStatus: doc.paymentStatus, changed: false };
  const rzpOrderIds = [doc.payment?.rzpOrderId].filter(Boolean) as string[];
  if (!rzpOrderIds.length) return { paymentStatus: doc.paymentStatus, changed: false };

  const attempts = (await Promise.all(rzpOrderIds.map(fetchOrderPayments))).flat();
  for (const a of attempts.filter((x) => x.status === "captured" || x.status === "authorized")) {
    const p = await ensureCaptured(a.id);
    if (p) {
      const r = await settlePayment(p, t);
      if (r.stray) return { paymentStatus: doc.paymentStatus, changed: false, refunded: r.refunded };
      return { paymentStatus: "paid" as const, changed: true };
    }
  }
  const failed = attempts.filter((x) => x.status === "failed").sort((a, b) => b.created_at - a.created_at)[0];
  if (failed) await recordFailure(t, failed);
  return { paymentStatus: doc.paymentStatus, changed: false, lastError: failed?.error_description ?? null };
}

/** payment.failed — remember why, so the order page can say more than "pending". */
export async function recordFailure(t: PayTarget, p: Pick<RzpPayment, "error_description" | "error_reason" | "created_at">) {
  const at = p.created_at ? p.created_at * 1000 : Date.now();
  await refOf(t).firestore.runTransaction(async (tx) => {
    const snap = await tx.get(refOf(t));
    if (!snap.exists) return;
    const d = snap.data() as Order | Subscription;
    if (d.paymentStatus !== "pending" || (d.payment?.lastErrorAt ?? 0) >= at) return;
    tx.update(refOf(t), {
      "payment.lastError": p.error_description || p.error_reason || "Payment failed",
      "payment.lastErrorAt": at,
    });
  });
}

/**
 * Refund all or part of an online payment (manager action). Subscriptions are
 * cancelled when fully refunded; orders keep their kitchen status (cancel the order
 * separately if needed — cancelling also refunds automatically).
 */
export async function refund(t: PayTarget, amount: number | null, reason: string, actor: Actor) {
  const ref = refOf(t);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Not found");
  const doc = snap.data() as (Order | Subscription) & { orderNo?: string; planName?: string };
  const pay = doc.payment;
  if (!pay?.paymentId) throw new HttpError(409, "There is no online payment to refund");
  if (pay.refundStatus === "pending") throw new HttpError(409, "A refund is already in progress — wait for Razorpay to process it");
  const already = pay.refundedAmount ?? 0;
  const left = round2(doc.total - already);
  const amt = round2(amount ?? left);
  if (!(amt > 0)) throw new HttpError(400, "Enter an amount to refund");
  if (amt > left) throw new HttpError(400, `Only ₹${left} is left to refund`);

  let r: RzpRefund;
  try {
    r = await refundPayment(pay.paymentId, amt, {
      [t.kind === "order" ? "leafliOrderId" : "leafliSubscriptionId"]: t.id,
      reason: reason.slice(0, 200),
      by: actor.name.slice(0, 60),
    });
  } catch (e) {
    await ref.update({ "payment.refundError": (e as Error).message });
    throw new HttpError(502, (e as Error).message);
  }
  const total = round2(already + amt);
  const full = total >= doc.total;
  await ref.update({
    "payment.refundId": r.id,
    "payment.refundStatus": r.status === "processed" ? "processed" : "pending",
    "payment.refundedAmount": total,
    "payment.refundError": FieldValue.delete(),
    ...(full ? { paymentStatus: "refunded" } : {}),
    ...(full && t.kind === "subscription" && (doc as Subscription).status !== "completed" ? { status: "cancelled" } : {}),
    updatedAt: Date.now(),
  });
  await col.logs().add({
    provider: "razorpay",
    direction: "out",
    event: "refund",
    [t.kind === "order" ? "orderId" : "subscriptionId"]: t.id,
    amount: amt,
    reason,
    by: actor.uid,
    at: Date.now(),
  });
  await onRefundStarted(t, { refundId: r.id, amount: amt, full, reason });
  return { refundId: r.id, amount: amt, refundedAmount: total, full };
}

/** refund.processed / refund.failed webhooks. */
export async function applyRefundEvent(r: RzpRefund, event: "refund.processed" | "refund.failed") {
  const n = notesOf(r);
  const t: PayTarget | null = n.leafliSubscriptionId
    ? { kind: "subscription", id: n.leafliSubscriptionId }
    : n.leafliOrderId
      ? { kind: "order", id: n.leafliOrderId }
      : await targetOfRefund(r.payment_id);
  if (!t) return { ignored: "unknown refund" };
  const ref = refOf(t);
  const snap = await ref.get();
  if (!snap.exists) return { ignored: "unknown refund" };
  const pay = (snap.data() as Order | Subscription).payment;
  // Only the latest refund drives the badge; older ones are history in the Razorpay dashboard.
  if (pay?.refundId && pay.refundId !== r.id) return { ignored: "older refund" };
  if (event === "refund.processed") await onRefundCompleted(t, { refundId: r.id, amount: r.amount / 100 });
  else
    await onStaffIssue({
      key: `refund-failed-${r.id}`,
      title: "A Razorpay refund failed",
      detail: `Refund ${r.id} of ₹${r.amount / 100} failed. Retry it from the ${t.kind} page or refund from the Razorpay dashboard.`,
      url: t.kind === "order" ? `/admin/orders/${t.id}` : "/admin/subscriptions",
    });
  await ref.update(
    event === "refund.processed"
      ? { "payment.refundStatus": "processed" }
      : { "payment.refundStatus": "failed", "payment.refundError": "Razorpay could not process the refund — retry or refund from the dashboard" },
  );
  return { ok: true };
}

async function targetOfRefund(paymentId: string): Promise<PayTarget | null> {
  for (const kind of ["order", "subscription"] as const) {
    const c = kind === "order" ? col.orders() : subs();
    const q = await c.where("payment.paymentId", "==", paymentId).limit(1).get();
    if (!q.empty) return { kind, id: q.docs[0]!.id };
  }
  return null;
}

/** Staff send a Razorpay payment link (SMS / email) for an unpaid pay-later or phone order. */
export async function sendPaymentLink(orderId: string, actor: Actor, siteUrl: string) {
  const ref = col.orders().doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Order not found");
  const o = { ...(snap.data() as Order), id: orderId };
  if (o.paymentStatus !== "pending") throw new HttpError(409, "This order is already settled");
  if (o.status === "cancelled") throw new HttpError(409, "This order is cancelled");
  if (o.paymentMode === "online" && o.payment?.rzpOrderId)
    throw new HttpError(409, "The customer is paying online through checkout already");
  if (o.paymentLink) return { url: o.paymentLink.url, reused: true };
  const contact = o.customer.phone?.replace(/\D/g, "").slice(-10);
  if (!contact && !o.customer.email) throw new HttpError(400, "Add the customer's phone or email first");
  const link = await createPaymentLink({
    amountRupees: o.total,
    description: `Leafli order ${o.orderNo}`,
    customer: { name: o.customer.name, contact: contact ? `+91${contact}` : undefined, email: o.customer.email || undefined },
    notes: { leafliOrderId: orderId, orderNo: o.orderNo, via: "payment_link" },
    callbackUrl: o.customerUid ? `${siteUrl}/account/orders/${orderId}` : undefined,
    expireBy: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  });
  await ref.update({ paymentLink: { id: link.id, url: link.short_url, createdAt: Date.now(), by: actor.uid }, updatedAt: Date.now() });
  await onPaymentLink(orderId, link.short_url);
  return { url: link.short_url, reused: false };
}
