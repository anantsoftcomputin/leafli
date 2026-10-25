import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { renderMarkdown } from "@/lib/markdown";
import { HttpError, MANAGERS, requireUser, route } from "@/lib/server/http";
import { refreshPublic } from "@/lib/server/revalidate";
import { slugify } from "@/lib/site";

const faq = z.object({ q: z.string().min(3).max(200), a: z.string().min(3).max(1500) });
const schema = z.object({
  id: z.string().optional(),
  title: z.string().min(5).max(140),
  slug: z.string().max(90).optional(),
  excerpt: z.string().max(400).default(""),
  content: z.string().max(100_000).default(""),
  coverImage: z.string().url().nullable().optional(),
  coverAlt: z.string().max(200).optional(),
  authorName: z.string().min(2).max(80),
  authorBio: z.string().max(400).optional(),
  category: z.string().min(2).max(60),
  tags: z.array(z.string().max(40)).max(15).default([]),
  status: z.enum(["draft", "published", "scheduled"]),
  publishedAt: z.number().nullable().optional(),
  metaTitle: z.string().max(120).optional(),
  metaDescription: z.string().max(300).optional(),
  focusKeyword: z.string().max(80).optional(),
  secondaryKeywords: z.array(z.string().max(60)).max(10).optional(),
  canonicalUrl: z.string().url().or(z.literal("")).optional(),
  noindex: z.boolean().optional(),
  nofollow: z.boolean().optional(),
  ogTitle: z.string().max(120).optional(),
  ogDescription: z.string().max(300).optional(),
  ogImage: z.string().url().nullable().optional(),
  twitterCard: z.enum(["summary", "summary_large_image"]).optional(),
  schemaType: z.enum(["BlogPosting", "Article", "NewsArticle"]).optional(),
  faqs: z.array(faq).max(20).optional(),
  relatedMenuIds: z.array(z.string()).max(6).optional(),
});

const posts = () => adminDb.collection("posts");

/** Create or update a blog post. */
export const POST = route(async (req: NextRequest) => {
  await requireUser(req, MANAGERS);
  const b = schema.parse(await req.json());
  const slug = slugify(b.slug || b.title);
  if (!slug) throw new HttpError(400, "Add a title or slug");
  const clash = await posts().where("slug", "==", slug).limit(2).get();
  if (clash.docs.some((d) => d.id !== b.id)) throw new HttpError(409, `Another post already uses the URL /blog/${slug}`);

  const ref = b.id ? posts().doc(b.id) : posts().doc();
  const prev = b.id ? (await ref.get()).data() : undefined;
  if (b.id && !prev) throw new HttpError(404, "Post not found");
  const now = Date.now();
  const { wordCount, readingMinutes } = renderMarkdown(b.content);
  // First publish stamps the date; scheduled posts use the chosen time.
  // "Publish now" on a post that still carries a future date goes live immediately.
  const keptDate = (prev?.publishedAt as number | undefined) ?? b.publishedAt;
  const publishedAt =
    b.status === "scheduled"
      ? b.publishedAt ?? now
      : b.status === "published"
        ? keptDate && keptDate <= now ? keptDate : now
        : (prev?.publishedAt as number | null | undefined) ?? null;
  if (b.status === "scheduled" && (publishedAt ?? 0) <= now) throw new HttpError(400, "Pick a future time to schedule, or publish now");

  const { id: _id, ...data } = b;
  await ref.set(
    JSON.parse(JSON.stringify({ ...data, slug, publishedAt, wordCount, readingMinutes, updatedAt: now, ...(prev ? {} : { createdAt: now }) })),
    { merge: false },
  );
  refreshPublic("posts", ["/blog", `/blog/${slug}`, ...(prev?.slug && prev.slug !== slug ? [`/blog/${prev.slug}`] : [])]);
  return { id: ref.id, slug };
});

export const DELETE = route(async (req: NextRequest) => {
  await requireUser(req, MANAGERS);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) throw new HttpError(400, "Missing id");
  const snap = await posts().doc(id).get();
  await posts().doc(id).delete();
  refreshPublic("posts", ["/blog", `/blog/${snap.get("slug")}`]);
  return { ok: true };
});
