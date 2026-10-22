import { marked, type Tokens } from "marked";
import sanitizeHtml from "sanitize-html";
import { slugify } from "./site";

export interface Rendered {
  html: string;
  toc: { id: string; text: string; level: 2 | 3 }[];
  wordCount: number;
  readingMinutes: number;
}

/**
 * Markdown → safe HTML for blog posts. Adds heading ids (for the table of
 * contents and #links), lazy-loads images and marks external links.
 */
export function renderMarkdown(md: string): Rendered {
  const toc: Rendered["toc"] = [];
  const seen = new Map<string, number>();
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }: Tokens.Heading) => {
    const text = renderer.parser.parseInline(tokens);
    const plain = text.replace(/<[^>]+>/g, "");
    let id = slugify(plain) || "section";
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n) id = `${id}-${n}`;
    if (depth === 2 || depth === 3) toc.push({ id, text: plain, level: depth });
    return `<h${depth} id="${id}">${text}</h${depth}>`;
  };
  renderer.image = ({ href, title, text }: Tokens.Image) =>
    `<figure><img src="${href}" alt="${text}" loading="lazy" decoding="async"${title ? ` title="${title}"` : ""} />${title ? `<figcaption>${title}</figcaption>` : ""}</figure>`;
  renderer.link = ({ href, title, tokens }: Tokens.Link) => {
    const text = renderer.parser.parseInline(tokens);
    const external = /^https?:\/\//.test(href) && !href.includes("leafli.in");
    return `<a href="${href}"${title ? ` title="${title}"` : ""}${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
  };

  const raw = marked.parse(md ?? "", { renderer, gfm: true, async: false }) as string;
  const html = sanitizeHtml(raw, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "figure", "figcaption", "h1", "h2", "h3", "h4", "del", "ins"]),
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "loading", "decoding", "width", "height"],
      "*": ["id"],
      th: ["align"],
      td: ["align"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
  });
  const wordCount = (md ?? "").replace(/```[\s\S]*?```/g, "").split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
  return { html, toc, wordCount, readingMinutes: Math.max(1, Math.round(wordCount / 220)) };
}
