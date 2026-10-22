import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { verifyPaymentSignature } from "@/lib/integrations/razorpay";
import { HttpError, requireUser, route } from "@/lib/server/http";
import { activateSubscription } from "@/lib/server/subscriptions";

const schema = z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() });

export const POST = route(async (req: NextRequest, ctx) => {
  const actor = await requireUser(req);
  const { id } = await ctx.params;
  const b = schema.parse(await req.json());
  const snap = await adminDb.collection("subscriptions").doc(id!).get();
  if (!snap.exists) throw new HttpError(404, "Subscription not found");
  if (snap.get("customerUid") !== actor.uid) throw new HttpError(403, "Not your subscription");
  if (!verifyPaymentSignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) throw new HttpError(400, "Payment could not be verified");
  return activateSubscription(id!, { rzpOrderId: b.razorpay_order_id, paymentId: b.razorpay_payment_id });
});
