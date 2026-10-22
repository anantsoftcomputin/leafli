"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useLive, useMenu } from "@/lib/hooks";
import type { Testimonial } from "@/lib/types";
import { Badge, Button, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Textarea } from "@/components/ui";

export default function TestimonialsAdmin() {
  const { data } = useLive<Testimonial>("testimonials");
  const [edit, setEdit] = useState<Partial<Testimonial> | null>(null);
  const items = [...data].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <>
      <PageHeader
        title="Testimonials"
        sub="Real quotes from real customers only — copy them from Google or Zomato reviews, or messages (with permission). Published ones appear on the home page."
        actions={<Button onClick={() => setEdit({ rating: 5, published: true, source: "google", sortOrder: items.length })}>Add testimonial</Button>}
      />
      {!items.length ? (
        <Empty>No testimonials yet. The home page section stays hidden until you publish one.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((t) => (
            <button key={t.id} onClick={() => setEdit(t)} className="rounded-xl border border-stone-200 bg-white p-4 text-left hover:border-leaf-500">
              <div className="flex items-center justify-between">
                <span className="text-amber-500">{"★".repeat(t.rating)}</span>
                <Badge tone={t.published ? "green" : "gray"}>{t.published ? "published" : "hidden"}</Badge>
              </div>
              <p className="mt-2 line-clamp-4 text-sm">“{t.quote}”</p>
              <p className="mt-2 text-xs text-stone-500">{t.name}{t.location && ` · ${t.location}`} · {t.source}</p>
            </button>
          ))}
        </div>
      )}
      {edit && <TestimonialModal value={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function TestimonialModal({ value, onClose }: { value: Partial<Testimonial>; onClose: () => void }) {
  const [t, setT] = useState(value);
  const { data: menu } = useMenu();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Testimonial>(k: K, v: Testimonial[K]) => setT((x) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/admin/testimonials", { ...t, sortOrder: Number(t.sortOrder) || 0 });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!t.id || !confirm("Delete this testimonial?")) return;
    await api(`/api/admin/testimonials?id=${t.id}`, undefined, "DELETE");
    onClose();
  }
  return (
    <Modal open onClose={onClose} title={t.id ? "Edit testimonial" : "Add testimonial"}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Quote"><Textarea rows={4} value={t.quote ?? ""} onChange={(e) => set("quote", e.target.value)} /></Field></div>
        <Field label="Customer name (first name + initial)"><Input value={t.name ?? ""} placeholder="Priya S." onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Area / city"><Input value={t.location ?? ""} onChange={(e) => set("location", e.target.value)} /></Field>
        <Field label="Rating">
          <Select value={t.rating} onChange={(e) => set("rating", Number(e.target.value))}>{[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} ★</option>)}</Select>
        </Field>
        <Field label="Source">
          <Select value={t.source} onChange={(e) => set("source", e.target.value as Testimonial["source"])}>
            <option value="google">Google review</option><option value="zomato">Zomato review</option><option value="instagram">Instagram</option><option value="direct">Direct message</option>
          </Select>
        </Field>
        <Field label="Dish (optional)">
          <Select value={t.dish ?? ""} onChange={(e) => set("dish", e.target.value || undefined)}>
            <option value="">—</option>{menu.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Order"><Input type="number" value={t.sortOrder ?? 0} onChange={(e) => set("sortOrder", Number(e.target.value))} /></Field>
        <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!t.published} onChange={(e) => set("published", e.target.checked)} /> Show on the website</label>
        <div className="col-span-2"><ErrorText>{err}</ErrorText></div>
        <div className="col-span-2 flex gap-2">
          <Button onClick={save} loading={busy}>Save</Button>
          {t.id && <Button variant="ghost" onClick={remove}>Delete</Button>}
        </div>
      </div>
    </Modal>
  );
}
