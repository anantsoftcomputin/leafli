"use client";

import { useState } from "react";
import { limit, orderBy } from "firebase/firestore";
import { api } from "@/lib/api";
import { formatQty, inr, round2 } from "@/lib/costing";
import { useItems, useLive, useSettings, useSuppliers } from "@/lib/hooks";
import type { PurchaseOrder, StockItem, Supplier } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Select, Td, Th } from "@/components/ui";

const STATUS_TONE = { draft: "gray", sent: "blue", received: "green", cancelled: "red" } as const;

/** Show a quantity in purchase units when the item has one (e.g. 3 kg instead of 3000 g). */
function inPurchaseUnits(it: StockItem | undefined, qty: number) {
  if (!it?.purchaseUnit || !it.purchaseFactor || it.purchaseFactor === 1) return formatQty(qty, it?.unit ?? "");
  return `${round2(qty / it.purchaseFactor)} ${it.purchaseUnit}`;
}

export default function PurchasingPage() {
  const { data: items, map } = useItems();
  const { data: suppliers } = useSuppliers();
  const { data: pos } = useLive<PurchaseOrder>("purchaseOrders", [orderBy("createdAt", "desc"), limit(100)]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [receive, setReceive] = useState<PurchaseOrder | null>(null);
  const [creating, setCreating] = useState(false);

  const open = pos.filter((p) => p.status === "draft" || p.status === "sent");
  const onOrder = new Set(open.flatMap((p) => p.lines.map((l) => l.itemId)));
  const supName = new Map(suppliers.map((s) => [s.id, s.name]));
  const suggestions = items
    .filter((i) => i.kind === "raw" && i.active !== false && i.currentStock <= i.reorderLevel)
    .sort((a, b) => (a.supplierId ?? "").localeCompare(b.supplierId ?? "") || a.name.localeCompare(b.name));

  async function generate() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await api<{ created: unknown[]; skippedNoSupplier: string[] }>("/api/purchasing/reorder", {});
      setMsg(
        `${r.created.length} draft PO(s) created.` +
          (r.skippedNoSupplier.length ? ` Skipped (no supplier): ${r.skippedNoSupplier.join(", ")}` : ""),
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(po: PurchaseOrder, status: "sent" | "cancelled") {
    if (status === "cancelled" && !confirm(`Cancel ${po.poNo}?`)) return;
    try {
      await api(`/api/purchasing/${po.id}`, { status }, "PATCH");
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Purchasing"
        sub="Reorder suggestions come from each item's reorder level. Receiving a PO adds stock and updates the weighted-average cost."
        actions={<Button variant="secondary" onClick={() => setCreating(true)}>New PO</Button>}
      />
      <div className="space-y-5">
        <Card
          title={`Reorder suggestions (${suggestions.length})`}
          actions={<Button size="sm" onClick={generate} loading={busy} disabled={!suggestions.some((s) => !onOrder.has(s.id))}>Create draft POs</Button>}
        >
          {msg && <p className="mb-2 rounded bg-leaf-50 p-2 text-sm text-leaf-800">{msg}</p>}
          <ErrorText>{err}</ErrorText>
          {suggestions.length === 0 ? (
            <Empty>Everything is above its reorder level.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><Th>Item</Th><Th>Supplier</Th><Th className="text-right">In stock</Th><Th className="text-right">Reorder at</Th><Th className="text-right">Suggested</Th><Th /></tr></thead>
                <tbody>
                  {suggestions.map((i) => {
                    const f = i.purchaseFactor || 1;
                    const need = Math.ceil(Math.max(i.reorderQty, i.reorderLevel - i.currentStock + i.reorderQty) / f) * f;
                    return (
                      <tr key={i.id} className="border-t border-stone-100">
                        <Td className="font-medium">{i.name}</Td>
                        <Td className="text-xs text-stone-500">{i.supplierId ? supName.get(i.supplierId) : <Badge tone="red">no supplier</Badge>}</Td>
                        <Td className="text-right tabular-nums text-amber-700">{formatQty(i.currentStock, i.unit)}</Td>
                        <Td className="text-right tabular-nums">{formatQty(i.reorderLevel, i.unit)}</Td>
                        <Td className="text-right tabular-nums">{inPurchaseUnits(i, need)}</Td>
                        <Td>{onOrder.has(i.id) && <Badge tone="blue">on order</Badge>}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Purchase orders">
          {pos.length === 0 ? (
            <Empty>No purchase orders yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><Th>PO</Th><Th>Supplier</Th><Th>Items</Th><Th className="text-right">Total</Th><Th>Status</Th><Th>Created</Th><Th /></tr></thead>
                <tbody>
                  {pos.map((po) => (
                    <tr key={po.id} className="border-t border-stone-100">
                      <Td className="font-medium">{po.poNo}</Td>
                      <Td>{po.supplierName}</Td>
                      <Td className="text-xs">{po.lines.map((l) => `${l.itemName} ${inPurchaseUnits(map.get(l.itemId), l.qty)}`).join(", ")}</Td>
                      <Td className="text-right tabular-nums">{inr(po.total)}</Td>
                      <Td><Badge tone={STATUS_TONE[po.status]}>{po.status}</Badge></Td>
                      <Td className="text-xs text-stone-500">{new Date(po.createdAt).toLocaleDateString("en-IN")}</Td>
                      <Td className="whitespace-nowrap text-right">
                        {(po.status === "draft" || po.status === "sent") && (
                          <>
                            <ShareButton po={po} supplier={suppliers.find((s) => s.id === po.supplierId)} map={map} onShared={() => po.status === "draft" && setStatus(po, "sent")} />
                            <Button size="sm" onClick={() => setReceive(po)}>Receive</Button>
                            <Button size="sm" variant="ghost" onClick={() => setStatus(po, "cancelled")}>Cancel</Button>
                          </>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      {receive && <ReceiveModal po={receive} map={map} onClose={() => setReceive(null)} />}
      {creating && <NewPoModal items={items} suppliers={suppliers} onClose={() => setCreating(false)} />}
    </>
  );
}

/** Opens WhatsApp with the PO text pre-filled for the supplier. */
function ShareButton({ po, supplier, map, onShared }: { po: PurchaseOrder; supplier?: Supplier; map: Map<string, StockItem>; onShared: () => void }) {
  const settings = useSettings();
  const text = [
    `*${settings.name} — Purchase Order ${po.poNo}*`,
    ...po.lines.map((l) => `• ${l.itemName}: ${inPurchaseUnits(map.get(l.itemId), l.qty)}`),
    po.expectedAt ? `Needed by: ${new Date(po.expectedAt).toLocaleDateString("en-IN")}` : "",
    settings.address.line1 ? `Deliver to: ${[settings.address.line1, settings.address.city].filter(Boolean).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const phone = (supplier?.phone ?? "").replace(/\D/g, "");
  const href = `https://wa.me/${phone ? (phone.length === 10 ? `91${phone}` : phone) : ""}?text=${encodeURIComponent(text)}`;
  return (
    <a href={href} target="_blank" rel="noreferrer" onClick={onShared} className="mr-1 inline-flex rounded-lg px-2.5 py-1.5 text-xs font-medium text-leaf-700 hover:bg-leaf-50">
      WhatsApp
    </a>
  );
}

function ReceiveModal({ po, map, onClose }: { po: PurchaseOrder; map: Map<string, StockItem>; onClose: () => void }) {
  // Edited in purchase units for convenience; converted back to base units on submit.
  const [rows, setRows] = useState(
    po.lines.map((l) => {
      const f = map.get(l.itemId)?.purchaseFactor || 1;
      return { itemId: l.itemId, name: l.itemName, qty: String(round2(l.qty / f)), price: String(round2(l.unitCost * f)), f, unit: map.get(l.itemId)?.purchaseUnit ?? map.get(l.itemId)?.unit ?? "" };
    }),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const total = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.price) || 0), 0);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/purchasing/${po.id}/receive`, {
        lines: rows.map((r) => ({ itemId: r.itemId, qty: (Number(r.qty) || 0) * r.f, unitCost: (Number(r.price) || 0) / r.f })),
      });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Receive ${po.poNo} — ${po.supplierName}`} wide>
      <p className="mb-3 text-sm text-stone-500">Enter what actually arrived and the invoice price. Inspect produce on arrival; reject anything spoiled.</p>
      <table className="w-full text-sm">
        <thead><tr><Th>Item</Th><Th>Received qty</Th><Th>Price per unit (₹)</Th><Th className="text-right">Amount</Th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.itemId} className="border-t border-stone-100">
              <Td className="font-medium">{r.name}</Td>
              <Td>
                <div className="flex items-center gap-1">
                  <Input type="number" className="w-24" value={r.qty} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                  <span className="text-xs text-stone-500">{r.unit}</span>
                </div>
              </Td>
              <Td><Input type="number" className="w-28" value={r.price} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} /></Td>
              <Td className="text-right tabular-nums">{inr((Number(r.qty) || 0) * (Number(r.price) || 0))}</Td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-semibold">Total {inr(total)}</span>
        <Button onClick={submit} loading={busy}>Receive into stock</Button>
      </div>
      <ErrorText>{err}</ErrorText>
    </Modal>
  );
}

function NewPoModal({ items, suppliers, onClose }: { items: StockItem[]; suppliers: Supplier[]; onClose: () => void }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [lines, setLines] = useState<{ itemId: string; qty: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const raw = items.filter((i) => i.kind === "raw" && i.active !== false).sort((a, b) => a.name.localeCompare(b.name));
  const forSupplier = raw.filter((i) => i.supplierId === supplierId);
  const options = forSupplier.length ? [...forSupplier, ...raw.filter((i) => i.supplierId !== supplierId)] : raw;
  const map = new Map(raw.map((i) => [i.id, i]));

  async function submit(status: "draft" | "sent") {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/purchasing", {
        supplierId,
        status,
        lines: lines
          .filter((l) => l.itemId && Number(l.qty) > 0)
          .map((l) => {
            const it = map.get(l.itemId)!;
            return { itemId: l.itemId, qty: Number(l.qty) * (it.purchaseFactor || 1), unitCost: it.costPerUnit };
          }),
      });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New purchase order" wide>
      <div className="space-y-3">
        <Field label="Supplier">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        {lines.map((l, i) => {
          const it = map.get(l.itemId);
          return (
            <div key={i} className="flex items-center gap-2">
              <Select value={l.itemId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)))}>
                <option value="">Choose item…</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
              <Input type="number" className="w-28" placeholder="Qty" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
              <span className="w-20 text-xs text-stone-500">{it?.purchaseUnit ?? it?.unit}</span>
              <button className="text-stone-400 hover:text-red-600" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button>
            </div>
          );
        })}
        <Button size="sm" variant="secondary" onClick={() => setLines([...lines, { itemId: "", qty: "" }])}>+ Add line</Button>
        <ErrorText>{err}</ErrorText>
        <div className="flex gap-2">
          <Button onClick={() => submit("draft")} loading={busy} disabled={!lines.length}>Save draft</Button>
        </div>
      </div>
    </Modal>
  );
}
