import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/PageShell";
import { PostCards } from "@/components/site/PostCards";
import { categorySlug, getPublishedPosts } from "@/lib/server/content";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Healthy Eating Blog — Salads & Nutrition in Vadodara",
  description: "Guides to healthy eating in Vadodara: high-protein vegetarian salads, office lunches, weight-loss meals and nutrition tips from the Leafli kitchen team.",
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/rss.xml" } },
};

export default async function BlogIndex() {
  const posts = await getPublishedPosts();
  const cats = [...new Set(posts.map((p) => p.category))];
  return (
    <main>
      <PageHero
        crumbs={[{ name: "Blog", path: "/blog" }]}
        eyebrow="The Leafli journal"
        title={<>Eat well, <em className="text-leaf-600 italic">read well.</em></>}
        intro="Straightforward advice on eating better every day — from what goes into a balanced bowl to planning a week of lunches."
      >
        {cats.length > 1 && (
          <nav aria-label="Blog categories" className="mt-8 flex flex-wrap gap-2">
            {cats.map((c) => (
              <Link key={c} href={`/blog/category/${categorySlug(c)}`} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink/70 ring-1 ring-ink/10 hover:ring-ink/30">
                {c}
              </Link>
            ))}
          </nav>
        )}
      </PageHero>
      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        {posts.length ? <PostCards posts={posts} /> : <p className="text-ink/50">New articles are on their way.</p>}
      </section>
    </main>
  );
}
