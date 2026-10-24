import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, route } from "@/lib/server/http";
import { createSubscription } from "@/lib/server/subscriptions";

const schema = z.object({
  planId: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deliveryDays: z.array(z.number().int().min(0).max(6)).min(1),
  slot: z.enum(["lunch", "dinner"]),
  diet: z.enum(["veg", "egg", "nonveg"]),
  address: z.object({
    label: z.string().optional(),
    line1: z.string().min(3),
    line2: z.string().optional(),
    landmark: z.string().optional(),
    city: z.string().min(2),
    state: z.string().min(2),
    pincode: z.string().regex(/^\d{6}$/, "6-digit pincode"),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
  customer: z.object({ name: z.string().min(1).max(80), phone: z.string().min(10).max(16), email: z.union([z.email(), z.literal("")]).optional() }),
  paymentMode: z.enum(["online", "offline"]),
  notes: z.string().max(300).optional(),
  notify: z.object({ whatsapp: z.boolean() }).optional(),
});

/** A signed-in customer buys a plan. Online → returns Razorpay checkout details. */
export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req);
  const input = schema.parse(await req.json());
  const user = await adminDb.collection("users").doc(actor.uid).get();
  const email = (user.get("email") as string | null) || input.customer.email || (user.get("contactEmail") as string | null) || null;
  return createSubscription(input, { ...actor, email });
});
