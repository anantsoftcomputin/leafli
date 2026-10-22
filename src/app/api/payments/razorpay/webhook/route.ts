import type { NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/integrations/razorpay";
import { HttpError, route } from "@/lib/server/http";
import { col } from "@/lib/server/inventory";
import { markOrderPaid } from "@/lib/server/orders";
import { activateSubscription } from "@/lib/server/subscriptions";

/**
 * Razorpay webhook (Dashboard → Settings → Webhooks):
 *   URL     https://<your-domain>/api/payments/razorpay/webhook
 *   Secret  RAZORPAY_WEBHOOK_SECRET
 *   Events  payment.captured, order.paid
 * Confirms payment even if the customer closed the tab before the browser could.
 */
export const POST = route(async (req: NextRequest) => {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature") ?? "")) throw new HttpError(401, "Bad signature");
  const body = JSON.parse(raw) as {
    event: string;
    payload?: { payment?: { entity?: { id: string; order_id: string; notes?: Record<string, string> } } };
  };
  if (body.event !== "payment.captured" && body.event !== "order.paid") return { ok: true, ignored: body.event };
  const p = body.payload?.payment?.entity;
  if (!p?.order_id) return { ok: true, ignored: "no payment entity" };
  // Subscription purchase
  if (p.notes?.leafliSubscriptionId) {
    await col.logs().add({ provider: "razorpay", direction: "in", event: body.event, subscriptionId: p.notes.leafliSubscriptionId, at: Date.now() });
    return activateSubscription(p.notes.leafliSubscriptionId, { rzpOrderId: p.order_id, paymentId: p.id });
  }
  let orderId = p.notes?.leafliOrderId;
  if (!orderId) {
    const q = await col.orders().where("payment.rzpOrderId", "==", p.order_id).limit(1).get();
    orderId = q.docs[0]?.id;
  }
  if (!orderId) return { ok: true, ignored: "unknown order" };
  await col.logs().add({ provider: "razorpay", direction: "in", event: body.event, orderId, at: Date.now() });
  return markOrderPaid(orderId, p.order_id, p.id);
});
