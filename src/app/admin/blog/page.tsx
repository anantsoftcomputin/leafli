"use client";

import Link from "next/link";
import { useLive } from "@/lib/hooks";
import { analyzePost } from "@/lib/seo";
import type { Post } from "@/lib/types";
import { Badge, Button, Empty, PageHeader, Td, Th } from "@/components/ui";

const STATUS_TONE = { draft: "gray", published: "green", scheduled: "blue" } as const;

export default function BlogAdmin() {
  const { data: posts, loading } = useLive<Post>("posts");
  const sorted = [...posts].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <>
      <PageHeader
        title="Blog & SEO"
        sub="Write articles that answer what your customers search for. Each post gets its own page, structured data and sitemap entry."
        actions={<Link href="/admin/blog/new"><Button>New post</Button></Link>}
      />
      {loading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : !sorted.length ? (
        <Empty>No posts yet. Write your first article.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 bg-stone-50">
              <tr><Th>Title</Th><Th>Status</Th><Th>SEO</Th><Th>Focus keyword</Th><Th>Updated</Th><Th /></tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const { score } = analyzePost(p, p.wordCount ?? 0);
                return (
                  <tr key={p.id} className="border-b border-stone-50 hover:bg-stone-50">
                    <Td>
                      <Link href={`/admin/blog/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                      <div className="text-xs text-stone-500">/blog/{p.slug} · {p.category}</div>
                    </Td>
                    <Td><Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge></Td>
                    <Td><Badge tone={score >= 80 ? "green" : score >= 60 ? "amber" : "red"}>{score}</Badge></Td>
                    <Td className="text-xs">{p.focusKeyword || <span className="text-stone-400">—</span>}</Td>
                    <Td className="text-xs text-stone-500">{new Date(p.updatedAt).toLocaleDateString("en-IN")}</Td>
                    <Td className="text-right">
                      {p.status === "published" && <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="text-xs text-leaf-700 hover:underline">View ↗</a>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
