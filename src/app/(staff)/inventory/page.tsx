"use client";

import { useMemo, useState } from "react";
import { doc, limit, orderBy, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { api } from "@/lib/api";
import { formatQty, inr, round2, unitCost } from "@/lib/costing";
import { useItems, useLive, useSuppliers } from "@/lib/hooks";
import type { BaseUnit, StockItem, StockMovement } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, ErrorText, Field, Input, Modal, PageHeader, Select, Td, Th, cx } from "@/components/ui";

export default function InventoryPage() {
  const { profile } = useAuth();
  const canManage = profile?.role === "admin" || profile?.role === "manager";
  const { data: items, map, loading } = useItems();
  const { data: suppliers } = useSuppliers();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "raw" | "prep">("all");
  const [onlyLow, setOnlyLow] = useState(false);
  const [counting, setCounting] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [waste, setWaste] = useState<StockItem | null>(null);
  const [edit, setEdit] = useState<StockItem | "new" | null>(null);
  const [history, setHistory] = useState<StockItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      items
        .filter((i) => i.active !== false)
        .filter((i) => kind === "all" || i.kind === kind)
        .filter((i) => !onlyLow || i.currentStock <= i.reorderLevel)
        .filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()) || i.category.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [items, kind, onlyLow, q],
  );
  const value = items.reduce((s, i) => s + Math.max(i.currentStock, 0) * unitCost(i.id, map), 0);
  const lowCount = items.filter((i) => i.active !== false && i.currentStock <= i.reorderLevel).length;

  async function saveCounts() {
    const list = Object.entries(counts)
      .filter(([, v]) => v !== "")
      .map(([itemId, v]) => ({ itemId, counted: Number(v) }));
    if (!list.length) return setCounting(false);
    setBusy(true);
    setErr(null);
    try {
      await api("/api/inventory/count", { counts: list, note: "Physical stock count" });
      setCounts({});
      setCounting(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Inventory"
        sub={<>Stock value {inr(value)} · <span className={lowCount ? "text-amber-700" : ""}>{lowCount} at or below reorder level</span></>}
        actions={
          canManage && (
            <>
              {counting ? (
                <>
                  <Button variant="ghost" onClick={() => { setCounting(false); setCounts({}); }}>Cancel</Button>
                  <Button onClick={saveCounts} loading={busy}>Save count</Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => setCounting(true)}>Stock count</Button>
                  <Button onClick={() => setEdit("new")}>Add item</Button>
                </>
              )}
            </>
          )
        }
      />
      <ErrorText>{err}</ErrorText>
      <div className="mb-3 flex flex-wrap gap-2">
        <Input placeholder="Search items or categories" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="w-40">
          <option value="all">All items</option>
          <option value="raw">Raw materials</option>
          <option value="prep">Batch preps</option>
        </Select>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Low stock only
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-100 bg-stone-50">
            <tr>
              <Th>Item</Th><Th>Category</Th><Th className="text-right">In stock</Th><Th className="text-right">Reorder at</Th>
              <Th className="text-right">Cost / unit</Th><Th className="text-right">Value</Th>{counting && <Th>Counted</Th>}<Th />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><Td colSpan={8} className="text-stone-500">Loading…</Td></tr>}
            {rows.map((i) => {
              const low = i.currentStock <= i.reorderLevel;
              const uc = unitCost(i.id, map);
              return (
                <tr key={i.id} className="border-b border-stone-50 hover:bg-stone-50">
                  <Td>
                    <button className="text-left font-medium hover:underline" onClick={() => setHistory(i)}>{i.name}</button>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {i.kind === "prep" && <Badge tone="violet">prep</Badge>}
                      {i.costIsEstimate && <Badge tone="amber" title="Placeholder cost — replaced on first PO receipt">est. cost</Badge>}
                      {i.storage === "chilled" && <Badge tone="blue">chilled</Badge>}
                    </div>
                  </Td>
                  <Td className="text-xs text-stone-500">{i.category}</Td>
                  <Td className={cx("text-right tabular-nums", low && "font-semibold text-amber-700", i.currentStock < 0 && "text-red-600")}>{formatQty(i.currentStock, i.unit)}</Td>
                  <Td className="text-right tabular-nums text-stone-500">{formatQty(i.reorderLevel, i.unit)}</Td>
                  <Td className="text-right tabular-nums">
                    {inr(uc * (i.purchaseFactor ?? 1))}
                    <span className="text-xs text-stone-500"> /{i.purchaseUnit ?? i.unit}</span>
                  </Td>
                  <Td className="text-right tabular-nums">{inr(Math.max(i.currentStock, 0) * uc)}</Td>
                  {counting && (
                    <Td>
                      <Input
                        type="number"
                        className="w-28"
                        placeholder={String(round2(i.currentStock))}
                        value={counts[i.id] ?? ""}
                        onChange={(e) => setCounts({ ...counts, [i.id]: e.target.value })}
                      />
                    </Td>
                  )}
                  <Td className="whitespace-nowrap text-right">
                    <Button size="sm" variant="ghost" onClick={() => setWaste(i)}>Waste</Button>
                    {canManage && <Button size="sm" variant="ghost" onClick={() => setEdit(i)}>Edit</Button>}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {counting && <p className="mt-2 text-xs text-stone-500">Enter counted quantities in base units (g / ml / pc). Leave blank to skip. Variances are logged as adjustments.</p>}
      {waste && <WasteModal item={waste} onClose={() => setWaste(null)} />}
      {edit && <EditItemModal item={edit === "new" ? null : edit} suppliers={suppliers} onClose={() => setEdit(null)} />}
      {history && <HistoryModal item={history} onClose={() => setHistory(null)} />}
    </>
  );
}

function WasteModal({ item, onClose }: { item: StockItem; onClose: () => void }) {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("Spoiled");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/inventory/wastage", { itemId: item.id, qty: Number(qty), reason });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={`Record wastage — ${item.name}`}>
      <div className="space-y-3">
        <Field label={`Quantity (${item.unit})`}><Input type="number" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {["Spoiled", "Past use-by", "Temperature abuse", "Dropped / contaminated", "Prep error", "Trim / peel loss", "Quality reject", "Other"].map((r) => <option key={r}>{r}</option>)}
          </Select>
        </Field>
        <ErrorText>{err}</ErrorText>
        <Button onClick={submit} loading={busy} disabled={!(Number(qty) > 0)}>Record wastage</Button>
      </div>
    </Modal>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function EditItemModal({ item, suppliers, onClose }: { item: StockItem | null; suppliers: { id: string; name: string }[]; onClose: () => void }) {
  const [f, setF] = useState<Partial<StockItem>>(
    item ?? { kind: "raw", unit: "g", category: "Produce", reorderLevel: 0, reorderQty: 0, costPerUnit: 0, purchaseUnit: "kg", purchaseFactor: 1000, storage: "chilled", active: true },
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof StockItem>(k: K, v: StockItem[K]) => setF((x) => ({ ...x, [k]: v }));
  const factor = f.purchaseFactor || 1;

  async function save() {
    if (!f.name) return setErr("Name is required");
    setBusy(true);
    setErr(null);
    try {
      const { id: _id, currentStock: _s, ...data } = f as StockItem;
      const clean = Object.fromEntries(Object.entries({ ...data, updatedAt: Date.now() }).filter(([, v]) => v !== undefined));
      if (item) {
        await updateDoc(doc(db, "items", item.id), clean);
      } else {
        await setDoc(doc(db, "items", slug(f.name)), { ...clean, currentStock: 0, costIsEstimate: false });
      }
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={item ? `Edit ${item.name}` : "Add raw material"}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Name"><Input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field></div>
        <Field label="Category"><Input value={f.category ?? ""} onChange={(e) => set("category", e.target.value)} /></Field>
        <Field label="Base unit">
          <Select value={f.unit} disabled={!!item} onChange={(e) => set("unit", e.target.value as BaseUnit)}>
            <option value="g">g</option><option value="ml">ml</option><option value="pc">pc</option>
          </Select>
        </Field>
        <Field label="Purchase unit" hint="e.g. kg, L, tray (30)"><Input value={f.purchaseUnit ?? ""} onChange={(e) => set("purchaseUnit", e.target.value)} /></Field>
        <Field label={`${f.unit} per purchase unit`}><Input type="number" value={f.purchaseFactor ?? 1} onChange={(e) => set("purchaseFactor", Number(e.target.value) || 1)} /></Field>
        {f.kind !== "prep" && (
          <Field label={`Cost per ${f.purchaseUnit || f.unit} (₹)`}>
            <Input type="number" value={round2((f.costPerUnit ?? 0) * factor)} onChange={(e) => setF((x) => ({ ...x, costPerUnit: (Number(e.target.value) || 0) / factor, costIsEstimate: false }))} />
          </Field>
        )}
        <Field label="Supplier">
          <Select value={f.supplierId ?? ""} onChange={(e) => set("supplierId", e.target.value || null)}>
            <option value="">—</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label={`Reorder level (${f.unit})`}><Input type="number" value={f.reorderLevel ?? 0} onChange={(e) => set("reorderLevel", Number(e.target.value) || 0)} /></Field>
        <Field label={`Reorder qty (${f.unit})`}><Input type="number" value={f.reorderQty ?? 0} onChange={(e) => set("reorderQty", Number(e.target.value) || 0)} /></Field>
        <Field label="Shelf life (hours)" hint="Blank if not perishable"><Input type="number" value={f.shelfLifeHours ?? ""} onChange={(e) => set("shelfLifeHours", e.target.value ? Number(e.target.value) : null)} /></Field>
        <Field label="Storage">
          <Select value={f.storage} onChange={(e) => set("storage", e.target.value as StockItem["storage"])}>
            <option value="chilled">Chilled (≤4°C)</option><option value="ambient">Ambient</option><option value="frozen">Frozen</option>
          </Select>
        </Field>
        <div className="col-span-2"><Field label="Allergens (comma separated)"><Input value={(f.allergens ?? []).join(", ")} onChange={(e) => set("allergens", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></Field></div>
        {item && (
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.active !== false} onChange={(e) => set("active", e.target.checked)} /> Active
          </label>
        )}
        {f.kind === "prep" && <p className="col-span-2 text-xs text-stone-500">Prep recipes and yields are edited under Menu & recipes → Prep recipes.</p>}
        <div className="col-span-2"><ErrorText>{err}</ErrorText></div>
        <div className="col-span-2"><Button onClick={save} loading={busy}>Save</Button></div>
      </div>
    </Modal>
  );
}

const MOVE_TONE: Record<string, "green" | "red" | "amber" | "gray" | "blue" | "violet"> = {
  purchase: "green", sale: "blue", sale_reversal: "blue", production_in: "violet", production_out: "violet", wastage: "red", adjustment: "amber",
};

function HistoryModal({ item, onClose }: { item: StockItem; onClose: () => void }) {
  const { data } = useLive<StockMovement>("stockMovements", [where("itemId", "==", item.id), orderBy("at", "desc"), limit(100)], item.id);
  return (
    <Modal open onClose={onClose} title={`${item.name} — stock history`} wide>
      <table className="w-full text-sm">
        <thead><tr><Th>When</Th><Th>Type</Th><Th className="text-right">Qty</Th><Th className="text-right">Value</Th><Th>Ref / note</Th><Th>By</Th></tr></thead>
        <tbody>
          {data.map((m) => (
            <tr key={m.id} className="border-t border-stone-100">
              <Td className="text-xs">{new Date(m.at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</Td>
              <Td><Badge tone={MOVE_TONE[m.type]}>{m.type.replace("_", " ")}</Badge></Td>
              <Td className={cx("text-right tabular-nums", m.qty < 0 ? "text-red-600" : "text-leaf-700")}>{m.qty > 0 ? "+" : ""}{formatQty(m.qty, item.unit)}</Td>
              <Td className="text-right tabular-nums">{inr(m.value)}</Td>
              <Td className="text-xs text-stone-500">{m.note}</Td>
              <Td className="text-xs text-stone-500">{(m as unknown as { byName?: string }).byName}</Td>
            </tr>
          ))}
          {!data.length && <tr><Td colSpan={6} className="text-stone-500">No movements yet.</Td></tr>}
        </tbody>
      </table>
    </Modal>
  );
}
