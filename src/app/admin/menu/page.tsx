"use client";

import { useState } from "react";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { api } from "@/lib/api";
import { costMenuItem, formatQty, inr, unitCost, type ItemMap } from "@/lib/costing";
import { useItems, useMenu } from "@/lib/hooks";
import type { BaseUnit, MenuItem, RecipeLine, StockItem } from "@/lib/types";
import { DietDot } from "@/components/DietDot";
import { Badge, Button, ErrorText, Field, Input, Modal, PageHeader, Select, Textarea, Th, Td, cx } from "@/components/ui";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function MenuPage() {
  const [tab, setTab] = useState<"menu" | "prep">("menu");
  const { data: menu } = useMenu();
  const { data: items, map } = useItems();
  const [editMenu, setEditMenu] = useState<MenuItem | "new" | null>(null);
  const [editPrep, setEditPrep] = useState<StockItem | "new" | null>(null);

  return (
    <>
      <PageHeader
        title="Menu & recipes"
        sub="Recipes are the bill of materials: every order and batch deducts exactly these quantities. Items marked TBC are still open in the SOPs."
        actions={<Button onClick={() => (tab === "menu" ? setEditMenu("new") : setEditPrep("new"))}>{tab === "menu" ? "Add dish" : "Add prep recipe"}</Button>}
      />
      <div className="mb-4 flex gap-1 border-b border-stone-200">
        {(["menu", "prep"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cx("-mb-px border-b-2 px-4 py-2 text-sm", tab === t ? "border-leaf-700 font-medium text-leaf-800" : "border-transparent text-stone-500")}>
            {t === "menu" ? "Dishes" : "Prep recipes (sub-recipes)"}
          </button>
        ))}
      </div>

      {tab === "menu" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...menu].sort((a, b) => a.sortOrder - b.sortOrder).map((m) => (
            <MenuCard key={m.id} m={m} map={map} onEdit={() => setEditMenu(m)} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 bg-stone-50"><tr><Th>Prep</Th><Th>SOP</Th><Th className="text-right">Batch yield</Th><Th className="text-right">Cost / unit</Th><Th className="text-right">Batch cost</Th><Th>Shelf life</Th><Th /></tr></thead>
            <tbody>
              {items.filter((i) => i.kind === "prep").sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                <tr key={p.id} className="border-b border-stone-50">
                  <Td>
                    <div className="font-medium">{p.name}</div>
                    <div className="flex gap-1">
                      {p.yieldIsEstimate && <Badge tone="amber">yield est.</Badge>}
                      {p.recipe?.some((r) => r.tbc) && <Badge tone="amber">has TBC qty</Badge>}
                    </div>
                  </Td>
                  <Td className="text-xs text-stone-500">{p.sopRef}</Td>
                  <Td className="text-right tabular-nums">{formatQty(p.yieldQty ?? 0, p.unit)}</Td>
                  <Td className="text-right tabular-nums">{inr(unitCost(p.id, map))}/{p.unit}</Td>
                  <Td className="text-right tabular-nums">{inr(unitCost(p.id, map) * (p.yieldQty ?? 0))}</Td>
                  <Td className="text-xs">{p.shelfLifeHours ? `${p.shelfLifeHours} h` : "—"}</Td>
                  <Td><Button size="sm" variant="ghost" onClick={() => setEditPrep(p)}>Edit</Button></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editMenu && <MenuEditor item={editMenu === "new" ? null : editMenu} items={items} map={map} onClose={() => setEditMenu(null)} />}
      {editPrep && <PrepEditor item={editPrep === "new" ? null : editPrep} items={items} map={map} onClose={() => setEditPrep(null)} />}
    </>
  );
}

function MenuCard({ m, map, onEdit }: { m: MenuItem; map: ItemMap; onEdit: () => void }) {
  const c = costMenuItem(m, map);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      await api(`/api/menu/${m.id}/availability`, { available: !m.available });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2">
          <DietDot diet={m.diet} />
          <div>
            <div className="font-semibold">{m.name}</div>
            <div className="text-xs text-stone-500">{m.category} · {m.sopRef}</div>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={busy}
          className={cx("relative h-5 w-9 shrink-0 rounded-full transition", m.available ? "bg-leaf-600" : "bg-stone-300")}
          title={m.available ? "In stock — click to mark out of stock" : "Out of stock — click to enable"}
        >
          <span className={cx("absolute top-0.5 size-4 rounded-full bg-white transition", m.available ? "left-4.5" : "left-0.5")} />
        </button>
      </div>
      <dl className="my-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-stone-50 p-2"><dt className="text-[10px] text-stone-500">Price</dt><dd className="font-semibold">{inr(m.price)}</dd></div>
        <div className="rounded-lg bg-stone-50 p-2"><dt className="text-[10px] text-stone-500">Cost</dt><dd className="font-semibold">{inr(c.totalCost)}</dd></div>
        <div className={cx("rounded-lg p-2", c.foodCostPct > 35 ? "bg-red-50" : c.foodCostPct > 30 ? "bg-amber-50" : "bg-leaf-50")}>
          <dt className="text-[10px] text-stone-500">Food cost</dt><dd className="font-semibold">{c.foodCostPct}%</dd>
        </div>
      </dl>
      <div className="mb-3 flex flex-wrap gap-1">
        {(["pos", "website", "zomato"] as const).map((ch) => m.channels?.[ch] && <Badge key={ch}>{ch}</Badge>)}
        {c.hasEstimates && <Badge tone="amber">uses est. costs</Badge>}
      </div>
      {!!m.openItems?.length && (
        <ul className="mb-3 space-y-0.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
          {m.openItems.map((o) => <li key={o}>• {o}</li>)}
        </ul>
      )}
      <Button size="sm" variant="secondary" className="mt-auto" onClick={onEdit}>Edit dish & recipe</Button>
    </div>
  );
}

