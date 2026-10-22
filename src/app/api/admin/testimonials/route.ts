import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { HttpError, MANAGERS, requireUser, route } from "@/lib/server/http";
import { refreshPublic } from "@/lib/server/revalidate";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(60),
  quote: z.string().min(10).max(500),
  rating: z.number().int().min(1).max(5),
  dish: z.string().max(80).optional(),
  location: z.string().max(60).optional(),
  source: z.enum(["google", "zomato", "instagram", "direct"]).default("direct"),
  published: z.boolean(),
  sortOrder: z.number().default(0),
});

export const POST = route(async (req: NextRequest) => {
  await requireUser(req, MANAGERS);
  const b = schema.parse(await req.json());
  const col = adminDb.collection("testimonials");
  const ref = b.id ? col.doc(b.id) : col.doc();
  const { id: _id, ...data } = b;
  await ref.set({ ...JSON.parse(JSON.stringify(data)), ...(b.id ? {} : { createdAt: Date.now() }) }, { merge: true });
  refreshPublic("testimonials");
  return { id: ref.id };
});

export const DELETE = route(async (req: NextRequest) => {
  await requireUser(req, MANAGERS);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) throw new HttpError(400, "Missing id");
  await adminDb.collection("testimonials").doc(id).delete();
  refreshPublic("testimonials");
  return { ok: true };
});
