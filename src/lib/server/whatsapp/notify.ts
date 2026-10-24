import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { sendTemplate, waNumber, whatsappConfigured, type TemplateSend } from "@/lib/integrations/whatsapp";
import type { Order, Subscription } from "@/lib/types";
import { WA_TEMPLATES, type WaTemplateKey } from "./templates";

/**
 * WhatsApp counterpart of email/notify.ts. Customers get messages only if they ticked
 * "updates on WhatsApp" (order/plan `notify.whatsapp`) and never replied STOP.
 * Never throws; each send is logged in `whatsappLog` and de-duplicated by key.
 */
export const staffWhatsApp = () =>
  (process.env.STAFF_WHATSAPP_NUMBERS || "").split(",").map((s) => waNumber(s)).filter((s): s is string => !!s);

const log = () => adminDb.collection("whatsappLog");
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const first = (n?: string) => (n || "there").trim().split(/\s+/)[0]!;
const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export async function sendWhatsApp(
  to: string | null,
  key: WaTemplateKey,
  params: Omit<TemplateSend, "name">,
  meta: { dedupe?: string; ref?: string },
): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  if (!to) return { sent: false, skipped: "no number" };
  if (!whatsappConfigured()) return { sent: false, skipped: "whatsapp not configured" };
  if (await optedOut(to)) return { sent: false, skipped: "opted out" };
  const t = WA_TEMPLATES[key];
  const ref = meta.dedupe ? log().doc(`${meta.dedupe}-${to}`.replace(/[^\w-]/g, "_").slice(0, 400)) : log().doc();
  const entry = { template: t.name, to, ref: meta.ref ?? null, status: "sending", at: Date.now() };
  try {
    if (meta.dedupe) await ref.create(entry);
    else await ref.set(entry);
  } catch {
    return { sent: false, skipped: "already sent" };
  }
  try {
    const r = await sendTemplate(to, { name: t.name, ...params });
    await ref.update({ status: "accepted", wamid: r.messages?.[0]?.id ?? null }).catch(() => {});
    return { sent: true };
  } catch (e) {
    const error = (e as Error).message;
    if (meta.dedupe) await ref.delete().catch(() => {});
    await log().add({ ...entry, status: "failed", error }).catch(() => {});
    console.error("whatsapp failed", t.name, error);
    return { sent: false, error };
  }
}

async function optedOut(number: string) {
  return (await adminDb.collection("whatsappOptOut").doc(number).get()).exists;
}

const safe =
  <A extends unknown[]>(fn: (...a: A) => Promise<unknown>) =>
  async (...a: A) => {
    try {
      await fn(...a);
    } catch (e) {
      console.error("whatsapp notify failed", e);
    }
  };

type WithNotify = { notify?: { whatsapp?: boolean } };
const customerNumber = (d: WithNotify & { customer?: { phone?: string } }) => (d.notify?.whatsapp ? waNumber(d.customer?.phone) : null);

async function freshOrder(id: string) {
  const s = await adminDb.collection("orders").doc(id).get();
  return s.exists ? ({ ...(s.data() as Omit<Order, "id">), id } as Order & WithNotify & { cancelReason?: string }) : null;
}
async function freshSub(id: string) {
  const s = await adminDb.collection("subscriptions").doc(id).get();
  return s.exists ? ({ ...(s.data() as Omit<Subscription, "id">), id } as Subscription & WithNotify) : null;
}

const items = (o: Order) => o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ");
const payText = (o: Order) =>
  o.paymentStatus === "paid" ? (o.payment?.method ? `paid via ${o.payment.method.toUpperCase()}` : "paid online") : o.paymentMode === "online" ? "payment pending" : "pay on delivery";

// ── orders ──────────────────────────────────────────────

export const waOrderLive = safe(async (orderId: string) => {
  const o = await freshOrder(orderId);
  if (!o) return;
  if (o.source !== "pos" && !o.subscriptionId) {
    await sendWhatsApp(customerNumber(o), "order_confirmed", { body: [first(o.customer.name), o.orderNo, items(o), inr(o.total), payText(o)], buttonSuffix: `account/orders/${o.id}` }, { dedupe: `order-confirmed-${o.id}`, ref: o.id });
    const who = `${o.customer.name}${o.customer.phone ? ` (${o.customer.phone})` : ""}`;
    const src = o.source === "zomato" ? "Zomato" : "website";
    for (const n of staffWhatsApp())
      await sendWhatsApp(n, "staff_new_order", { body: [src, o.orderNo, who, items(o), `${inr(o.total)} · ${payText(o)}`], buttonSuffix: `admin/orders/${o.id}` }, { dedupe: `staff-order-${o.id}`, ref: o.id });
  }
});

