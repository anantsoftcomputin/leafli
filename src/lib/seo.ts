// SEO analysis for blog posts (runs live in the admin editor) — based on Google
// Search Central guidance: unique descriptive titles, compelling meta descriptions,
// helpful people-first content (E-E-A-T), descriptive alt text, crawlable links,
// structured data, and fresh dates.
import type { Post } from "./types";

export interface SeoCheck {
  id: string;
  label: string;
  status: "good" | "warn" | "bad";
  tip?: string;
}

const norm = (s = "") => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
const has = (hay: string | undefined, needle: string) => !!needle && norm(hay).includes(norm(needle));

export const TITLE_RANGE = [30, 60] as const;
export const DESC_RANGE = [120, 160] as const;

export function effectiveTitle(p: Pick<Post, "metaTitle" | "title">) {
  return (p.metaTitle || p.title || "").trim();
}
export function effectiveDescription(p: Pick<Post, "metaDescription" | "excerpt">) {
  return (p.metaDescription || p.excerpt || "").trim();
}

export function analyzePost(p: Partial<Post>, wordCount: number): { score: number; checks: SeoCheck[] } {
  const kw = (p.focusKeyword ?? "").trim();
  const title = effectiveTitle({ metaTitle: p.metaTitle, title: p.title ?? "" });
  const desc = effectiveDescription({ metaDescription: p.metaDescription, excerpt: p.excerpt ?? "" });
  const body = p.content ?? "";
  const firstPara = body.split(/\n\s*\n/).find((b) => b.trim() && !b.trim().startsWith("#") && !b.trim().startsWith("!")) ?? "";
  const h2s = [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]!);
  const h1InBody = /^#\s+/m.test(body);
  const imgs = [...body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
  const imgsNoAlt = imgs.filter((m) => !m[1]!.trim()).length;
  const links = [...body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1]!);
  const internal = links.filter((l) => l.startsWith("/") || l.includes("leafli.in")).length;
  const external = links.filter((l) => /^https?:\/\//.test(l) && !l.includes("leafli.in")).length;
  const kwCount = kw ? (norm(body).match(new RegExp(norm(kw).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length : 0;
  const density = wordCount ? (kwCount * kw.split(/\s+/).length * 100) / wordCount : 0;

  const c: SeoCheck[] = [];
  const add = (id: string, label: string, ok: boolean | "warn", tip?: string) =>
    c.push({ id, label, status: ok === true ? "good" : ok === "warn" ? "warn" : "bad", tip: ok === true ? undefined : tip });

  add("kw", "Focus keyword set", !!kw, "Pick the one search phrase this post should rank for, e.g. “high protein salad delivery”.");
  add(
    "title-len",
    `SEO title length (${title.length} chars)`,
    title.length >= TITLE_RANGE[0] && title.length <= TITLE_RANGE[1] ? true : title.length ? "warn" : false,
    `Aim for ${TITLE_RANGE[0]}–${TITLE_RANGE[1]} characters so Google doesn't truncate it.`,
  );
  add(
    "desc-len",
    `Meta description length (${desc.length} chars)`,
    desc.length >= DESC_RANGE[0] && desc.length <= DESC_RANGE[1] ? true : desc.length ? "warn" : false,
    `Write ${DESC_RANGE[0]}–${DESC_RANGE[1]} characters that make someone want to click.`,
  );
  if (kw) {
    add("kw-title", "Keyword in SEO title", has(title, kw) ? true : "warn", "Include the focus keyword, ideally near the start.");
    add("kw-desc", "Keyword in meta description", has(desc, kw) ? true : "warn", "Google bolds matching words in the snippet.");
    add("kw-slug", "Keyword in URL slug", has((p.slug ?? "").replace(/-/g, " "), kw) ? true : "warn", "Keep the slug short and include the keyword.");
    add("kw-intro", "Keyword in the first paragraph", has(firstPara, kw) ? true : "warn", "Mention the topic early so readers (and Google) know what the post covers.");
    add("kw-h2", "Keyword in a subheading", h2s.some((h) => has(h, kw)) ? true : "warn", "Use the keyword (or a close variant) in at least one ## heading.");
    add(
      "kw-density",
      `Keyword usage (${kwCount}× · ${density.toFixed(1)}%)`,
      kwCount >= 2 && density <= 2.5 ? true : "warn",
      density > 2.5 ? "Too many repeats reads as keyword stuffing — write naturally." : "Use the keyword a few times naturally.",
    );
  }
  add("words", `Content length (${wordCount} words)`, wordCount >= 800 ? true : wordCount >= 400 ? "warn" : false, "Helpful, in-depth posts rank better — aim for 800+ words that fully answer the question.");
  add("h1", "Only one H1 (the title)", !h1InBody, "Start sections with ## (H2) — the post title is already the H1.");
  add("h2", `Subheadings (${h2s.length})`, h2s.length >= 2 ? true : "warn", "Break the post into scannable sections with ## headings.");
  add("cover", "Cover image", !!p.coverImage, "Add a cover image — it's used in Google Discover and social shares (1200×630 or larger).");
  add("cover-alt", "Cover image alt text", !p.coverImage || !!p.coverAlt?.trim(), "Describe the image for screen readers and Google Images.");
  add("img-alt", imgs.length ? `All in-body images have alt text (${imgs.length - imgsNoAlt}/${imgs.length})` : "In-body images have alt text", imgsNoAlt === 0, "Write ![a description](url) for every image.");
  add("internal", `Internal links (${internal})`, internal >= 2 ? true : internal === 1 ? "warn" : false, "Link to 2+ relevant pages, e.g. /menu or a dish page, to spread authority.");
  add("external", `Outbound links to sources (${external})`, external >= 1 ? true : "warn", "Cite a trustworthy source for health/nutrition claims (E-E-A-T).");
  add("author", "Author name & bio", !!p.authorName?.trim() && !!p.authorBio?.trim() ? true : "warn", "Show who wrote it and why they're credible (Experience, Expertise).");
  add("excerpt", "Excerpt written", (p.excerpt ?? "").trim().length >= 50, "Used on the blog list and as a fallback description.");
  add("slug", "Clean URL slug", /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug ?? "") && (p.slug ?? "").length <= 75, "Lowercase words separated by hyphens, under 75 characters.");
  add("index", "Indexable", !p.noindex ? true : "warn", "noindex is on — Google won't show this post.");

  const weight = { good: 1, warn: 0.5, bad: 0 } as const;
  const score = Math.round((c.reduce((s, x) => s + weight[x.status], 0) / c.length) * 100);
  return { score, checks: c };
}
