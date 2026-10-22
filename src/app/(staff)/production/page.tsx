"use client";

import { useEffect, useState } from "react";
import { where } from "firebase/firestore";
import { api } from "@/lib/api";
import { formatQty, inr, unitCost } from "@/lib/costing";
import { useItems, useLive } from "@/lib/hooks";
import type { PrepBatch, StockItem } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Modal, PageHeader, Td, Th, cx } from "@/components/ui";

export default function ProductionPage() {
  const { data: items, map } = useItems();
  const { data: active } = useLive<PrepBatch>("prepBatches", [where("status", "==", "active")]);
  const batches = [...active].sort((a, b) => (a.useBy ?? Infinity) - (b.useBy ?? Infinity));
  const [make, setMake] = useState<StockItem | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  const preps = items.filter((i) => i.kind === "prep" && i.active).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader title="Batch prep" sub="Dressings, sauces and cooked components made ahead per SOP. Each batch gets a use-by from the shelf-life guide; orders consume the oldest batch first." />
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card title="Prep items">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Item</Th><Th className="text-right">In stock</Th><Th className="text-right">Par</Th><Th>Shelf life</Th><Th /></tr></thead>
              <tbody>
                {preps.map((p) => {
                  const low = p.currentStock <= p.reorderLevel;
                  return (
                    <tr key={p.id} className="border-t border-stone-100">
                      <Td>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-stone-500">{p.sopRef} · batch yields {formatQty(p.yieldQty ?? 0, p.unit)}{p.yieldIsEstimate && " (est.)"}</div>
                      </Td>
                      <Td className={cx("text-right tabular-nums", low && "font-semibold text-amber-700", p.currentStock <= 0 && "text-red-600")}>{formatQty(p.currentStock, p.unit)}</Td>
                      <Td className="text-right tabular-nums text-stone-500">{formatQty(p.reorderLevel, p.unit)}</Td>
                      <Td className="text-xs">{p.shelfLifeHours ? (p.shelfLifeHours >= 48 ? `${p.shelfLifeHours / 24} days` : `${p.shelfLifeHours} h`) : "—"}</Td>
                      <Td><Button size="sm" variant={low ? "primary" : "secondary"} onClick={() => setMake(p)}>Make</Button></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Active batches (FIFO)">
          {batches.length === 0 ? (
            <Empty>No active batches.</Empty>
          ) : (
            <ul className="divide-y divide-stone-100">
              {batches.map((b) => <BatchRow key={b.id} b={b} unit={map.get(b.itemId)?.unit ?? ""} now={now} />)}
            </ul>
          )}
        </Card>
      </div>
      {make && <MakeModal prep={make} map={map} onClose={() => setMake(null)} />}
    </>
  );
}

function BatchRow({ b, unit, now }: { b: PrepBatch; unit: string; now: number }) {
  const [busy, setBusy] = useState(false);
  const expired = b.useBy != null && b.useBy < now;
  const hoursLeft = b.useBy ? Math.round((b.useBy - now) / 3600000) : null;
  async function close(status: "expired" | "discarded") {
    const reason = prompt(status === "expired" ? "Confirm discard of expired batch (note):" : "Why is this batch being discarded?", status === "expired" ? "Past use-by" : "");
    if (!reason) return;
    setBusy(true);
    try {
      await api(`/api/production/${b.id}/close`, { status, reason });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="flex flex-wrap items-center gap-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{b.itemName}</div>
        <div className="text-xs text-stone-500">
          Made {new Date(b.preparedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })} by {b.preparedByName ?? "—"} · {formatQty(b.remaining, unit)} of {formatQty(b.qty, unit)} left
        </div>
      </div>
      {b.useBy ? (
        <Badge tone={expired ? "red" : (hoursLeft ?? 99) < 12 ? "amber" : "green"}>
          {expired ? "Expired — discard" : `Use by ${new Date(b.useBy).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}`}
        </Badge>
      ) : (
        <Badge>no use-by</Badge>
      )}
      <Button size="sm" variant={expired ? "danger" : "ghost"} loading={busy} onClick={() => close(expired ? "expired" : "discarded")}>
        {expired ? "Discard" : "Waste"}
      </Button>
    </li>
  );
}

function MakeModal({ prep, map, onClose }: { prep: StockItem; map: ReturnType<typeof useItems>["map"]; onClose: () => void }) {
  const [batches, setBatches] = useState(1);
  const [actual, setActual] = useState("");
  const [adopt, setAdopt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const expected = (prep.yieldQty ?? 0) * batches;
  const short = (prep.recipe ?? []).filter((r) => (map.get(r.itemId)?.currentStock ?? 0) < r.qty * batches);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/production", { itemId: prep.id, batches, actualYield: actual ? Number(actual) : undefined, adoptYield: adopt });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Make ${prep.name}`} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <Field label="Number of batches" hint={`Expected yield ${formatQty(expected, prep.unit)}${prep.yieldIsEstimate ? " (estimated — weigh and record actual)" : ""}`}>
            <Input type="number" min={0.25} step={0.25} value={batches} onChange={(e) => setBatches(Number(e.target.value) || 0)} />
          </Field>
          <table className="w-full text-sm">
            <thead><tr><Th>Ingredient</Th><Th className="text-right">Needed</Th><Th className="text-right">In stock</Th></tr></thead>
            <tbody>
              {(prep.recipe ?? []).map((r) => {
                const it = map.get(r.itemId);
                const need = r.qty * batches;
                return (
                  <tr key={r.itemId} className="border-t border-stone-100">
                    <Td>{it?.name ?? r.itemId}{r.tbc && <Badge tone="amber">TBC</Badge>}{r.note && <div className="text-xs text-stone-500">{r.note}</div>}</Td>
                    <Td className="text-right tabular-nums">{formatQty(need, it?.unit ?? "")}</Td>
                    <Td className={cx("text-right tabular-nums", (it?.currentStock ?? 0) < need && "text-red-600")}>{formatQty(it?.currentStock ?? 0, it?.unit ?? "")}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-stone-500">Estimated batch cost {inr(unitCost(prep.id, map) * expected)}</p>
          {short.length > 0 && <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">Short on {short.map((s) => map.get(s.itemId)?.name).join(", ")} — stock will go negative. Receive a PO or do a stock count first if this is wrong.</p>}
          <Field label={`Actual weighed yield (${prep.unit}) — optional`}>
            <Input type="number" value={actual} onChange={(e) => setActual(e.target.value)} placeholder={String(expected)} />
          </Field>
          {actual && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={adopt} onChange={(e) => setAdopt(e.target.checked)} /> Use this as the new standard yield per batch
            </label>
          )}
          <ErrorText>{err}</ErrorText>
          <Button onClick={submit} loading={busy} disabled={batches <= 0}>Record batch</Button>
        </div>
        <div className="space-y-3 text-sm">
          <h4 className="font-semibold">Method ({prep.sopRef})</h4>
          <ol className="list-decimal space-y-1 pl-5 text-stone-700">{prep.method?.map((m, i) => <li key={i}>{m}</li>)}</ol>
          {prep.qualityStandard && <p className="rounded-lg bg-leaf-50 p-3 text-xs text-leaf-800"><b>Quality standard:</b> {prep.qualityStandard}</p>}
          {prep.allergens?.length ? <p className="text-xs text-red-700">Allergens: {prep.allergens.join(", ")}</p> : null}
          <p className="text-xs text-stone-500">Label with item, prep date/time, use-by and initials. Never mix a new batch into an old one.</p>
        </div>
      </div>
    </Modal>
  );
}
