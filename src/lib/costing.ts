// Pure food-cost calculations. Safe to use on both client and server.
import type { MenuItem, RecipeLine, StockItem } from "./types";

export type ItemMap = Map<string, StockItem>;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function toMap(items: StockItem[]): ItemMap {
  return new Map(items.map((i) => [i.id, i]));
}

/**
 * Cost per base unit of an item. Raw items use their stored cost; prep items are
 * rolled up from their recipe divided by yield (recursively, guarding cycles).
 */
export function unitCost(itemId: string, items: ItemMap, seen = new Set<string>()): number {
  const item = items.get(itemId);
  if (!item) return 0;
  if (item.kind === "raw" || !item.recipe?.length || !item.yieldQty) return item.costPerUnit || 0;
  if (seen.has(itemId)) return 0;
  seen.add(itemId);
  const batchCost = item.recipe.reduce(
    (sum, l) => sum + l.qty * unitCost(l.itemId, items, new Set(seen)),
    0,
  );
  return batchCost / item.yieldQty;
}

export function recipeCost(lines: RecipeLine[], items: ItemMap): number {
  return lines.reduce((sum, l) => sum + l.qty * unitCost(l.itemId, items), 0);
}

export interface MenuCosting {
  foodCost: number;
  packagingCost: number;
  totalCost: number;
  price: number;
  foodCostPct: number;
  grossMargin: number;
  grossMarginPct: number;
  hasEstimates: boolean;
  hasTbc: boolean;
  breakdown: { itemId: string; name: string; qty: number; unit: string; cost: number; tbc?: boolean }[];
}

export function costMenuItem(m: MenuItem, items: ItemMap, price = m.price): MenuCosting {
  const breakdown = m.recipe.map((l) => {
    const it = items.get(l.itemId);
    return {
      itemId: l.itemId,
      name: it?.name ?? "Unknown item",
      qty: l.qty,
      unit: it?.unit ?? "",
      cost: l.qty * unitCost(l.itemId, items),
      tbc: l.tbc,
    };
  });
  const foodCost = breakdown.reduce((s, b) => s + b.cost, 0);
  const totalCost = foodCost + (m.packagingCost || 0);
  const hasEstimates = m.recipe.some((l) => usesEstimate(l.itemId, items));
  return {
    foodCost: round2(foodCost),
    packagingCost: m.packagingCost || 0,
    totalCost: round2(totalCost),
    price,
    foodCostPct: price > 0 ? round2((totalCost / price) * 100) : 0,
    grossMargin: round2(price - totalCost),
    grossMarginPct: price > 0 ? round2(((price - totalCost) / price) * 100) : 0,
    hasEstimates,
    hasTbc: m.recipe.some((l) => l.tbc) || (m.openItems?.length ?? 0) > 0,
    breakdown,
  };
}

function usesEstimate(itemId: string, items: ItemMap, seen = new Set<string>()): boolean {
  const it = items.get(itemId);
  if (!it || seen.has(itemId)) return false;
  seen.add(itemId);
  if (it.costIsEstimate || it.yieldIsEstimate) return true;
  return (it.recipe ?? []).some((l) => l.tbc || usesEstimate(l.itemId, items, seen));
}

/**
 * Explode menu lines into stock requirements. Prep items are consumed as-is
 * (they're made ahead in batches); raw items are consumed directly.
 */
export function requirementsFor(
  lines: { menuItemId: string; qty: number }[],
  menu: Map<string, MenuItem>,
): Map<string, number> {
  const req = new Map<string, number>();
  for (const l of lines) {
    const m = menu.get(l.menuItemId);
    if (!m) continue;
    for (const r of m.recipe) req.set(r.itemId, (req.get(r.itemId) ?? 0) + r.qty * l.qty);
  }
  return req;
}

/** Raw-material requirements to produce `batches` multiples of a prep recipe. */
export function batchRequirements(prep: StockItem, batches: number): Map<string, number> {
  const req = new Map<string, number>();
  for (const r of prep.recipe ?? []) req.set(r.itemId, (req.get(r.itemId) ?? 0) + r.qty * batches);
  return req;
}

/** How many portions of a menu item current stock supports. */
export function portionsAvailable(m: MenuItem, items: ItemMap): number {
  let min = Infinity;
  for (const r of m.recipe) {
    if (r.qty <= 0) continue;
    const it = items.get(r.itemId);
    if (!it) return 0;
    min = Math.min(min, Math.floor(it.currentStock / r.qty));
  }
  return min === Infinity ? 0 : Math.max(0, min);
}

export function formatQty(qty: number, unit: string): string {
  if (unit === "g" && Math.abs(qty) >= 1000) return `${round2(qty / 1000)} kg`;
  if (unit === "ml" && Math.abs(qty) >= 1000) return `${round2(qty / 1000)} L`;
  return `${round2(qty)} ${unit}`;
}

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(
    n || 0,
  );

/** Customer-facing price: "₹349", or "₹349.50" only when there are paise. */
export const rupees = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n || 0);
