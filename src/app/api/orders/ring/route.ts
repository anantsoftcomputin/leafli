import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { HttpError, route } from "@/lib/server/http";
import { pushConfigured, ringUnacceptedOrders } from "@/lib/server/push";

/**
 * Called every minute by the Netlify scheduled function (netlify/functions/order-ring.mts):
 * re-rings staff phones for website / Zomato orders still waiting to be accepted.
 */
export const POST = route(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET || "";
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const ok = secret && given.length === secret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) throw new HttpError(401, "Not allowed");
  if (!pushConfigured()) return { orders: 0, sent: 0, skipped: "push not configured" };
  return ringUnacceptedOrders();
});
