import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { DishImage } from "@/components/site/DishImage";
import { Breadcrumbs } from "@/components/site/PageShell";
import { formatDate, PostCards } from "@/components/site/PostCards";
import { rupees } from "@/lib/costing";
import { blogPosting, faqPage, graph } from "@/lib/jsonld";
import { renderMarkdown } from "@/lib/markdown";
import { categorySlug, getPostBySlug, getPublicMenu, getPublishedPosts } from "@/lib/server/content";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 60;

export async function generateStaticParams() {
  return (await getPublishedPosts().catch(() => [])).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPostBySlug(slug);
  if (!p) return { title: "Article not found", robots: { index: false } };
  const title = p.metaTitle || p.title;
  const description = p.metaDescription || p.excerpt;
  const image = p.ogImage || p.coverImage;
  return {
    title: { absolute: title },
    description,
    keywords: [p.focusKeyword, ...(p.secondaryKeywords ?? []), ...p.tags].filter(Boolean) as string[],
    authors: [{ name: p.authorName }],
    alternates: { canonical: p.canonicalUrl || `/blog/${p.slug}` },
    robots: { index: !p.noindex, follow: !p.nofollow, googleBot: { index: !p.noindex, follow: !p.nofollow, "max-image-preview": "large", "max-snippet": -1 } },
    openGraph: {
      type: "article",
      title: p.ogTitle || title,
      description: p.ogDescription || description,
      url: absoluteUrl(`/blog/${p.slug}`),
      publishedTime: new Date(p.publishedAt ?? p.createdAt).toISOString(),
      modifiedTime: new Date(p.updatedAt).toISOString(),
      authors: [p.authorName],
      section: p.category,
      tags: p.tags,
      images: [{ url: image || "/opengraph-image", alt: p.coverAlt || p.title }],
    },
    twitter: { card: p.twitterCard || "summary_large_image", title: p.ogTitle || title, description: p.ogDescription || description, images: [image || "/opengraph-image"] },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, all, menu] = await Promise.all([getPostBySlug(slug), getPublishedPosts(), getPublicMenu().catch(() => null)]);
  if (!post) notFound();
  const r = renderMarkdown(post.content);
  const related = all.filter((p) => p.id !== post.id && (p.category === post.category || p.tags.some((t) => post.tags.includes(t)))).slice(0, 3);
  const dishes = (menu?.items ?? []).filter((d) => post.relatedMenuIds?.includes(d.id));
  const updated = post.updatedAt - (post.publishedAt ?? 0) > 86400000;

  return (
    <main>
      <JsonLd data={graph(blogPosting(post, r), ...(post.faqs?.length ? [faqPage(post.faqs)] : []))} />
      <article>
        <header className="bg-cream-100 pt-32 pb-12 md:pt-40">
          <div className="mx-auto max-w-3xl px-5 sm:px-8">
            <Breadcrumbs items={[{ name: "Blog", path: "/blog" }, { name: post.category, path: `/blog/category/${categorySlug(post.category)}` }, { name: post.title, path: `/blog/${post.slug}` }]} />
            <h1 className="mt-8 font-display text-[clamp(2.3rem,5.5vw,4rem)] leading-[1.02] font-medium tracking-[-0.03em]">{post.title}</h1>
            <p className="mt-5 text-xl leading-relaxed text-ink/65">{post.excerpt}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink/55">
              <span>By <b className="text-ink">{post.authorName}</b></span>
              <time dateTime={new Date(post.publishedAt ?? post.createdAt).toISOString()}>{formatDate(post.publishedAt)}</time>
              {updated && <span>Updated <time dateTime={new Date(post.updatedAt).toISOString()}>{formatDate(post.updatedAt)}</time></span>}
              <span>{r.readingMinutes} min read</span>
            </div>
          </div>
        </header>
        {post.coverImage && (
          <div className="mx-auto max-w-5xl px-5 sm:px-8">
            <img src={post.coverImage} alt={post.coverAlt || ""} className="-mt-2 aspect-[16/9] w-full rounded-[2rem] object-cover" fetchPriority="high" />
          </div>
        )}
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_16rem]">
          <div className="prose-leafli min-w-0 max-w-3xl" dangerouslySetInnerHTML={{ __html: r.html }} />
          <aside className="space-y-8 lg:sticky lg:top-28 lg:self-start">
            {r.toc.length > 2 && (
              <nav aria-label="On this page" className="text-sm">
                <p className="mb-3 font-semibold">On this page</p>
                <ul className="space-y-2 border-l border-ink/10">
                  {r.toc.map((t) => (
                    <li key={t.id} className={t.level === 3 ? "pl-7" : "pl-4"}>
                      <a href={`#${t.id}`} className="text-ink/60 hover:text-leaf-700">{t.text}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            {dishes.length > 0 && (
              <div className="rounded-[1.5rem] bg-lime-300/40 p-5">
                <p className="text-sm font-semibold">Try it at Leafli</p>
                <ul className="mt-3 space-y-3">
                  {dishes.map((d) => (
                    <li key={d.id}>
                      <Link href={`/menu/${d.slug}`} className="flex items-center gap-3">
                        <DishImage id={d.id} src={d.imageUrl} alt={d.name} className="size-12" />
                        <span className="text-sm"><b className="block">{d.name}</b>{rupees(d.price)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
        {post.faqs?.length ? (
          <section className="mx-auto max-w-3xl px-5 pb-12 sm:px-8" aria-labelledby="faq-h">
            <h2 id="faq-h" className="font-display text-3xl font-medium">Frequently asked questions</h2>
            <div className="mt-6 divide-y divide-ink/10">
              {post.faqs.map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none justify-between gap-4 font-medium">{f.q}<span className="text-leaf-600 transition-transform group-open:rotate-45">+</span></summary>
                  <p className="mt-2 leading-relaxed text-ink/70">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}
        <footer className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
          {post.tags.length > 0 && <p className="text-sm text-ink/50">Tags: {post.tags.join(" · ")}</p>}
          <div className="mt-8 flex gap-4 rounded-[1.5rem] bg-white p-6 ring-1 ring-ink/5">
            <div className="grid size-14 shrink-0 place-items-center rounded-full bg-lime-400 font-display text-xl text-leaf-900">{post.authorName.slice(0, 1)}</div>
            <div>
              <p className="font-semibold">{post.authorName}</p>
              {post.authorBio && <p className="mt-1 text-sm text-ink/65">{post.authorBio}</p>}
            </div>
          </div>
        </footer>
      </article>
      {related.length > 0 && (
        <section className="border-t border-ink/5 bg-cream-50 py-20" aria-labelledby="rel-h">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <h2 id="rel-h" className="mb-8 font-display text-3xl font-medium">Keep reading</h2>
            <PostCards posts={related} />
          </div>
        </section>
      )}
    </main>
  );
}
