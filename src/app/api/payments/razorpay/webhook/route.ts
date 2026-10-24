import type { NextRequest } from "next/server";
import { ensureCaptured, verifyWebhookSignature, type RzpPayment, type RzpRefund } from "@/lib/integrations/razorpay";
import { HttpError, route } from "@/lib/server/http";
import { col } from "@/lib/server/inventory";
import { applyRefundEvent, recordFailure, settlePayment, targetOfPayment } from "@/lib/server/payments";

/**
 * Razorpay webhook (Dashboard → Account & Settings → Webhooks):
 *   URL     https://<your-domain>/api/payments/razorpay/webhook
 *   Secret  RAZORPAY_WEBHOOK_SECRET
 *   Events  payment.authorized, payment.captured, payment.failed, order.paid,
 *           refund.processed, refund.failed, payment_link.paid
 * Confirms payment even if the customer closed the tab before the browser could.
 *
 * Razorpay retries non-2xx responses and disables a webhook that keeps failing, so
 * only a bad signature (or a transient crash worth retrying) returns an error;
 * anything we can't match is logged and acknowledged.
 */
interface Event {
  event: string;
  payload?: {
    payment?: { entity?: RzpPayment };
    refund?: { entity?: RzpRefund };
    payment_link?: { entity?: { id: string; notes?: Record<string, string> } };
  };
}

export const POST = route(async (req: NextRequest) => {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature") ?? "")) throw new HttpError(401, "Bad signature");
  const body = JSON.parse(raw) as Event;

  // Razorpay may deliver the same event more than once.
  const eventId = req.headers.get("x-razorpay-event-id");
  const seen = eventId ? col.logs().firestore.collection("webhookEvents").doc(`razorpay_${eventId}`) : null;
  if (seen) {
    try {
      await seen.create({ event: body.event, at: Date.now() });
    } catch {
      return { ok: true, duplicate: true };
    }
  }

  try {
    return await handle(body);
  } catch (e) {
    if (!(e instanceof HttpError)) {
      await seen?.delete().catch(() => {}); // let Razorpay's retry through
      throw e;
    }
    await col.logs().add({ provider: "razorpay", direction: "in", event: body.event, error: e.message, at: Date.now() });
    return { ok: true, ignored: e.message };
  }
});

async function handle(body: Event) {
  let p = body.payload?.payment?.entity;
  // Link payments carry our ids on the link, not necessarily on the payment.
  const linkNotes = body.payload?.payment_link?.entity?.notes;
  if (p && linkNotes?.leafliOrderId) p = { ...p, notes: { ...linkNotes, via: "payment_link" } };
  switch (body.event) {
    case "payment.authorized":
    case "payment.captured":
    case "order.paid":
    case "payment_link.paid": {
      if (!p?.order_id) return { ok: true, ignored: "no payment entity" };
      const t = await targetOfPayment(p);
      if (!t) return { ok: true, ignored: "unknown order" };
      // Authorized-only payments get captured (auto-capture may be off in the dashboard).
      let pay = p;
      if (p.status === "authorized") {
        const c = await ensureCaptured(p.id);
        if (!c) return { ok: true, ignored: "not capturable" };
        pay = c;
      }
      await log(body.event, t);
      return settlePayment(pay, t);
    }
    case "payment.failed": {
      if (!p) return { ok: true, ignored: "no payment entity" };
      const t = await targetOfPayment(p);
      if (!t) return { ok: true, ignored: "unknown order" };
      await recordFailure(t, p);
      return { ok: true };
    }
    case "refund.processed":
    case "refund.failed": {
      const r = body.payload?.refund?.entity;
      if (!r) return { ok: true, ignored: "no refund entity" };
      return applyRefundEvent(r, body.event);
    }
    default:
      return { ok: true, ignored: body.event };
  }
}

const log = (event: string, t: { kind: string; id: string }) =>
  col.logs().add({
    provider: "razorpay",
    direction: "in",
    event,
    [t.kind === "order" ? "orderId" : "subscriptionId"]: t.id,
    at: Date.now(),
  });
