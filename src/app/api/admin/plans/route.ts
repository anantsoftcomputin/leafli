import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { HttpError, MANAGERS, requireUser, route } from "@/lib/server/http";
import { refreshPublic } from "@/lib/server/revalidate";
import { slugify } from "@/lib/site";

const schema = z.object({
  id: z.string().optional(),
  slug: z.string().max(60).optional(),
  name: z.string().min(2).max(60),
  tagline: z.string().max(120),
  description: z.string().max(2000),
  meals: z.number().int().min(1).max(120),
  validityDays: z.number().int().min(1).max(180),
  price: z.number().positive(),
  compareAtPrice: z.number().nonnegative(),
  eligibleMenuIds: z.array(z.string()).default([]),
  freeDelivery: z.boolean().default(true),
  features: z.array(z.string().max(120)).max(12).default([]),
  highlight: z.string().max(30).nullable().optional(),
  active: z.boolean(),
  sortOrder: z.number().default(0),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })).max(12).optional(),
  metaTitle: z.string().max(120).optional(),
  metaDescription: z.string().max(300).optional(),
});

export const POST = route(async (req: NextRequest) => {
  await requireUser(req, MANAGERS);
  const b = schema.parse(await req.json());
  const slug = slugify(b.slug || b.name);
  const col = adminDb.collection("plans");
  const clash = await col.where("slug", "==", slug).limit(2).get();
  if (clash.docs.some((d) => d.id !== b.id)) throw new HttpError(409, `Another plan already uses /plans/${slug}`);
  const ref = b.id ? col.doc(b.id) : col.doc(slug);
  const { id: _id, ...data } = b;
  await ref.set({ ...JSON.parse(JSON.stringify(data)), slug, updatedAt: Date.now() }, { merge: true });
  refreshPublic("plans", ["/plans", `/plans/${slug}`]);
  return { id: ref.id, slug };
});