function RecipeLinesEditor({ value, onChange, items, map, exclude }: { value: RecipeLine[]; onChange: (v: RecipeLine[]) => void; items: StockItem[]; map: ItemMap; exclude?: string }) {
  const opts = items.filter((i) => i.id !== exclude && i.active !== false).sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "prep" ? -1 : 1));
  const upd = (i: number, p: Partial<RecipeLine>) => onChange(value.map((l, j) => (j === i ? { ...l, ...p } : l)));
  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <thead><tr><Th>Ingredient</Th><Th>Qty</Th><Th>TBC</Th><Th className="text-right">Cost</Th><Th /></tr></thead>
        <tbody>
          {value.map((l, i) => {
            const it = map.get(l.itemId);
            return (
              <tr key={i} className="border-t border-stone-100">
                <Td>
                  <Select value={l.itemId} onChange={(e) => upd(i, { itemId: e.target.value })}>
                    <option value="">Choose…</option>
                    <optgroup label="Prep (batch-made)">{opts.filter((o) => o.kind === "prep").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>
                    <optgroup label="Raw & packaging">{opts.filter((o) => o.kind === "raw").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>
                  </Select>
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <Input type="number" className="w-24" value={l.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) || 0 })} />
                    <span className="text-xs text-stone-500">{it?.unit}</span>
                  </div>
                </Td>
                <Td><input type="checkbox" checked={!!l.tbc} onChange={(e) => upd(i, { tbc: e.target.checked })} /></Td>
                <Td className="text-right tabular-nums">{inr(l.qty * unitCost(l.itemId, map))}</Td>
                <Td><button className="text-stone-400 hover:text-red-600" onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button></Td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Button size="sm" variant="secondary" onClick={() => onChange([...value, { itemId: "", qty: 0 }])}>+ Ingredient</Button>
    </div>
  );
}

function MenuEditor({ item, items, map, onClose }: { item: MenuItem | null; items: StockItem[]; map: ItemMap; onClose: () => void }) {
  const [f, setF] = useState<MenuItem>(
    item ?? {
      id: "", name: "", description: "", category: "Salads", price: 0, available: true,
      channels: { pos: true, website: true, zomato: true }, recipe: [], packagingCost: 0, allergens: [], diet: "veg", sortOrder: 99,
    },
  );
  const [assembly, setAssembly] = useState((item?.assembly ?? []).join("\n"));
  const [open, setOpen] = useState((item?.openItems ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const c = costMenuItem(f, map);
  const zPrice = f.channelPrice?.zomato;

  async function upload(file: File) {
    setBusy(true);
    try {
      const r = ref(storage, `menu/${slug(f.name || "dish")}-${Date.now()}`);
      await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(r);
      setF({ ...f, imageUrl: url, photoUrl: url });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!f.name || !(f.price > 0)) return setErr("Name and price are required");
    if (f.recipe.some((l) => !l.itemId)) return setErr("Choose an ingredient on every recipe line");
    setBusy(true);
    setErr(null);
    try {
      const { id: _id, ...data } = f;
      const payload = JSON.parse(JSON.stringify({ ...data, assembly: lines(assembly), openItems: lines(open) }));
      if (!payload.slug) payload.slug = slug(f.name);
      if (item) await updateDoc(doc(db, "menuItems", item.id), payload);
      else await setDoc(doc(db, "menuItems", slug(f.name)), payload);
      api("/api/admin/revalidate", { kind: "menu" }).catch(() => {});
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={item ? `Edit ${item.name}` : "Add dish"} wide>
      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
            <div className="col-span-2"><Field label="Description (shown to customers)"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></div>
            <Field label="URL slug" hint="leafli.in/menu/…  — changing it breaks old links">
              <Input value={f.slug ?? ""} placeholder={slug(f.name || "dish")} onChange={(e) => setF({ ...f, slug: slug(e.target.value) })} />
            </Field>
            <Field label="Category"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
            <Field label="Diet">
              <Select value={f.diet} onChange={(e) => setF({ ...f, diet: e.target.value as MenuItem["diet"] })}>
                <option value="veg">Veg</option><option value="egg">Contains egg</option><option value="nonveg">Non-veg</option>
              </Select>
            </Field>
            <Field label="Price excl. GST (₹)"><Input type="number" value={f.price || ""} onChange={(e) => setF({ ...f, price: Number(e.target.value) || 0 })} /></Field>
            <Field label="Zomato price (₹)" hint="Blank = same as above">
              <Input type="number" value={zPrice ?? ""} onChange={(e) => setF({ ...f, channelPrice: { ...f.channelPrice, zomato: e.target.value ? Number(e.target.value) : undefined } })} />
            </Field>
            <Field label="Zomato item ID" hint="Maps incoming Zomato orders to this dish"><Input value={f.zomatoItemId ?? ""} onChange={(e) => setF({ ...f, zomatoItemId: e.target.value || undefined })} /></Field>
            <Field label="Sort order"><Input type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: Number(e.target.value) || 0 })} /></Field>
            <Field label="Extra packaging cost (₹)" hint="If not tracked as a stock item"><Input type="number" value={f.packagingCost} onChange={(e) => setF({ ...f, packagingCost: Number(e.target.value) || 0 })} /></Field>
            <Field label="Photo">
              <input type="file" accept="image/*" className="text-xs" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </Field>
            <div className="col-span-2 flex flex-wrap gap-4 text-sm">
              {(["pos", "website", "zomato"] as const).map((ch) => (
                <label key={ch} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={f.channels[ch]} onChange={(e) => setF({ ...f, channels: { ...f.channels, [ch]: e.target.checked } })} /> Sell on {ch}
                </label>
              ))}
            </div>
            <div className="col-span-2"><Field label="Ingredients shown to customers (comma separated)"><Input value={(f.ingredients ?? []).join(", ")} onChange={(e) => setF({ ...f, ingredients: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></Field></div>
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <Field label="Calories (kcal)"><Input type="number" value={f.nutrition?.calories ?? ""} onChange={(e) => setF({ ...f, nutrition: { ...f.nutrition, calories: e.target.value ? Number(e.target.value) : undefined } })} /></Field>
              <Field label="Protein (g)"><Input type="number" value={f.nutrition?.protein ?? ""} onChange={(e) => setF({ ...f, nutrition: { ...f.nutrition, protein: e.target.value ? Number(e.target.value) : undefined } })} /></Field>
            </div>
            <div className="col-span-2"><Field label="Allergens (comma separated)"><Input value={f.allergens.join(", ")} onChange={(e) => setF({ ...f, allergens: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></Field></div>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold">Recipe per portion (incl. packaging)</h4>
            <RecipeLinesEditor value={f.recipe} onChange={(recipe) => setF({ ...f, recipe })} items={items} map={map} />
          </div>
          <Field label="Assembly steps (one per line — shown on the kitchen display)"><Textarea rows={5} value={assembly} onChange={(e) => setAssembly(e.target.value)} /></Field>
          <Field label="Open items to confirm (one per line)"><Textarea rows={3} value={open} onChange={(e) => setOpen(e.target.value)} /></Field>
        </div>
        <aside className="space-y-2 self-start rounded-xl bg-stone-50 p-4 text-sm lg:sticky lg:top-0">
          {f.imageUrl && <img src={f.imageUrl} alt="" className="mb-2 aspect-video w-full rounded-lg object-cover" />}
          <h4 className="font-semibold">Costing</h4>
          <Row k="Ingredients + packaging" v={inr(c.foodCost)} />
          {c.packagingCost > 0 && <Row k="Extra packaging" v={inr(c.packagingCost)} />}
          <Row k="Total cost" v={inr(c.totalCost)} b />
          <Row k="Price" v={inr(f.price)} />
          <Row k="Food cost %" v={`${c.foodCostPct}%`} b />
          <Row k="Gross margin" v={`${inr(c.grossMargin)} (${c.grossMarginPct}%)`} />
          {zPrice ? <Row k="Zomato food cost %" v={`${costMenuItem(f, map, zPrice).foodCostPct}%`} /> : null}
          <p className="pt-2 text-xs text-stone-500">Target 25–32% for salads. Costs marked “est.” are placeholders until the first PO is received.</p>
          <ErrorText>{err}</ErrorText>
          <Button className="w-full" onClick={save} loading={busy}>Save dish</Button>
        </aside>
      </div>
    </Modal>
  );
}

function Row({ k, v, b }: { k: string; v: string; b?: boolean }) {
  return <div className={cx("flex justify-between", b && "font-semibold")}><span className="text-stone-600">{k}</span><span className="tabular-nums">{v}</span></div>;
}

function PrepEditor({ item, items, map, onClose }: { item: StockItem | null; items: StockItem[]; map: ItemMap; onClose: () => void }) {
  const [f, setF] = useState<Partial<StockItem>>(
    item ?? { kind: "prep", unit: "g", category: "Dressings & sauces", recipe: [], yieldQty: 0, reorderLevel: 0, reorderQty: 0, storage: "chilled", active: true, costPerUnit: 0 },
  );
  const [method, setMethod] = useState((item?.method ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const batchCost = (f.recipe ?? []).reduce((s, l) => s + l.qty * unitCost(l.itemId, map), 0);

  async function save() {
    if (!f.name || !(f.yieldQty! > 0)) return setErr("Name and batch yield are required");
    setBusy(true);
    setErr(null);
    try {
      const { id: _id, currentStock: _s, ...data } = f as StockItem;
      const payload = JSON.parse(JSON.stringify({ ...data, method: lines(method), costPerUnit: f.yieldQty ? batchCost / f.yieldQty : 0, updatedAt: Date.now() }));
      if (item) await updateDoc(doc(db, "items", item.id), payload);
      else await setDoc(doc(db, "items", slug(f.name)), { ...payload, currentStock: 0 });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={item ? `Edit ${item.name}` : "Add prep recipe"} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2"><Field label="Name"><Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
          <Field label="Category"><Input value={f.category ?? ""} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
          <Field label="SOP ref"><Input value={f.sopRef ?? ""} onChange={(e) => setF({ ...f, sopRef: e.target.value })} /></Field>
          <Field label="Unit">
            <Select value={f.unit} disabled={!!item} onChange={(e) => setF({ ...f, unit: e.target.value as BaseUnit })}>
              <option value="g">g</option><option value="ml">ml</option><option value="pc">pc</option>
            </Select>
          </Field>
          <Field label={`Batch yield (${f.unit})`}><Input type="number" value={f.yieldQty ?? 0} onChange={(e) => setF({ ...f, yieldQty: Number(e.target.value) || 0, yieldIsEstimate: false })} /></Field>
          <Field label="Shelf life (h)"><Input type="number" value={f.shelfLifeHours ?? ""} onChange={(e) => setF({ ...f, shelfLifeHours: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label={`Par level (${f.unit})`}><Input type="number" value={f.reorderLevel ?? 0} onChange={(e) => setF({ ...f, reorderLevel: Number(e.target.value) || 0 })} /></Field>
        </div>
        <RecipeLinesEditor value={f.recipe ?? []} onChange={(recipe) => setF({ ...f, recipe })} items={items} map={map} exclude={item?.id} />
        <p className="text-sm">Batch cost <b>{inr(batchCost)}</b> · per {f.unit} <b>{inr(f.yieldQty ? batchCost / f.yieldQty : 0)}</b></p>
        <Field label="Method (one step per line)"><Textarea rows={6} value={method} onChange={(e) => setMethod(e.target.value)} /></Field>
        <Field label="Quality standard"><Input value={f.qualityStandard ?? ""} onChange={(e) => setF({ ...f, qualityStandard: e.target.value })} /></Field>
        <Field label="Allergens (comma separated)"><Input value={(f.allergens ?? []).join(", ")} onChange={(e) => setF({ ...f, allergens: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></Field>
        <ErrorText>{err}</ErrorText>
        <Button onClick={save} loading={busy}>Save prep recipe</Button>
      </div>
    </Modal>
  );
}
