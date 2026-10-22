import type { NextRequest } from "next/server";
import { z } from "zod";
import { verifyPaymentSignature } from "@/lib/integrations/razorpay";
import { HttpError, requireUser, route, STAFF } from "@/lib/server/http";
import { col } from "@/lib/server/inventory";
import { markOrderPaid } from "@/lib/server/orders";

const schema = z.object({
  orderId: z.string(),
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

/** Called by the browser after Razorpay Checkout succeeds. */
export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req);
  const b = schema.parse(await req.json());
  const snap = await col.orders().doc(b.orderId).get();
  if (!snap.exists) throw new HttpError(404, "Order not found");
  if (snap.get("customerUid") !== actor.uid && !STAFF.includes(actor.role)) throw new HttpError(403, "Not your order");
  if (!verifyPaymentSignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature))
    throw new HttpError(400, "Payment could not be verified");
  return markOrderPaid(b.orderId, b.razorpay_order_id, b.razorpay_payment_id);
});
