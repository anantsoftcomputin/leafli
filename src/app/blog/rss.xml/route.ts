import { getPublishedPosts } from "@/lib/server/content";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const revalidate = 300;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** RSS feed for the blog (feed readers, Google Discover/News surfaces). */
export async function GET() {
  const posts = (await getPublishedPosts()).filter((p) => !p.noindex).slice(0, 30);
  const items = posts
    .map(
      (p) => `<item><title>${esc(p.title)}</title><link>${absoluteUrl(`/blog/${p.slug}`)}</link><guid isPermaLink="true">${absoluteUrl(`/blog/${p.slug}`)}</guid><pubDate>${new Date(p.publishedAt ?? p.createdAt).toUTCString()}</pubDate><category>${esc(p.category)}</category><description>${esc(p.excerpt)}</description></item>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${SITE_NAME} Blog</title><link>${absoluteUrl("/blog")}</link><atom:link href="${absoluteUrl("/blog/rss.xml")}" rel="self" type="application/rss+xml"/><description>Healthy eating, salad recipes and nutrition tips from Leafli.</description><language>en-in</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, s-maxage=300" } });
}
