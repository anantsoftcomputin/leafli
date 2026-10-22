"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { costMenuItem, inr } from "@/lib/costing";
import { useItems, useLive, useMenu } from "@/lib/hooks";
import { perMeal, savingsPct } from "@/lib/subscriptions";
import type { Plan } from "@/lib/types";
import { Badge, Button, Card, ErrorText, Field, Input, Modal, PageHeader, Textarea, cx } from "@/components/ui";

export default function PlansAdmin() {
  const { data } = useLive<Plan>("plans");
  const { data: menu } = useMenu();
  const { map } = useItems();
  const [edit, setEdit] = useState<Partial<Plan> | null>(null);
  const plans = [...data].sort((a, b) => a.sortOrder - b.sortOrder);
  // Average food cost of the bowls a plan can send — to sanity-check the per-bowl price.
  const avgCost = (p: Partial<Plan>) => {
    const dishes = menu.filter((m) => (p.eligibleMenuIds?.length ? p.eligibleMenuIds.includes(m.id) : !/dessert/i.test(m.category)));
    return dishes.length ? dishes.reduce((s, m) => s + costMenuItem(m, map).totalCost, 0) / dishes.length : 0;
  };
  return (
    <>
      <PageHeader title="Subscription plans" sub="Each active plan gets its own page at /plans/[slug]." actions={<Button onClick={() => setEdit({ active: true, freeDelivery: true, eligibleMenuIds: [], features: [], sortOrder: plans.length + 1, meals: 10, validityDays: 21 })}>New plan</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const pm = perMeal(p.price, p.meals);
          const fc = pm ? (avgCost(p) / pm) * 100 : 0;
          return (
            <Card key={p.id} title={<span className="flex items-center gap-2">{p.name}{!p.active && <Badge>hidden</Badge>}{p.highlight && <Badge tone="amber">{p.highlight}</Badge>}</span>} actions={<Button size="sm" variant="ghost" onClick={() => setEdit(p)}>Edit</Button>}>
              <div className="text-2xl font-semibold">{inr(pm)}<span className="text-sm font-normal text-stone-500"> /bowl</span></div>
              <p className="text-sm text-stone-600">{inr(p.price)} · {p.meals} bowls · {p.validityDays} days · save {savingsPct(p.price, p.compareAtPrice)}%</p>
              <p className={cx("mt-2 text-xs", fc > 35 ? "text-red-600" : "text-stone-500")}>Est. food cost {fc.toFixed(0)}% per bowl</p>
              <a href={`/plans/${p.slug}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-leaf-700 hover:underline">/plans/{p.slug} ↗</a>
            </Card>
          );
        })}
      </div>
      {edit && <PlanModal value={edit} onClose={() => setEdit(null)} menu={menu.map((m) => ({ id: m.id, name: m.name }))} />}
    </>
  );
}

function PlanModal({ value, onClose, menu }: { value: Partial<Plan>; onClose: () => void; menu: { id: string; name: string }[] }) {
  const [p, setP] = useState(value);
  const [features, setFeatures] = useState((value.features ?? []).join("\n"));
  const [faqs, setFaqs] = useState((value.faqs ?? []).map((f) => `${f.q}\n${f.a}`).join("\n\n"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Plan>(k: K, v: Plan[K]) => setP((x) => ({ ...x, [k]: v }));
  const num = (k: keyof Plan) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, (Number(e.target.value) || 0) as never);
  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/admin/plans", {
        ...p,
        features: features.split("\n").map((s) => s.trim()).filter(Boolean),
        faqs: faqs.split(/\n\s*\n/).map((b) => b.trim().split("\n")).filter((x) => x.length >= 2).map(([q, ...a]) => ({ q: q!.trim(), a: a.join(" ").trim() })),
      });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={p.id ? `Edit ${p.name}` : "New plan"} wide>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2"><Field label="Name"><Input value={p.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field></div>
        <Field label="URL slug"><Input value={p.slug ?? ""} placeholder="auto" onChange={(e) => set("slug", e.target.value)} /></Field>
        <Field label="Badge (optional)"><Input value={p.highlight ?? ""} placeholder="Most popular" onChange={(e) => set("highlight", e.target.value || null)} /></Field>
        <div className="md:col-span-4"><Field label="Tagline"><Input value={p.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} /></Field></div>
        <div className="md:col-span-4"><Field label="Description"><Textarea rows={3} value={p.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field></div>
        <Field label="Bowls"><Input type="number" value={p.meals ?? 0} onChange={num("meals")} /></Field>
        <Field label="Validity (days)"><Input type="number" value={p.validityDays ?? 0} onChange={num("validityDays")} /></Field>
        <Field label="Price excl. GST (₹)"><Input type="number" value={p.price ?? 0} onChange={num("price")} /></Field>
        <Field label="Compare-at price (₹)" hint="Same bowls bought one by one"><Input type="number" value={p.compareAtPrice ?? 0} onChange={num("compareAtPrice")} /></Field>
        <div className="md:col-span-4">
          <Field label="Bowls this plan can send (none selected = all salads)">
            <div className="flex flex-wrap gap-1.5">
              {menu.map((m) => {
                const on = p.eligibleMenuIds?.includes(m.id);
                return <button key={m.id} type="button" onClick={() => set("eligibleMenuIds", on ? p.eligibleMenuIds!.filter((x) => x !== m.id) : [...(p.eligibleMenuIds ?? []), m.id])} className={cx("rounded-full px-2.5 py-1 text-xs", on ? "bg-leaf-700 text-white" : "bg-stone-100 text-stone-600")}>{m.name}</button>;
              })}
            </div>
          </Field>
        </div>
        <div className="md:col-span-2"><Field label="Features (one per line)"><Textarea rows={5} value={features} onChange={(e) => setFeatures(e.target.value)} /></Field></div>
        <div className="md:col-span-2"><Field label="FAQs (question line, answer line, blank line between)"><Textarea rows={5} value={faqs} onChange={(e) => setFaqs(e.target.value)} /></Field></div>
        <div className="md:col-span-2"><Field label="SEO title"><Input value={p.metaTitle ?? ""} onChange={(e) => set("metaTitle", e.target.value)} /></Field></div>
        <div className="md:col-span-2"><Field label="Meta description"><Input value={p.metaDescription ?? ""} onChange={(e) => set("metaDescription", e.target.value)} /></Field></div>
        <Field label="Sort order"><Input type="number" value={p.sortOrder ?? 0} onChange={num("sortOrder")} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={!!p.active} onChange={(e) => set("active", e.target.checked)} /> Active (on sale)</label>
        <div className="md:col-span-4"><ErrorText>{err}</ErrorText></div>
        <div className="md:col-span-4"><Button onClick={save} loading={busy}>Save plan</Button></div>
      </div>
    </Modal>
  );
}
