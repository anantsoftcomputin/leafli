import type { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { buildSubscriptionInvoice } from "@/lib/invoice";
import { HttpError, requireUser, route, STAFF } from "@/lib/server/http";
import { getSettings } from "@/lib/server/orders";
import type { Subscription } from "@/lib/types";

/** Tax invoice for a paid plan — for its owner, or staff. */
export const GET = route(async (req: NextRequest, ctx) => {
  const actor = await requireUser(req);
  const { id } = await ctx.params;
  const snap = await adminDb.collection("subscriptions").doc(id!).get();
  if (!snap.exists) throw new HttpError(404, "Subscription not found");
  const s = { ...(snap.data() as Subscription), id: snap.id };
  if (s.customerUid !== actor.uid && !STAFF.includes(actor.role)) throw new HttpError(403, "Not your subscription");
  const invoice = buildSubscriptionInvoice(s, await getSettings());
  if (!invoice) throw new HttpError(409, "The invoice is issued once the plan is paid");
  return invoice;
});
