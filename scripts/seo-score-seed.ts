// Prints the SEO analyser's score for the starter posts:  npx tsx scripts/seo-score-seed.ts
import { renderMarkdown } from "../src/lib/markdown";
import { SEED_POSTS } from "../src/lib/seed/posts";
import { analyzePost } from "../src/lib/seo";

for (const p of SEED_POSTS) {
  const r = renderMarkdown(p.content);
  const { score, checks } = analyzePost({ ...p, coverImage: "x" }, r.wordCount);
  console.log(`${score}/100  ${p.slug}  (${r.wordCount} words, ${r.toc.length} headings)`);
  for (const c of checks.filter((c) => c.status !== "good")) console.log(`        ${c.status}: ${c.label}`);
}
