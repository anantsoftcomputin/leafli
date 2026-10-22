"use client";

import Link from "next/link";
import { useState } from "react";
import { limit, orderBy, where } from "firebase/firestore";
import { inr } from "@/lib/costing";
import { useLive } from "@/lib/hooks";
import { awaitingPayment, type Order, type OrderStatus } from "@/lib/types";
import { OrderActions, SourceBadge, StatusBadge, timeAgo } from "@/components/OrderBits";
import { Badge, Empty, PageHeader, Select, Td, Th, cx } from "@/components/ui";

const COLUMNS: { key: OrderStatus; label: string }[] = [
  { key: "new", label: "New" },
  { key: "accepted", label: "Accepted" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "dispatched", label: "Out for delivery" },
];

export default function OrdersPage() {
  const [view, setView] = useState<"board" | "list">("board");
  const [source, setSource] = useState("all");
  const since = useState(() => Date.now() - 3 * 24 * 3600 * 1000)[0];
  const { data: orders, loading } = useLive<Order>("orders", [where("createdAt", ">=", since), orderBy("createdAt", "desc"), limit(300)]);
  const unpaid = orders.filter(awaitingPayment);
  const shown = orders.filter((o) => (source === "all" || o.source === source) && !awaitingPayment(o));

  return (
    <>
      <PageHeader
        title="Orders"
        sub={<>Live across counter, website and Zomato — last 3 days.{unpaid.length > 0 && <> · <span className="text-amber-700">{unpaid.length} online order(s) waiting for payment (hidden until paid)</span></>}</>}
        actions={
          <>
            <Select value={source} onChange={(e) => setSource(e.target.value)} className="w-36">
              <option value="all">All channels</option>
              <option value="pos">Counter</option>
              <option value="website">Website</option>
              <option value="zomato">Zomato</option>
            </Select>
            <div className="flex rounded-lg border border-stone-300 bg-white p-0.5 text-sm">
              {(["board", "list"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={cx("rounded-md px-3 py-1 capitalize", view === v ? "bg-leaf-700 text-white" : "text-stone-600")}>
                  {v}
                </button>
              ))}
            </div>
          </>
        }
      />
      {loading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : view === "board" ? (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {COLUMNS.map((c) => {
            const col = shown.filter((o) => o.status === c.key).sort((a, b) => a.createdAt - b.createdAt);
            return (
              <div key={c.key} className="rounded-xl bg-stone-100 p-2">
                <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-stone-600">
                  {c.label} <span>{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((o) => (
                    <div key={o.id} className={cx("rounded-lg border bg-white p-3 text-sm", o.status === "new" ? "border-sky-300" : "border-stone-200")}>
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/orders/${o.id}`} className="font-semibold hover:underline">{o.orderNo}</Link>
                        <SourceBadge source={o.source} />
                      </div>
                      <div className="mt-0.5 text-xs text-stone-500">
                        {o.customer.name} · {timeAgo(o.createdAt)}
                      </div>
                      <ul className="my-2 space-y-0.5 text-xs">
                        {o.lines.map((l) => (
                          <li key={l.menuItemId}>
                            <b>{l.qty}×</b> {l.name}
                          </li>
                        ))}
                      </ul>
                      {o.delivery.provider === "porter" && (
                        <div className="mb-2">
                          <Badge tone={o.delivery.porterOrderId ? "green" : "amber"}>
                            Porter {o.delivery.porterOrderId ? `· ${o.delivery.status}` : "· not booked"}
                          </Badge>
                        </div>
                      )}
                      <OrderActions order={o} compact />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : shown.length === 0 ? (
        <Empty>No orders yet.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 bg-stone-50">
              <tr><Th>Order</Th><Th>Channel</Th><Th>Customer</Th><Th>Items</Th><Th className="text-right">Total</Th><Th className="text-right">Food cost</Th><Th>Status</Th><Th>Placed</Th></tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id} className="border-b border-stone-50 hover:bg-stone-50">
                  <Td><Link className="font-medium hover:underline" href={`/orders/${o.id}`}>{o.orderNo}</Link></Td>
                  <Td><SourceBadge source={o.source} /></Td>
                  <Td>{o.customer.name}</Td>
                  <Td className="text-xs">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</Td>
                  <Td className="text-right tabular-nums">{inr(o.total)}</Td>
                  <Td className="text-right tabular-nums">{inr(o.foodCost)}</Td>
                  <Td><StatusBadge status={o.status} /></Td>
                  <Td className="text-xs text-stone-500">{timeAgo(o.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
