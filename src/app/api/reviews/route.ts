import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { HttpError, requireUser, route } from "@/lib/server/http";
import { notifyStaff } from "@/lib/server/push";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  quote: z.string().trim().min(20, "Tell us a little more (at least 20 characters)").max(500),
  name: z.string().trim().min(2).max(40),
  location: z.string().trim().max(40).optional(),
  dish: z.string().max(80).optional(),
  orderId: z.string().optional(),
});

/**
 * A customer reviews Leafli. Only signed-in customers who have actually ordered can
 * submit; reviews are held for approval (Admin → Testimonials) before appearing.
 */
export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req);
  const b = schema.parse(await req.json());
  const orders = await adminDb.collection("orders").where("customerUid", "==", actor.uid).limit(20).get();
  if (!orders.docs.some((d) => d.get("status") !== "cancelled"))
    throw new HttpError(403, "Reviews are open to customers who've ordered — place an order and come back!");
  const mine = await adminDb.collection("testimonials").where("uid", "==", actor.uid).get();
  if (mine.docs.some((d) => (d.get("createdAt") as number) > Date.now() - 14 * 86400000))
    throw new HttpError(409, "Thanks — you've already shared a review recently.");

  const ref = await adminDb.collection("testimonials").add({
    ...b,
    source: "direct",
    published: false,
    pending: true,
    uid: actor.uid,
    orderId: b.orderId ?? null,
    sortOrder: 100,
    createdAt: Date.now(),
  });
  await notifyStaff({ title: `New ${"★".repeat(b.rating)} review to approve`, body: `“${b.quote.slice(0, 90)}” — ${b.name}`, url: "/admin/testimonials", tag: `review-${ref.id}` }, ["admin", "manager"]);
  return { ok: true };
});
