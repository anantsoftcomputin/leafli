"use client";

import Link from "next/link";
import { useMemo } from "react";
import { where } from "firebase/firestore";
import { formatQty, inr } from "@/lib/costing";
import { useItems, useLive, useMenu } from "@/lib/hooks";
import { startOfDay, summarize } from "@/lib/reports";
import { awaitingPayment, type Order, type PrepBatch, type PurchaseOrder } from "@/lib/types";
import { Badge, Card, Empty, PageHeader, Stat, Td, Th } from "@/components/ui";

export default function Dashboard() {
  const weekStart = useMemo(() => startOfDay(new Date(Date.now() - 6 * 86400000)), []);
  const today = useMemo(() => startOfDay(), []);
  const { data: orders } = useLive<Order>("orders", [where("createdAt", ">=", weekStart)]);
  const { data: items } = useItems();
  const { data: menu } = useMenu();
  const { data: batches } = useLive<PrepBatch>("prepBatches", [where("status", "==", "active")]);
  const { data: pos } = useLive<PurchaseOrder>("purchaseOrders", [where("status", "in", ["draft", "sent"])]);

  const t = summarize(orders.filter((o) => o.createdAt >= today));
  const open = orders.filter((o) => ["new", "accepted", "preparing", "ready", "dispatched"].includes(o.status) && !awaitingPayment(o));
  const low = items.filter((i) => i.active !== false && i.currentStock <= i.reorderLevel);
  const now = Date.now();
  const expiring = batches.filter((b) => b.useBy && b.useBy - now < 24 * 3600 * 1000);
  const openItems = menu.flatMap((m) => (m.openItems ?? []).map((o) => ({ dish: m.name, o })));

  const days = Array.from({ length: 7 }, (_, i) => {
    const start = startOfDay(new Date(now - (6 - i) * 86400000));
    const s = summarize(orders.filter((o) => o.createdAt >= start && o.createdAt < start + 86400000));
    return { start, ...s };
  });

  return (
    <>
      <PageHeader title="Dashboard" sub={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Today's gross sales" value={inr(t.gross)} sub={`${t.orders} orders · AOV ${inr(t.aov)}`} />
        <Stat label="Today's food cost" value={`${t.foodCostPct}%`} sub={inr(t.foodCost)} tone={t.foodCostPct > 35 ? "red" : t.foodCostPct > 30 ? "amber" : "green"} />
        <Stat label="Open orders" value={open.length} sub={<Link className="underline" href="/orders">View board</Link>} tone={open.some((o) => o.status === "new") ? "amber" : undefined} />
        <Stat label="Low stock items" value={low.length} sub={<Link className="underline" href="/purchasing">{pos.length} open POs</Link>} tone={low.length ? "red" : "green"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Last 7 days">
          <table className="w-full text-sm">
            <thead><tr><Th>Day</Th><Th className="text-right">Orders</Th><Th className="text-right">Net sales</Th><Th className="text-right">Food cost</Th></tr></thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.start} className="border-t border-stone-100">
                  <Td>{new Date(d.start).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}</Td>
                  <Td className="text-right tabular-nums">{d.orders}</Td>
                  <Td className="text-right tabular-nums">{inr(d.revenue)}</Td>
                  <Td className="text-right tabular-nums">{d.foodCostPct}%</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Needs attention">
          <div className="space-y-4 text-sm">
            {expiring.length > 0 && (
              <div>
                <h4 className="mb-1 font-medium text-amber-700">Batches expiring within 24 h</h4>
                {expiring.map((b) => (
                  <div key={b.id} className="flex justify-between"><span>{b.itemName}</span><span className={b.useBy! < now ? "text-red-600" : ""}>{b.useBy! < now ? "expired" : new Date(b.useBy!).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></div>
                ))}
              </div>
            )}
            {low.length > 0 && (
              <div>
                <h4 className="mb-1 font-medium text-red-700">Below reorder level</h4>
                <div className="flex flex-wrap gap-1">{low.slice(0, 20).map((i) => <Badge key={i.id} tone={i.currentStock <= 0 ? "red" : "amber"}>{i.name} · {formatQty(i.currentStock, i.unit)}</Badge>)}</div>
              </div>
            )}
            {openItems.length > 0 && (
              <div>
                <h4 className="mb-1 font-medium">SOP items still to confirm</h4>
                <ul className="space-y-0.5 text-xs text-stone-600">{openItems.map((x, i) => <li key={i}><b>{x.dish}:</b> {x.o}</li>)}</ul>
              </div>
            )}
            {!expiring.length && !low.length && !openItems.length && <Empty>All good.</Empty>}
          </div>
        </Card>
      </div>
    </>
  );
}
