// Shared by /blog, /blog/page/[page] and the category equivalents.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { PageHero } from "@/components/site/PageShell";
import { pageHref, paginate, Pagination } from "@/components/site/Pagination";
import { PostCards } from "@/components/site/PostCards";
import { categorySlug, getPublishedPosts } from "@/lib/server/content";

const INDEX_TITLE = "Healthy Eating Blog — Salads & Nutrition in Vadodara";
const INDEX_DESC = "Guides to healthy eating in Vadodara: high-protein vegetarian salads, office lunches, weight-loss meals and nutrition tips from the Leafli kitchen team.";

/** "/blog/page/abc" or "/blog/page/1" never render: bad numbers 404, page 1 goes to the bare URL. */
export function parsePage(raw: string, base: string) {
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || n < 1) notFound();
  if (n === 1) permanentRedirect(base);
  return n;
}

const suffix = (page: number) => (page > 1 ? ` — Page ${page}` : "");

export async function blogIndexMetadata(page: number): Promise<Metadata> {
  const { pages } = paginate(await getPublishedPosts(), 1)!;
  if (page > pages) return { title: "Page not found", robots: { index: false } };
  return {
    title: { absolute: `${INDEX_TITLE}${suffix(page)}` },
    description: page > 1 ? `${INDEX_DESC.slice(0, 130)} Page ${page}.` : INDEX_DESC,
    alternates: { canonical: pageHref("/blog", page), types: { "application/rss+xml": "/blog/rss.xml" } },
  };
}

export async function BlogIndexView({ page }: { page: number }) {
  const all = await getPublishedPosts();
  const slice = paginate(all, page);
  if (!slice) notFound();
  const cats = [...new Set(all.map((p) => p.category))];
  return (
    <main>
      <PageHero
        crumbs={[{ name: "Blog", path: "/blog" }, ...(page > 1 ? [{ name: `Page ${page}`, path: pageHref("/blog", page) }] : [])]}
        eyebrow="The Leafli journal"
        title={<>Eat well, <em className="text-leaf-600 italic">read well.</em></>}
        intro={page > 1 ? `Page ${page} of ${slice.pages}` : "Straightforward advice on eating better every day — from what goes into a balanced bowl to planning a week of lunches."}
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
        {slice.items.length ? <PostCards posts={slice.items} /> : <p className="text-ink/50">New articles are on their way.</p>}
        <Pagination base="/blog" page={page} pages={slice.pages} />
      </section>
    </main>
  );
}

async function loadCategory(cat: string) {
  const posts = (await getPublishedPosts()).filter((p) => categorySlug(p.category) === cat);
  return { posts, name: posts[0]?.category };
}

export async function categoryMetadata(category: string, page: number): Promise<Metadata> {
  const { posts, name } = await loadCategory(category);
  if (!name || !paginate(posts, page)) return { title: "Category not found", robots: { index: false } };
  return {
    title: `${name} — Articles${suffix(page)}`,
    description: `Leafli articles about ${name.toLowerCase()}: practical, people-first tips from our salad kitchen team in Vadodara.${page > 1 ? ` Page ${page}.` : ""}`,
    alternates: { canonical: pageHref(`/blog/category/${category}`, page) },
  };
}

export async function CategoryView({ category, page }: { category: string; page: number }) {
  const { posts, name } = await loadCategory(category);
  const slice = name ? paginate(posts, page) : null;
  if (!name || !slice) notFound();
  const base = `/blog/category/${category}`;
  return (
    <main>
      <PageHero
        crumbs={[{ name: "Blog", path: "/blog" }, { name, path: base }, ...(page > 1 ? [{ name: `Page ${page}`, path: pageHref(base, page) }] : [])]}
        eyebrow="Category"
        title={name}
        intro={page > 1 ? `Page ${page} of ${slice.pages}` : undefined}
      />
      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <PostCards posts={slice.items} />
        <Pagination base={base} page={page} pages={slice.pages} />
      </section>
    </main>
  );
}
