import "server-only";
import crypto from "node:crypto";
import webpush, { type PushSubscription } from "web-push";
import { adminDb } from "@/lib/firebase/admin";
import { awaitingPayment, type Order, type Role } from "@/lib/types";

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
export const pushConfigured = () => Boolean(PUBLIC && PRIVATE);
if (pushConfigured()) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@leafli.in", PUBLIC, PRIVATE);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string; // same tag replaces the previous notification (e.g. one per order)
  image?: string;
  requireInteraction?: boolean;
  ring?: boolean; // incoming-order alert: long ring-style vibration, re-alerts even with the same tag
}

interface StoredSub {
  uid: string | null;
  role: Role | "guest";
  endpoint: string;
  keys: { p256dh: string; auth: string };
  ua?: string;
  createdAt: number;
  lastSentAt?: number;
}

const col = () => adminDb.collection("pushSubscriptions");
export const subId = (endpoint: string) => crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 40);

export async function saveSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, uid: string | null, role: StoredSub["role"], ua?: string) {
  await col().doc(subId(sub.endpoint)).set({ uid, role, endpoint: sub.endpoint, keys: sub.keys, ua: ua?.slice(0, 200), createdAt: Date.now() } satisfies StoredSub, { merge: true });
}

export async function removeSubscription(endpoint: string) {
  await col().doc(subId(endpoint)).delete();
}

/** Send to a set of stored subscriptions; prunes ones the push service says are gone. */
async function deliver(docs: FirebaseFirestore.QueryDocumentSnapshot[], payload: PushPayload) {
  if (!pushConfigured() || !docs.length) return { sent: 0, failed: 0 };
  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  await Promise.allSettled(
    docs.map(async (d) => {
      const s = d.data() as StoredSub;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys } as PushSubscription, body, { TTL: 60 * 60 * 6, urgency: "high" });
        sent++;
        d.ref.update({ lastSentAt: Date.now() }).catch(() => {});
      } catch (e) {
        failed++;
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await d.ref.delete().catch(() => {});
      }
    }),
  );
  return { sent, failed };
}

/** Never throws — a failed notification must not break an order. */
async function safe<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (e) {
    console.error("push failed", e);
    return { sent: 0, failed: 0 };
  }
}

export const notifyUser = (uid: string, payload: PushPayload) => safe(async () => deliver((await col().where("uid", "==", uid).get()).docs, payload));

export const notifyStaff = (payload: PushPayload, roles: Role[] = ["admin", "manager", "kitchen", "cashier"]) =>
  safe(async () => deliver((await col().where("role", "in", roles).get()).docs, payload));

export const broadcast = (audience: "customers" | "staff" | "everyone", payload: PushPayload) =>
  safe(async () => {
    const q = audience === "everyone" ? col() : audience === "staff" ? col().where("role", "in", ["admin", "manager", "kitchen", "cashier"]) : col().where("role", "in", ["customer", "guest"]);
    return deliver((await q.get()).docs, payload);
  });

export async function pushStats() {
  const snap = await col().get();
  const by = { customers: 0, staff: 0 };
  for (const d of snap.docs) {
    if (["customer", "guest"].includes(d.get("role"))) by.customers++;
    else by.staff++;
  }
  return { devices: snap.size, ...by };
}

// ── Messages ─────────────────────────────────────────────

const ORDER_MSG: Record<string, (no: string, pickup: boolean) => Pick<PushPayload, "title" | "body">> = {
  accepted: (no) => ({ title: "Order confirmed ✅", body: `The kitchen has your order ${no}. We'll let you know when it's ready.` }),
  preparing: () => ({ title: "Being prepared 🥗", body: "Your bowl is being assembled fresh right now." }),
  ready: (_no, pickup) => (pickup ? { title: "Ready for pickup 🛍️", body: "Your order is packed and waiting for you." } : { title: "Packed & ready", body: "Your order is packed — a rider is being assigned." }),
  dispatched: () => ({ title: "On the way 🛵", body: "Your rider has picked up your order. Tap to track live." }),
  delivered: () => ({ title: "Delivered — enjoy! 💚", body: "Toss your dressing in just before eating for the best crunch." }),
  cancelled: (no) => ({ title: "Order cancelled", body: `Order ${no} was cancelled. Any online payment will be refunded.` }),
};

export function notifyOrderStatus(order: { id: string; orderNo: string; customerUid?: string | null; delivery?: { provider?: string } }, status: string) {
  const msg = ORDER_MSG[status];
  if (!order.customerUid || !msg) return Promise.resolve({ sent: 0, failed: 0 });
  return notifyUser(order.customerUid, { ...msg(order.orderNo, order.delivery?.provider === "pickup"), url: `/account/orders/${order.id}`, tag: `order-${order.id}` });
}

const newOrderPayload = (order: { id: string; orderNo: string; source: string; total: number; lines: { qty: number; name: string }[] }, waitingMin = 0): PushPayload => {
  const items = order.lines.map((l) => `${l.qty}× ${l.name}`).join(", ");
  return {
    title: `${waitingMin ? `Still waiting ${waitingMin} min · ` : ""}New ${order.source === "zomato" ? "Zomato" : "website"} order · ₹${Math.round(order.total)}`,
    body: `${order.orderNo.slice(-3)} — ${items}`,
    url: `/admin/orders/${order.id}`,
    tag: `new-order-${order.id}`,
    requireInteraction: true,
    ring: true,
  };
};

export const notifyNewOrder = (order: Parameters<typeof newOrderPayload>[0]) => notifyStaff(newOrderPayload(order));

/** Rings staff phones again for orders nobody has accepted yet; stops after RING_FOR_MIN. */
const RING_FOR_MIN = 15;
export async function ringUnacceptedOrders() {
  const now = Date.now();
  const snap = await adminDb.collection("orders").where("status", "==", "new").get();
  const waiting = snap.docs
    .map((d) => ({ ...(d.data() as Order), id: d.id }))
    .filter((o) => !awaitingPayment(o) && now - o.createdAt >= 50_000 && now - o.createdAt < RING_FOR_MIN * 60_000);
  const results = await Promise.all(waiting.map((o) => notifyStaff(newOrderPayload(o, Math.round((now - o.createdAt) / 60_000)))));
  return { orders: waiting.length, sent: results.reduce((n, r) => n + r.sent, 0) };
}
