"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { api } from "@/lib/api";
import { useMenu } from "@/lib/hooks";
import { renderMarkdown } from "@/lib/markdown";
import { analyzePost, DESC_RANGE, effectiveDescription, effectiveTitle, TITLE_RANGE } from "@/lib/seo";
import { slugify } from "@/lib/site";
import type { Post, PostFaq } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, ErrorText, Field, Input, Select, Textarea, cx } from "@/components/ui";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://leafli.in").replace(/^https?:\/\//, "").replace(/\/$/, "");

type Draft = Omit<Post, "id" | "createdAt" | "updatedAt"> & { id?: string };

const blank = (author: string): Draft => ({
  slug: "",
  title: "",
  excerpt: "",
  content: "",
  coverImage: null,
  coverAlt: "",
  authorName: author,
  authorBio: "",
  category: "Healthy eating",
  tags: [],
  status: "draft",
  publishedAt: null,
  metaTitle: "",
  metaDescription: "",
  focusKeyword: "",
  secondaryKeywords: [],
  canonicalUrl: "",
  noindex: false,
  nofollow: false,
  ogTitle: "",
  ogDescription: "",
  ogImage: null,
  twitterCard: "summary_large_image",
  schemaType: "BlogPosting",
  faqs: [],
  relatedMenuIds: [],
});

