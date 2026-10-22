"use client";

import { useMemo, useState } from "react";
import { where } from "firebase/firestore";
import { api } from "@/lib/api";
import { costMenuItem, inr } from "@/lib/costing";
import { useItems, useLive, useMenu } from "@/lib/hooks";
import { startOfDay, summarize } from "@/lib/reports";
import type { Order, StockMovement } from "@/lib/types";
import { Badge, Button, Card, Empty, PageHeader, Select, Stat, Td, Th, cx } from "@/components/ui";

const RANGES = { today: 0, "7d": 6, "30d": 29, "90d": 89 } as const;
const KLASS_TONE = { Star: "green", Plowhorse: "blue", Puzzle: "amber", Dog: "red" } as const;
const KLASS_TIP = {
  Star: "Popular and profitable — protect it",
  Plowhorse: "Popular, low margin — re-engineer the recipe or nudge the price",
  Puzzle: "Profitable but slow — promote it",
  Dog: "Slow and low margin — rework or drop",
};

export default function FoodCostPage() {
  const [range, setRange] = useState<keyof typeof RANGES>("7d");
  const from = useMemo(() => startOfDay(new Date(Date.now() - RANGES[range] * 86400000)), [range]);
  const { data: orders, loading } = useLive<Order>("orders", [where("createdAt", ">=", from)], String(from));
  const { data: movements } = useLive<StockMovement>("stockMovements", [where("at", ">=", from)], String(from));
  const { data: menu } = useMenu();
  const { map } = useItems();
  const [busy, setBusy] = useState(false);
  const s = summarize(orders, movements);

  async function recost() {
    setBusy(true);
    try {
      const r = await api<{ updated: number }>("/api/costing/recost", {});
      alert(`Recalculated ${r.updated} prep item cost(s).`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Food cost"
        sub="Theoretical cost = what recipes say each sold dish should cost. Actual adds wastage and stock-count variances."
        actions={
          <>
            <Select value={range} onChange={(e) => setRange(e.target.value as keyof typeof RANGES)} className="w-36">
              <option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option>
            </Select>
            <Button variant="secondary" onClick={recost} loading={busy}>Recalculate prep costs</Button>
          </>
        }
      />
      {loading ? <p className="text-sm text-stone-500">Loading…</p> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Net sales (excl. GST)" value={inr(s.revenue)} sub={`${s.orders} orders · AOV ${inr(s.aov)}`} />
            <Stat label="Theoretical food cost" value={`${s.foodCostPct}%`} sub={inr(s.foodCost)} tone={s.foodCostPct > 35 ? "red" : s.foodCostPct > 30 ? "amber" : "green"} />
            <Stat label="Actual food cost" value={`${s.actualCostPct}%`} sub={`incl. wastage ${inr(s.wastageValue)} · variance ${inr(s.variance)}`} tone={s.actualCostPct > 35 ? "red" : s.actualCostPct > 30 ? "amber" : "green"} />
            <Stat label="Contribution" value={inr(s.contribution)} sub={`after Zomato ${inr(s.commission)} · Porter ${inr(s.delivery)}`} />
          </div>

          <Card title="Dish performance & menu engineering">
            {s.dishes.length === 0 ? <Empty>No sales in this period.</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr><Th>Dish</Th><Th className="text-right">Sold</Th><Th className="text-right">Net sales</Th><Th className="text-right">Cost</Th><Th className="text-right">Food cost %</Th><Th className="text-right">Margin / plate</Th><Th>Class</Th></tr></thead>
                  <tbody>
                    {s.dishes.map((d) => (
                      <tr key={d.menuItemId} className="border-t border-stone-100">
                        <Td className="font-medium">{d.name}</Td>
                        <Td className="text-right tabular-nums">{d.qty}</Td>
                        <Td className="text-right tabular-nums">{inr(d.revenue)}</Td>
                        <Td className="text-right tabular-nums">{inr(d.cost)}</Td>
                        <Td className={cx("text-right tabular-nums", d.foodCostPct > 35 && "text-red-600")}>{d.foodCostPct}%</Td>
                        <Td className="text-right tabular-nums">{inr(d.unitMargin)}</Td>
                        <Td><Badge tone={KLASS_TONE[d.klass!]} title={KLASS_TIP[d.klass!]}>{d.klass}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Current recipe cost by dish">
              <table className="w-full text-sm">
                <thead><tr><Th>Dish</Th><Th className="text-right">Cost</Th><Th className="text-right">Price</Th><Th className="text-right">FC %</Th><Th /></tr></thead>
                <tbody>
                  {[...menu].sort((a, b) => a.sortOrder - b.sortOrder).map((m) => {
                    const c = costMenuItem(m, map);
                    return (
                      <tr key={m.id} className="border-t border-stone-100">
                        <Td>{m.name}</Td>
                        <Td className="text-right tabular-nums">{inr(c.totalCost)}</Td>
                        <Td className="text-right tabular-nums">{inr(m.price)}</Td>
                        <Td className={cx("text-right tabular-nums", c.foodCostPct > 35 && "text-red-600")}>{c.foodCostPct}%</Td>
                        <Td className="space-x-1">{c.hasEstimates && <Badge tone="amber">est.</Badge>}{c.hasTbc && <Badge tone="amber">TBC</Badge>}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
            <Card title="Top wastage">
              {s.topWaste.length === 0 ? <Empty>No wastage recorded. Record it under Inventory → Waste, or discard expired batches under Batch prep.</Empty> : (
                <ul className="space-y-1 text-sm">
                  {s.topWaste.map((w) => <li key={w.name} className="flex justify-between"><span>{w.name}</span><span className="tabular-nums text-red-600">{inr(w.value)}</span></li>)}
                </ul>
              )}
              <div className="mt-4 border-t border-stone-100 pt-3 text-sm">
                <h4 className="mb-1 font-medium">By channel</h4>
                {[...s.byChannel].map(([ch, v]) => (
                  <div key={ch} className="flex justify-between capitalize"><span>{ch === "pos" ? "counter" : ch}</span><span className="tabular-nums">{v.orders} · {inr(v.revenue)}</span></div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
