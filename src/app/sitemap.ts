import type { MetadataRoute } from "next";
import { categorySlug, getPlans, getPublicMenu, getPublishedPosts } from "@/lib/server/content";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

/** XML sitemap of every public page, with real last-modified dates for posts. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [menu, plans, posts] = await Promise.all([getPublicMenu().catch(() => null), getPlans().catch(() => []), getPublishedPosts().catch(() => [])]);
  const now = new Date();
  const statics: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["/", 1, "daily"],
    ["/menu", 0.9, "daily"],
    ["/plans", 0.9, "weekly"],
    ["/healthy-food-vadodara", 0.9, "weekly"],
    ["/blog", 0.7, "daily"],
    ["/about", 0.5, "monthly"],
    ["/faq", 0.5, "monthly"],
    ["/contact", 0.5, "monthly"],
    ["/terms", 0.2, "yearly"],
    ["/privacy", 0.2, "yearly"],
    ["/refunds", 0.2, "yearly"],
    ["/delivery-policy", 0.2, "yearly"],
  ];
  const latestPost = posts[0]?.updatedAt;
  return [
    ...statics.map(([p, priority, changeFrequency]) => ({ url: absoluteUrl(p), lastModified: p === "/blog" && latestPost ? new Date(latestPost) : now, changeFrequency, priority })),
    ...(menu?.items ?? []).map((d) => ({
      url: absoluteUrl(`/menu/${d.slug}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      images: [d.photoUrl || d.imageUrl].filter(Boolean) as string[],
    })),
    ...plans.map((p) => ({ url: absoluteUrl(`/plans/${p.slug}`), lastModified: p.updatedAt ? new Date(p.updatedAt) : now, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...posts
      .filter((p) => !p.noindex && !p.canonicalUrl)
      .map((p) => ({ url: absoluteUrl(`/blog/${p.slug}`), lastModified: new Date(p.updatedAt), changeFrequency: "monthly" as const, priority: 0.6, images: [p.coverImage].filter(Boolean) as string[] })),
    ...[...new Set(posts.map((p) => categorySlug(p.category)))].map((c) => ({ url: absoluteUrl(`/blog/category/${c}`), lastModified: now, changeFrequency: "weekly" as const, priority: 0.4 })),
  ];
}
