import type { NextRequest } from "next/server";
import { z } from "zod";
import { razorpayConfigured } from "@/lib/integrations/razorpay";
import { HttpError, requireUser, route, STAFF } from "@/lib/server/http";
import { sendPaymentLink } from "@/lib/server/payments";
import { SITE_URL } from "@/lib/site";

const schema = z.object({ orderId: z.string().min(1) });

/** Staff text the customer a Razorpay payment link for an unpaid order. */
export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req, STAFF);
  if (!razorpayConfigured()) throw new HttpError(503, "Razorpay isn't configured");
  const { orderId } = schema.parse(await req.json());
  return sendPaymentLink(orderId, actor, SITE_URL);
});