async function uploadImage(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error("Images must be under 5 MB");
  const name = `blog/${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, "")) || "image"}.${file.name.split(".").pop() || "jpg"}`;
  const r = storageRef(storage, name);
  await uploadBytes(r, file, { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" });
  return getDownloadURL(r);
}

const toLocal = (ts?: number | null) => (ts ? new Date(ts - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export default function PostEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === "new";
  const { profile } = useAuth();
  const router = useRouter();
  const { data: menu } = useMenu();
  const [p, setP] = useState<Draft | null>(isNew ? null : null);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [serp, setSerp] = useState<"desktop" | "mobile">("desktop");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isNew) {
      if (profile) setP((x) => x ?? blank(profile.name));
      return;
    }
    getDoc(doc(db, "posts", id)).then((s) => {
      if (!s.exists()) return setErr("Post not found");
      const data = s.data() as Post;
      setP({ ...blank(data.authorName), ...data, id: s.id });
    });
  }, [id, isNew, profile]);

  const rendered = useMemo(() => renderMarkdown(p?.content ?? ""), [p?.content]);
  const seo = useMemo(() => (p ? analyzePost(p, rendered.wordCount) : { score: 0, checks: [] }), [p, rendered.wordCount]);

  if (!p) return <p className="text-sm text-stone-500">{err ?? "Loading…"}</p>;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setP((x) => (x ? { ...x, [k]: v } : x));
  const title = effectiveTitle({ metaTitle: p.metaTitle, title: p.title });
  const desc = effectiveDescription({ metaDescription: p.metaDescription, excerpt: p.excerpt });
  const ogImg = p.ogImage || p.coverImage;

  /** Wrap the selection (or insert at the cursor) in the markdown editor. */
  function insert(before: string, after = "", placeholder = "") {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const sel = value.slice(a, b) || placeholder;
    const next = value.slice(0, a) + before + sel + after + value.slice(b);
    set("content", next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + before.length, a + before.length + sel.length);
    });
  }

  async function onUpload(file: File | undefined, target: "cover" | "og" | "inline") {
    if (!file) return;
    setErr(null);
    try {
      const url = await uploadImage(file);
      if (target === "cover") set("coverImage", url);
      else if (target === "og") set("ogImage", url);
      else insert(`![`, `](${url})`, "Describe the image");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function save(status?: Draft["status"]) {
    setBusy(true);
    setErr(null);
    setSaved(null);
    try {
      const body = { ...p, status: status ?? p!.status, canonicalUrl: p!.canonicalUrl || "" };
      const r = await api<{ id: string; slug: string }>("/api/admin/posts", body);
      setP((x) => (x ? { ...x, id: r.id, slug: r.slug, status: body.status } : x));
      setSaved(body.status === "published" ? "Published ✓" : body.status === "scheduled" ? "Scheduled ✓" : "Draft saved ✓");
      if (isNew) router.replace(`/admin/blog/${r.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!p?.id || !confirm("Delete this post permanently?")) return;
    await api(`/api/admin/posts?id=${p.id}`, undefined, "DELETE");
    router.replace("/admin/blog");
  }

  const counter = (n: number, [lo, hi]: readonly [number, number]) => (
    <span className={cx("tabular-nums", n === 0 ? "text-stone-400" : n < lo || n > hi ? "text-amber-600" : "text-leaf-600")}>{n}/{hi}</span>
  );
  const tool = "rounded px-2 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-100";

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      {/* ── Main column ─────────────────────────────── */}
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin/blog" className="text-sm text-stone-500 hover:underline">← All posts</Link>
          <Badge tone={p.status === "published" ? "green" : p.status === "scheduled" ? "blue" : "gray"}>{p.status}</Badge>
          {p.status === "published" && p.slug && <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="text-sm text-leaf-700 hover:underline">View live ↗</a>}
        </div>
        <input
          className="w-full bg-transparent font-display text-3xl font-medium outline-none placeholder:text-stone-300"
          placeholder="Post title (H1)"
          value={p.title}
          onChange={(e) => {
            set("title", e.target.value);
            if (!slugTouched) set("slug", slugify(e.target.value));
          }}
        />
        <div className="flex items-center gap-1 text-sm text-stone-500">
          <span>{SITE}/blog/</span>
          <input
            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-stone-200 focus:border-leaf-500 focus:outline-none"
            value={p.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", slugify(e.target.value));
            }}
          />
        </div>
        <Field label="Excerpt / summary" hint="Shown under the title and on the blog list. Also the fallback meta description.">
          <Textarea rows={2} value={p.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
        </Field>

        <div className="rounded-xl border border-stone-200 bg-white">
          <div className="flex flex-wrap items-center gap-1 border-b border-stone-100 px-2 py-1.5">
            {(["write", "preview"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cx("rounded-md px-3 py-1 text-xs font-semibold capitalize", tab === t ? "bg-leaf-700 text-white" : "text-stone-600")}>{t}</button>
            ))}
            {tab === "write" && (
              <div className="ml-2 flex flex-wrap gap-0.5 border-l border-stone-200 pl-2">
                <button className={tool} onClick={() => insert("\n## ", "\n", "Section heading")} title="Heading 2">H2</button>
                <button className={tool} onClick={() => insert("\n### ", "\n", "Sub-heading")} title="Heading 3">H3</button>
                <button className={tool} onClick={() => insert("**", "**", "bold")}>B</button>
                <button className={cx(tool, "italic")} onClick={() => insert("_", "_", "italic")}>I</button>
                <button className={tool} onClick={() => insert("[", "](/menu)", "link text")} title="Link">Link</button>
                <button className={tool} onClick={() => insert("\n- ", "\n", "List item")}>• List</button>
                <button className={tool} onClick={() => insert("\n1. ", "\n", "Step")}>1. List</button>
                <button className={tool} onClick={() => insert("\n> ", "\n", "Quote")}>Quote</button>
                <label className={cx(tool, "cursor-pointer")}>
                  Image
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0], "inline")} />
                </label>
              </div>
            )}
            <span className="ml-auto pr-2 text-xs text-stone-500">{rendered.wordCount} words · {rendered.readingMinutes} min read</span>
          </div>
          {tab === "write" ? (
            <textarea
              ref={area}
              className="min-h-[520px] w-full resize-y rounded-b-xl p-4 font-mono text-sm leading-relaxed outline-none"
              placeholder={"Start with an intro paragraph that mentions your focus keyword.\n\n## First section\n\nUse ## for sections and ### for sub-sections. Link to [our menu](/menu)."}
              value={p.content}
              onChange={(e) => set("content", e.target.value)}
            />
          ) : (
            <div className="prose-leafli min-h-[520px] p-6" dangerouslySetInnerHTML={{ __html: rendered.html }} />
          )}
        </div>

        <Card title="FAQs (optional — adds FAQ structured data)">
          <FaqEditor value={p.faqs ?? []} onChange={(v) => set("faqs", v)} />
        </Card>
      </div>

      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className="space-y-4">
        <Card title="Publish">
          <div className="space-y-3">
            <Field label="Status">
              <Select value={p.status} onChange={(e) => set("status", e.target.value as Draft["status"])}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
              </Select>
            </Field>
            {p.status === "scheduled" && (
              <Field label="Publish at">
                <Input type="datetime-local" value={toLocal(p.publishedAt)} onChange={(e) => set("publishedAt", e.target.value ? new Date(e.target.value).getTime() : null)} />
              </Field>
            )}
            <ErrorText>{err}</ErrorText>
            {saved && <p className="text-sm text-leaf-700">{saved}</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save()} loading={busy}>Save</Button>
              {p.status !== "published" && <Button variant="secondary" onClick={() => save("published")} loading={busy}>Publish now</Button>}
              {p.id && <Button variant="ghost" onClick={remove}>Delete</Button>}
            </div>
          </div>
        </Card>

        <Card title={<span className="flex items-center gap-2">SEO score <Badge tone={seo.score >= 80 ? "green" : seo.score >= 60 ? "amber" : "red"}>{seo.score}/100</Badge></span>}>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-stone-100">
            <div className={cx("h-full rounded-full transition-all", seo.score >= 80 ? "bg-leaf-600" : seo.score >= 60 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${seo.score}%` }} />
          </div>
          <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1 text-xs">
            {seo.checks.map((c) => (
              <li key={c.id} className="flex gap-2">
                <span className={c.status === "good" ? "text-leaf-600" : c.status === "warn" ? "text-amber-500" : "text-red-500"}>{c.status === "good" ? "●" : c.status === "warn" ? "◐" : "○"}</span>
                <span>
                  <span className="text-stone-800">{c.label}</span>
                  {c.tip && <span className="block text-stone-500">{c.tip}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Search appearance" actions={
          <div className="flex rounded-md border border-stone-200 text-xs">
            {(["desktop", "mobile"] as const).map((v) => <button key={v} onClick={() => setSerp(v)} className={cx("px-2 py-0.5 capitalize", serp === v && "bg-stone-100 font-semibold")}>{v}</button>)}
          </div>
        }>
          <div className={cx("rounded-lg border border-stone-100 bg-white p-3", serp === "mobile" && "max-w-[340px]")}>
            <div className="flex items-center gap-2 text-xs text-stone-600">
              <img src="/icon.png" alt="" className="size-6 rounded-full" />
              <div><div className="text-stone-800">Leafli</div><div>{SITE} › blog › {p.slug || "…"}</div></div>
            </div>
            <div className="mt-1 line-clamp-2 text-lg leading-snug text-[#1a0dab]">{title || "Your SEO title"}</div>
            <div className="mt-0.5 line-clamp-2 text-sm text-stone-600">
              {p.publishedAt ? <span className="text-stone-500">{new Date(p.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} — </span> : null}
              {desc || "Your meta description will appear here."}
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <Field label="Focus keyword" hint="The main phrase people search for, e.g. “high protein salad”">
              <Input value={p.focusKeyword ?? ""} onChange={(e) => set("focusKeyword", e.target.value)} />
            </Field>
            <Field label="Secondary keywords (comma separated)">
              <Input value={(p.secondaryKeywords ?? []).join(", ")} onChange={(e) => set("secondaryKeywords", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </Field>
            <Field label="SEO title">
              <Input value={p.metaTitle ?? ""} placeholder={p.title} onChange={(e) => set("metaTitle", e.target.value)} />
              <span className="mt-1 block text-right text-[11px]">{counter(title.length, TITLE_RANGE)}</span>
            </Field>
            <Field label="Meta description">
              <Textarea rows={3} value={p.metaDescription ?? ""} placeholder={p.excerpt} onChange={(e) => set("metaDescription", e.target.value)} />
              <span className="mt-1 block text-right text-[11px]">{counter(desc.length, DESC_RANGE)}</span>
            </Field>
          </div>
        </Card>

        <Card title="Cover image">
          {p.coverImage ? (
            <img src={p.coverImage} alt={p.coverAlt || ""} className="mb-2 aspect-[16/9] w-full rounded-lg object-cover" />
          ) : (
            <p className="mb-2 text-xs text-stone-500">1200×675 or larger. Used on the post, blog list, Google Discover and shares.</p>
          )}
          <div className="flex gap-2">
            <label className="cursor-pointer rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium hover:bg-stone-50">
              {p.coverImage ? "Replace" : "Upload"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0], "cover")} />
            </label>
            {p.coverImage && <button className="text-xs text-stone-500 hover:underline" onClick={() => set("coverImage", null)}>Remove</button>}
          </div>
          <div className="mt-3">
            <Field label="Alt text" hint="Describe the image for screen readers and Google Images.">
              <Input value={p.coverAlt ?? ""} onChange={(e) => set("coverAlt", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Organise">
          <div className="space-y-3">
            <Field label="Category"><Input value={p.category} onChange={(e) => set("category", e.target.value)} /></Field>
            <Field label="Tags (comma separated)"><Input value={p.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></Field>
            <Field label="Feature dishes in the sidebar">
              <div className="flex flex-wrap gap-1.5">
                {menu.map((m) => {
                  const on = p.relatedMenuIds?.includes(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => set("relatedMenuIds", on ? p.relatedMenuIds!.filter((x) => x !== m.id) : [...(p.relatedMenuIds ?? []), m.id])}
                      className={cx("rounded-full px-2.5 py-1 text-xs", on ? "bg-leaf-700 text-white" : "bg-stone-100 text-stone-600")}>
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        </Card>

        <Card title="Author (E-E-A-T)">
          <div className="space-y-3">
            <Field label="Author name"><Input value={p.authorName} onChange={(e) => set("authorName", e.target.value)} /></Field>
            <Field label="Author bio" hint="Who they are and why they know this topic (e.g. head chef, nutritionist).">
              <Textarea rows={2} value={p.authorBio ?? ""} onChange={(e) => set("authorBio", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Social sharing">
          <div className="overflow-hidden rounded-lg border border-stone-200">
            {ogImg ? <img src={ogImg} alt="" className="aspect-[1.91/1] w-full object-cover" /> : <div className="grid aspect-[1.91/1] place-items-center bg-lime-300 text-xs text-leaf-800">Auto-generated share image</div>}
            <div className="bg-stone-50 p-2">
              <div className="text-[10px] text-stone-500 uppercase">{SITE}</div>
              <div className="line-clamp-1 text-sm font-semibold">{p.ogTitle || title || "Title"}</div>
              <div className="line-clamp-1 text-xs text-stone-500">{p.ogDescription || desc}</div>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <Field label="Social title (optional)"><Input value={p.ogTitle ?? ""} placeholder={title} onChange={(e) => set("ogTitle", e.target.value)} /></Field>
            <Field label="Social description (optional)"><Textarea rows={2} value={p.ogDescription ?? ""} placeholder={desc} onChange={(e) => set("ogDescription", e.target.value)} /></Field>
            <div className="flex gap-2">
              <label className="cursor-pointer rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium hover:bg-stone-50">
                Custom share image
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0], "og")} />
              </label>
              {p.ogImage && <button className="text-xs text-stone-500 hover:underline" onClick={() => set("ogImage", null)}>Use cover</button>}
            </div>
            <Field label="X / Twitter card">
              <Select value={p.twitterCard} onChange={(e) => set("twitterCard", e.target.value as Draft["twitterCard"])}>
                <option value="summary_large_image">Large image</option>
                <option value="summary">Summary</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card title="Advanced">
          <div className="space-y-3">
            <Field label="Schema type">
              <Select value={p.schemaType} onChange={(e) => set("schemaType", e.target.value as Draft["schemaType"])}>
                <option value="BlogPosting">BlogPosting (default)</option>
                <option value="Article">Article</option>
                <option value="NewsArticle">NewsArticle</option>
              </Select>
            </Field>
            <Field label="Canonical URL" hint="Only if this post was first published elsewhere.">
              <Input value={p.canonicalUrl ?? ""} placeholder={`https://${SITE}/blog/${p.slug}`} onChange={(e) => set("canonicalUrl", e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!p.noindex} onChange={(e) => set("noindex", e.target.checked)} /> noindex (hide from Google)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!p.nofollow} onChange={(e) => set("nofollow", e.target.checked)} /> nofollow links on this page</label>
          </div>
        </Card>
      </aside>
    </div>
  );
}

function FaqEditor({ value, onChange }: { value: PostFaq[]; onChange: (v: PostFaq[]) => void }) {
  return (
    <div className="space-y-3">
      {value.map((f, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-stone-200 p-3">
          <Input placeholder="Question" value={f.q} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
          <Textarea rows={2} placeholder="Answer" value={f.a} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
          <button className="text-xs text-red-600 hover:underline" onClick={() => onChange(value.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <Button size="sm" variant="secondary" onClick={() => onChange([...value, { q: "", a: "" }])}>+ Add question</Button>
      <p className="text-xs text-stone-500">Answer real questions customers ask. Google shows FAQ rich results only for a few authoritative sites now, but FAQs still help AI overviews and readers.</p>
    </div>
  );
}
