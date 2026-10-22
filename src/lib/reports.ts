import { round2 } from "./costing";
import { awaitingPayment, type Order, type StockMovement } from "./types";

export interface DishStat {
  menuItemId: string;
  name: string;
  qty: number;
  revenue: number;
  cost: number;
  foodCostPct: number;
  unitMargin: number;
  klass?: "Star" | "Plowhorse" | "Puzzle" | "Dog";
}

export function summarize(orders: Order[], movements: StockMovement[] = []) {
  const valid = orders.filter((o) => o.status !== "cancelled" && !awaitingPayment(o));
  const revenue = round2(valid.reduce((s, o) => s + o.taxableValue, 0));
  const gross = round2(valid.reduce((s, o) => s + o.total, 0));
  const gst = round2(valid.reduce((s, o) => s + o.cgst + o.sgst, 0));
  const foodCost = round2(valid.reduce((s, o) => s + o.foodCost, 0));
  const commission = round2(valid.reduce((s, o) => s + (o.aggregatorCommission || 0), 0));
  const delivery = round2(valid.reduce((s, o) => s + (o.delivery?.fare ?? 0), 0));

  const byChannel = new Map<string, { orders: number; revenue: number }>();
  for (const o of valid) {
    const c = byChannel.get(o.source) ?? { orders: 0, revenue: 0 };
    c.orders++;
    c.revenue = round2(c.revenue + o.taxableValue);
    byChannel.set(o.source, c);
  }

  // Line revenue is allocated net of the order-level discount.
  const dishes = new Map<string, DishStat>();
  for (const o of valid) {
    const share = o.subtotal > 0 ? (o.subtotal - o.discount) / o.subtotal : 1;
    for (const l of o.lines) {
      const d = dishes.get(l.menuItemId) ?? { menuItemId: l.menuItemId, name: l.name, qty: 0, revenue: 0, cost: 0, foodCostPct: 0, unitMargin: 0 };
      d.qty += l.qty;
      d.revenue += l.lineTotal * share;
      d.cost += l.unitCost * l.qty;
      dishes.set(l.menuItemId, d);
    }
  }
  const list = [...dishes.values()].map((d) => ({
    ...d,
    revenue: round2(d.revenue),
    cost: round2(d.cost),
    foodCostPct: d.revenue ? round2((d.cost / d.revenue) * 100) : 0,
    unitMargin: d.qty ? round2((d.revenue - d.cost) / d.qty) : 0,
  }));
  // Menu engineering (Kasavana & Smith): popularity vs 70% of fair share, margin vs average.
  const totalQty = list.reduce((s, d) => s + d.qty, 0);
  const avgMargin = totalQty ? list.reduce((s, d) => s + d.unitMargin * d.qty, 0) / totalQty : 0;
  const popThreshold = list.length ? (totalQty / list.length) * 0.7 : 0;
  for (const d of list) {
    const popular = d.qty >= popThreshold;
    const profitable = d.unitMargin >= avgMargin;
    d.klass = popular && profitable ? "Star" : popular ? "Plowhorse" : profitable ? "Puzzle" : "Dog";
  }

  const wastage = movements.filter((m) => m.type === "wastage");
  const wastageValue = round2(-wastage.reduce((s, m) => s + m.value, 0));
  const variance = round2(-movements.filter((m) => m.type === "adjustment").reduce((s, m) => s + m.value, 0));
  const wasteByItem = new Map<string, { name: string; value: number }>();
  for (const m of wastage) {
    const w = wasteByItem.get(m.itemId) ?? { name: m.itemName, value: 0 };
    w.value = round2(w.value - m.value);
    wasteByItem.set(m.itemId, w);
  }

  const actualCost = round2(foodCost + wastageValue + variance);
  return {
    orders: valid.length,
    cancelled: orders.length - valid.length,
    revenue,
    gross,
    gst,
    foodCost,
    foodCostPct: revenue ? round2((foodCost / revenue) * 100) : 0,
    actualCost,
    actualCostPct: revenue ? round2((actualCost / revenue) * 100) : 0,
    wastageValue,
    variance,
    commission,
    delivery,
    contribution: round2(revenue - actualCost - commission - delivery),
    aov: valid.length ? round2(gross / valid.length) : 0,
    byChannel,
    dishes: list.sort((a, b) => b.revenue - a.revenue),
    topWaste: [...wasteByItem.values()].sort((a, b) => b.value - a.value).slice(0, 8),
  };
}

export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};
