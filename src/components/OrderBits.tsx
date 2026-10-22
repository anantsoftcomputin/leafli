"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Order, OrderStatus } from "@/lib/types";
import { Badge, Button } from "./ui";

export const STATUS_TONE: Record<OrderStatus, "gray" | "blue" | "amber" | "green" | "violet" | "red"> = {
  new: "blue",
  accepted: "violet",
  preparing: "amber",
  ready: "green",
  dispatched: "gray",
  delivered: "gray",
  cancelled: "red",
};

export const SOURCE_LABEL = { pos: "Counter", website: "Website", zomato: "Zomato" } as const;

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}

export function SourceBadge({ source }: { source: Order["source"] }) {
  return <Badge tone={source === "zomato" ? "red" : source === "website" ? "blue" : "gray"}>{SOURCE_LABEL[source]}</Badge>;
}

const NEXT_ACTION: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  new: { to: "accepted", label: "Accept" },
  accepted: { to: "preparing", label: "Start preparing" },
  preparing: { to: "ready", label: "Mark ready" },
  ready: { to: "dispatched", label: "Dispatched" },
  dispatched: { to: "delivered", label: "Delivered" },
};

/** Primary next-step button plus cancel, for order cards and the detail page. */
export function OrderActions({ order, compact }: { order: Order; compact?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  let next = NEXT_ACTION[order.status];
  // Pickup orders go straight from ready to delivered (collected).
  if (order.status === "ready" && order.delivery.provider === "pickup") next = { to: "delivered", label: "Collected" };

  async function move(to: OrderStatus) {
    let reason: string | undefined;
    if (to === "cancelled") {
      const r = prompt(
        order.status === "accepted" || order.status === "new"
          ? "Reason for cancelling? Ingredients will be returned to stock."
          : "Reason for cancelling? Food already prepared will NOT be returned to stock.",
      );
      if (r === null) return;
      reason = r || "Cancelled";
    }
    setBusy(to);
    setErr(null);
    try {
      await api(`/api/orders/${order.id}/status`, { status: to, reason });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (order.status === "delivered" || order.status === "cancelled") return null;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {next && (
          <Button size={compact ? "sm" : "md"} loading={busy === next.to} onClick={() => move(next!.to)}>
            {next.label}
          </Button>
        )}
        <Button size={compact ? "sm" : "md"} variant="ghost" loading={busy === "cancelled"} onClick={() => move("cancelled")}>
          {order.status === "new" ? "Reject" : "Cancel"}
        </Button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

export function timeAgo(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : new Date(ts).toLocaleDateString("en-IN");
}
