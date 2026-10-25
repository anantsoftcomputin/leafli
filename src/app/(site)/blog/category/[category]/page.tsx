import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/site/PageShell";
import { PostCards } from "@/components/site/PostCards";
import { categorySlug, getPublishedPosts } from "@/lib/server/content";

export const revalidate = 60;

async function load(cat: string) {
  const posts = (await getPublishedPosts()).filter((p) => categorySlug(p.category) === cat);
  return { posts, name: posts[0]?.category };
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const { name } = await load(category);
  if (!name) return { title: "Category not found", robots: { index: false } };
  return { title: `${name} — Articles`, description: `Leafli articles about ${name.toLowerCase()}: practical, people-first tips from our salad kitchen team in Vadodara.`, alternates: { canonical: `/blog/category/${category}` } };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const { posts, name } = await load(category);
  if (!name) notFound();
  return (
    <main>
      <PageHero crumbs={[{ name: "Blog", path: "/blog" }, { name, path: `/blog/category/${category}` }]} eyebrow="Category" title={name} />
      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8"><PostCards posts={posts} /></section>
    </main>
  );
}
