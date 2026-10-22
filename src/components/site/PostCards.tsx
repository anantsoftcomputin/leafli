import Link from "next/link";
import type { Post } from "@/lib/types";

export const formatDate = (ts?: number | null) =>
  ts ? new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";

export function PostCards({ posts }: { posts: Post[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => (
        <article key={p.id} className="group relative flex flex-col overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-ink/5 transition-shadow hover:shadow-2xl hover:shadow-leaf-900/10">
          <div className="aspect-[16/10] overflow-hidden bg-lime-300">
            {p.coverImage ? (
              <img src={p.coverImage} alt={p.coverAlt || ""} loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
            ) : (
              <div className="grid size-full place-items-center p-8 font-display text-2xl leading-tight text-leaf-800 italic">{p.title}</div>
            )}
          </div>
          <div className="flex flex-1 flex-col p-6">
            <p className="text-xs font-semibold tracking-wider text-leaf-600 uppercase">{p.category}</p>
            <h3 className="mt-2 font-display text-xl leading-snug font-medium">
              <Link href={`/blog/${p.slug}`} className="after:absolute after:inset-0">{p.title}</Link>
            </h3>
            <p className="mt-2 line-clamp-3 text-sm text-ink/65">{p.excerpt}</p>
            <p className="mt-auto pt-5 text-xs text-ink/45">
              <time dateTime={new Date(p.publishedAt ?? p.createdAt).toISOString()}>{formatDate(p.publishedAt)}</time>
              {p.readingMinutes ? ` · ${p.readingMinutes} min read` : ""}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
