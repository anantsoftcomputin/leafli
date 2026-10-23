"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { where } from "firebase/firestore";
import { formatQty } from "@/lib/costing";
import { useItems, useLive, useMenu } from "@/lib/hooks";
import { awaitingPayment, type Order, type PrepBatch } from "@/lib/types";
import { OrderActions, SourceBadge } from "@/components/OrderBits";
import { Badge, Card, Empty, PageHeader, cx } from "@/components/ui";

/** Kitchen display: live tickets with the SOP assembly steps for each dish. */
export default function KitchenPage() {
  const { data: orders } = useLive<Order>("orders", [where("status", "in", ["new", "accepted", "preparing", "ready"])]);
  const { data: menu } = useMenu();
  const { data: items } = useItems();
  const { data: batches } = useLive<PrepBatch>("prepBatches", [where("status", "==", "active")]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const [open, setOpen] = useState<string | null>(null);

  const menuMap = new Map(menu.map((m) => [m.id, m]));
  const tickets = orders.filter((o) => !awaitingPayment(o)).sort((a, b) => a.createdAt - b.createdAt);
  const lowPreps = items.filter((i) => i.kind === "prep" && i.active && i.currentStock <= i.reorderLevel);
  const expiring = batches.filter((b) => b.useBy && b.useBy - now < 12 * 3600 * 1000).sort((a, b) => (a.useBy ?? 0) - (b.useBy ?? 0));

  return (
    <>
      <PageHeader title="Kitchen display" sub="Oldest tickets first. Tap a dish to see its SOP assembly steps." />
      {(lowPreps.length > 0 || expiring.length > 0) && (
        <div className="mb-5 grid gap-4 md:grid-cols-2">
          {lowPreps.length > 0 && (
            <Card title="Prep needed" actions={<Link className="text-xs text-leaf-700 underline" href="/admin/production">Batch prep →</Link>}>
              <ul className="space-y-1 text-sm">
                {lowPreps.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>{p.name}</span>
                    <span className={cx("tabular-nums", p.currentStock <= 0 && "text-red-600")}>{formatQty(p.currentStock, p.unit)} left</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {expiring.length > 0 && (
            <Card title="Use first / expiring within 12 h">
              <ul className="space-y-1 text-sm">
                {expiring.map((b) => (
                  <li key={b.id} className="flex justify-between">
                    <span>{b.itemName}</span>
                    <span className={cx("tabular-nums", (b.useBy ?? 0) < now ? "font-semibold text-red-600" : "text-amber-700")}>
                      {(b.useBy ?? 0) < now ? "EXPIRED" : `${Math.round(((b.useBy ?? 0) - now) / 3600000)} h`} · {formatQty(b.remaining, items.find((i) => i.id === b.itemId)?.unit ?? "")}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
      {tickets.length === 0 ? (
        <Empty>No open tickets. 🎉</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tickets.map((o) => {
            const mins = Math.floor((now - o.createdAt) / 60000);
            return (
              <div key={o.id} className={cx("rounded-2xl bg-white p-4 shadow-sm ring-2", mins > 20 ? "ring-red-400" : mins > 10 ? "ring-amber-400" : "ring-stone-900/[.06]")}>
                <div className="mb-2 flex items-center justify-between">
                  <Link href={`/admin/orders/${o.id}`} className="text-lg font-bold">{o.orderNo.slice(-3)}</Link>
                  <div className="flex items-center gap-2">
                    <SourceBadge source={o.source} />
                    <Badge tone={mins > 20 ? "red" : mins > 10 ? "amber" : "gray"}>{mins} min</Badge>
                  </div>
                </div>
                <div className="mb-2 text-xs uppercase tracking-wide text-stone-500">{o.status} · {o.delivery.provider}</div>
                <ul className="mb-3 space-y-2">
                  {o.lines.map((l) => {
                    const m = menuMap.get(l.menuItemId);
                    const k = `${o.id}:${l.menuItemId}`;
                    return (
                      <li key={l.menuItemId}>
                        <button className="w-full text-left" onClick={() => setOpen(open === k ? null : k)}>
                          <span className="text-base font-semibold">{l.qty}× {l.name}</span>
                          {l.notes && <span className="block text-xs text-amber-700">⚑ {l.notes}</span>}
                        </button>
                        {open === k && m?.assembly && (
                          <ol className="mt-1 list-decimal space-y-0.5 rounded-lg bg-leaf-50 py-2 pr-2 pl-6 text-xs text-stone-700">
                            {m.assembly.map((s, i) => <li key={i}>{s}</li>)}
                            {m.allergens.length > 0 && <li className="list-none pt-1 font-medium text-red-700">Allergens: {m.allergens.join(", ")}</li>}
                          </ol>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {o.notes && <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-800">Note: {o.notes}</p>}
                <OrderActions order={o} compact />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