export const waOrderStatus = safe(async (orderId: string, status: string) => {
  if (!["ready", "dispatched", "delivered", "cancelled"].includes(status)) return;
  const o = await freshOrder(orderId);
  if (!o || o.source !== "website" || o.subscriptionId) return;
  const to = customerNumber(o);
  if (!to) return;
  const pickup = o.delivery?.provider === "pickup";
  const btn = `account/orders/${o.id}`;
  const meta = { dedupe: `order-${o.id}-${status}`, ref: o.id };
  const name = first(o.customer.name);
  if (status === "ready" && pickup) await sendWhatsApp(to, "order_ready_pickup", { body: [name, o.orderNo], buttonSuffix: btn }, meta);
  if (status === "dispatched" && !pickup) {
    const d = o.delivery;
    const rider = d.partnerName ? `${d.partnerName}${d.partnerPhone ? ` (${d.partnerPhone})` : ""}` : "our delivery partner";
    const pay = o.paymentStatus === "paid" ? "already paid" : `please keep ${inr(o.total)} ready (cash or UPI)`;
    await sendWhatsApp(to, "order_on_the_way", { body: [name, o.orderNo, rider, pay], buttonSuffix: btn }, meta);
  }
  if (status === "delivered") await sendWhatsApp(to, "order_delivered", { body: [name, o.orderNo], buttonSuffix: btn }, meta);
  if (status === "cancelled" && !(o.paymentMode === "online" && !o.payment?.paymentId)) {
    const refund = o.payment?.paymentId
      ? `A refund of ${inr(o.payment.refundedAmount || o.total)} has been started to your original payment method (5–7 working days).`
      : "You have not been charged for this order.";
    await sendWhatsApp(to, "order_cancelled", { body: [name, o.orderNo, refund] }, meta);
  }
});

export const waPaymentLink = safe(async (orderId: string, url: string) => {
  const o = await freshOrder(orderId);
  if (!o || !url.startsWith("https://rzp.io/")) return;
  // Staff send links on purpose (often for phone orders), so the customer's number is used even without the checkbox.
  await sendWhatsApp(waNumber(o.customer.phone), "payment_link", { body: [first(o.customer.name), inr(o.total), o.orderNo], buttonSuffix: url.slice("https://rzp.io/".length) }, { dedupe: `paylink-${o.id}-${url}`, ref: o.id });
});

// ── refunds ─────────────────────────────────────────────

type Target = { kind: "order" | "subscription"; id: string };
async function refundCtx(t: Target) {
  if (t.kind === "order") {
    const o = await freshOrder(t.id);
    return o && { to: customerNumber(o), name: o.customer.name, what: `order ${o.orderNo}` };
  }
  const s = await freshSub(t.id);
  return s && { to: customerNumber(s), name: s.customer.name, what: `your ${s.planName} plan` };
}

export const waRefundStarted = safe(async (t: Target, a: { refundId: string; amount: number }) => {
  const c = await refundCtx(t);
  if (c) await sendWhatsApp(c.to, "refund_started", { body: [first(c.name), inr(a.amount), c.what] }, { dedupe: `refund-started-${a.refundId}`, ref: t.id });
});

export const waRefundCompleted = safe(async (t: Target, a: { refundId: string; amount: number }) => {
  const c = await refundCtx(t);
  if (c) await sendWhatsApp(c.to, "refund_completed", { body: [first(c.name), inr(a.amount), c.what] }, { dedupe: `refund-done-${a.refundId}`, ref: t.id });
});

export const waStaffIssue = safe(async (a: { key: string; title: string; detail: string; url: string }) => {
  for (const n of staffWhatsApp())
    await sendWhatsApp(n, "staff_alert", { body: [a.title, a.detail], buttonSuffix: a.url.replace(/^\//, "") }, { dedupe: `issue-${a.key}`, ref: a.url });
});

// ── subscriptions ───────────────────────────────────────

const subBtn = (s: { id: string }) => `account/subscriptions/${s.id}`;

export const waSubscriptionCreated = safe(async (subId: string) => {
  const s = await freshSub(subId);
  if (!s || s.paymentMode !== "offline") return;
  await sendWhatsApp(customerNumber(s), "plan_reserved", { body: [first(s.customer.name), s.planName, inr(s.total), fmtDate(s.startDate)], buttonSuffix: subBtn(s) }, { dedupe: `sub-pending-${s.id}`, ref: s.id });
});

export const waSubscriptionActive = safe(async (subId: string) => {
  const s = await freshSub(subId);
  if (!s) return;
  await sendWhatsApp(customerNumber(s), "plan_active", { body: [first(s.customer.name), s.planName, fmtDate(s.startDate)], buttonSuffix: subBtn(s) }, { dedupe: `sub-active-${s.id}`, ref: s.id });
});

export const waSubscriptionChanged = safe(async (subId: string, change: "paused" | "resumed" | "cancelled") => {
  const s = await freshSub(subId);
  if (!s) return;
  await sendWhatsApp(customerNumber(s), "plan_update", { body: [first(s.customer.name), s.planName, change], buttonSuffix: subBtn(s) }, { dedupe: `sub-${s.id}-${change}-${s.updatedAt}`, ref: s.id });
});

export const waSubscriptionEndingSoon = safe(async (subId: string, left: number) => {
  const s = await freshSub(subId);
  if (!s) return;
  await sendWhatsApp(customerNumber(s), "plan_ending", { body: [first(s.customer.name), String(left), s.planName], buttonSuffix: "plans" }, { dedupe: `sub-ending-${s.id}`, ref: s.id });
});

export const waSubscriptionFinished = safe(async (subId: string, expired: boolean) => {
  const s = await freshSub(subId);
  if (!s) return;
  await sendWhatsApp(customerNumber(s), "plan_finished", { body: [first(s.customer.name), s.planName, expired ? "expired" : "been completed"], buttonSuffix: "plans" }, { dedupe: `sub-finished-${s.id}`, ref: s.id });
});
