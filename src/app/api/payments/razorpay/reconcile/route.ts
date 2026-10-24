import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { HttpError, requireUser, route, STAFF } from "@/lib/server/http";
import { reconcile } from "@/lib/server/payments";

const schema = z.object({ kind: z.enum(["order", "subscription"]), id: z.string().min(1) });

/**
 * Ask Razorpay whether a pending order / plan has actually been paid.
 * The order page calls this on open, so a closed tab never strands a paid order.
 */
export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req);
  const t = schema.parse(await req.json());
  const snap = await adminDb.collection(t.kind === "order" ? "orders" : "subscriptions").doc(t.id).get();
  if (!snap.exists) throw new HttpError(404, "Not found");
  if (snap.get("customerUid") !== actor.uid && !STAFF.includes(actor.role)) throw new HttpError(403, "Not yours");
  return reconcile(t);
});
