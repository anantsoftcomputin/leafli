import Link from "next/link";

export const POSTS_PER_PAGE = 9;

/** Slice for one page; null when the page number is out of range (→ 404). */
export function paginate<T>(items: T[], page: number) {
  const pages = Math.max(1, Math.ceil(items.length / POSTS_PER_PAGE));
  if (!Number.isInteger(page) || page < 1 || page > pages) return null;
  return { items: items.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE), page, pages };
}

/** /blog → /blog/page/2 …; page 1 is always the bare base path (one canonical URL). */
export const pageHref = (base: string, page: number) => (page <= 1 ? base : `${base}/page/${page}`);

/** Crawlable numbered pagination (plain links, so search engines can reach every post). */
export function Pagination({ base, page, pages }: { base: string; page: number; pages: number }) {
  if (pages <= 1) return null;
  // First, last, and the current page's neighbours; gaps become "…".
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const pill = "grid h-11 min-w-11 place-items-center rounded-full px-4 text-sm font-semibold transition-colors";
  return (
    <nav aria-label="Blog pages" className="mt-14 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={pageHref(base, page - 1)} rel="prev" className={`${pill} bg-white text-ink/70 ring-1 ring-ink/10 hover:ring-ink/30`}>← Newer</Link>
      ) : null}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - nums[i - 1]! > 1 && <span className="px-1 text-ink/40" aria-hidden>…</span>}
          {n === page ? (
            <span aria-current="page" className={`${pill} bg-leaf-700 text-cream-50`}>{n}</span>
          ) : (
            <Link href={pageHref(base, n)} aria-label={`Page ${n}`} className={`${pill} bg-white text-ink/70 ring-1 ring-ink/10 hover:ring-ink/30`}>{n}</Link>
          )}
        </span>
      ))}
      {page < pages ? (
        <Link href={pageHref(base, page + 1)} rel="next" className={`${pill} bg-white text-ink/70 ring-1 ring-ink/10 hover:ring-ink/30`}>Older →</Link>
      ) : null}
    </nav>
  );
}
