import "server-only";
import { FieldValue, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { round2 } from "@/lib/costing";
import type { MovementType, PrepBatch, StockItem } from "@/lib/types";
import { HttpError, type Actor } from "./http";

export const col = {
  items: () => adminDb.collection("items"),
  menu: () => adminDb.collection("menuItems"),
  orders: () => adminDb.collection("orders"),
  movements: () => adminDb.collection("stockMovements"),
  batches: () => adminDb.collection("prepBatches"),
  pos: () => adminDb.collection("purchaseOrders"),
  suppliers: () => adminDb.collection("suppliers"),
  counters: () => adminDb.collection("counters"),
  settings: () => adminDb.collection("settings").doc("business"),
  logs: () => adminDb.collection("integrationLogs"),
};

/**
 * Everything that changes stock goes through a StockTx: it collects reads first
 * (Firestore transactions require all reads before writes), then applies
 * movements, batch consumption and stock updates in one atomic commit.
 */
export class StockTx {
  private items = new Map<string, StockItem>();
  private batches = new Map<string, PrepBatch[]>();
  private deltas = new Map<string, number>();
  private costUpdates = new Map<string, Record<string, unknown>>();
  private batchWrites = new Map<string, Partial<PrepBatch>>();
  private movements: Record<string, unknown>[] = [];

  constructor(
    private tx: Transaction,
    private actor: Actor,
  ) {}

  /** Load items (and FIFO batches for prep items). Must be called before any write. */
  async load(ids: Iterable<string>) {
    const need = [...new Set(ids)].filter((id) => !this.items.has(id));
    if (!need.length) return;
    const snaps = await this.tx.getAll(...need.map((id) => col.items().doc(id)));
    for (const s of snaps) {
      if (!s.exists) throw new HttpError(400, `Stock item "${s.id}" not found`);
      this.items.set(s.id, { id: s.id, ...(s.data() as Omit<StockItem, "id">) });
    }
    for (const id of need) {
      if (this.items.get(id)!.kind !== "prep") continue;
      const q = await this.tx.get(
        col.batches().where("itemId", "==", id).where("status", "==", "active").orderBy("preparedAt", "asc"),
      );
      this.batches.set(
        id,
        q.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PrepBatch, "id">) })),
      );
    }
  }

  item(id: string) {
    const it = this.items.get(id);
    if (!it) throw new Error(`Item ${id} not loaded`);
    return it;
  }

  stockOf(id: string) {
    return this.item(id).currentStock + (this.deltas.get(id) ?? 0);
  }

  /** Current effective unit cost for an item (prep items: weighted cost of stock). */
  costOf(id: string) {
    return this.item(id).costPerUnit || 0;
  }

  /** Remove stock. Prep items are consumed FIFO across active batches. */
  consume(
    id: string,
    qty: number,
    type: MovementType,
    ref: { refType?: "order" | "po" | "batch" | "manual"; refId?: string; note?: string } = {},
  ) {
    const allocations: { batchId: string; qty: number }[] = [];
    if (qty <= 0) return { unitCost: 0, allocations };
    const it = this.item(id);
    let unitCost = this.costOf(id);
    if (it.kind === "prep") {
      let left = qty;
      let value = 0;
      for (const b of this.batches.get(id) ?? []) {
        if (left <= 0) break;
        const w = this.batchWrites.get(b.id);
        const remaining = (w?.remaining as number | undefined) ?? b.remaining;
        if (remaining <= 0) continue;
        const take = Math.min(remaining, left);
        left -= take;
        value += take * b.unitCost;
        allocations.push({ batchId: b.id, qty: take });
        const nextRemaining = round2(remaining - take);
        this.batchWrites.set(b.id, {
          remaining: nextRemaining,
          status: nextRemaining <= 0 ? "consumed" : "active",
        });
      }
      // Any shortfall (stock went negative) is costed at the standard cost.
      value += left * unitCost;
      unitCost = value / qty;
    }
    this.add(id, -qty, unitCost, type, ref);
    return { unitCost, allocations };
  }

  private restorable = new Map<string, PrepBatch>();

  /** Read batches that a reversal will put stock back into. Call during the read phase. */
  async loadBatchesForRestore(batchIds: string[]) {
    const ids = [...new Set(batchIds)].filter((b) => !this.restorable.has(b));
    if (!ids.length) return;
    const snaps = await this.tx.getAll(...ids.map((b) => col.batches().doc(b)));
    for (const s of snaps) if (s.exists) this.restorable.set(s.id, { id: s.id, ...(s.data() as Omit<PrepBatch, "id">) });
  }

  /**
   * Put consumed stock back (order cancelled before preparation). Prep stock goes
   * back into its original batch unless that batch has since expired/been discarded,
   * in which case nothing is restored (the food is gone).
   */
  restore(
    id: string,
    qty: number,
    unitCost: number,
    allocations: { batchId: string; qty: number }[],
    ref: { refType?: "order"; refId?: string; note?: string },
  ) {
    const it = this.item(id);
    if (it.kind !== "prep" || !allocations.length) {
      this.add(id, qty, unitCost, "sale_reversal", ref);
      return;
    }
    let restored = 0;
    for (const a of allocations) {
      const b = this.restorable.get(a.batchId);
      if (!b || b.status === "expired" || b.status === "discarded") continue;
      const prev = this.batchWrites.get(b.id);
      const remaining = round2(((prev?.remaining as number | undefined) ?? b.remaining) + a.qty);
      this.batchWrites.set(b.id, { remaining, status: "active" });
      restored += a.qty;
    }
    if (restored > 0) this.add(id, restored, unitCost, "sale_reversal", ref);
  }

  add(
    id: string,
    qty: number,
    unitCost: number,
    type: MovementType,
    ref: { refType?: "order" | "po" | "batch" | "manual"; refId?: string; note?: string } = {},
  ) {
    const it = this.item(id);
    this.deltas.set(id, (this.deltas.get(id) ?? 0) + qty);
    this.movements.push({
      itemId: id,
      itemName: it.name,
      type,
      qty: round2(qty),
      unitCost: round2(unitCost * 10000) / 10000,
      value: round2(qty * unitCost),
      ...ref,
      by: this.actor.uid,
      byName: this.actor.name,
      at: Date.now(),
    });
  }

  setCost(id: string, fields: Record<string, unknown>) {
    this.costUpdates.set(id, { ...(this.costUpdates.get(id) ?? {}), ...fields });
  }

  /** Apply every buffered write to the transaction. */
  commit() {
    const ids = new Set([...this.deltas.keys(), ...this.costUpdates.keys()]);
    for (const id of ids) {
      const ref = col.items().doc(id);
      const delta = this.deltas.get(id) ?? 0;
      this.tx.update(ref, {
        ...(delta ? { currentStock: FieldValue.increment(round2(delta)) } : {}),
        ...(this.costUpdates.get(id) ?? {}),
        updatedAt: Date.now(),
      });
    }
    for (const [bid, w] of this.batchWrites) this.tx.update(col.batches().doc(bid), w);
    for (const m of this.movements) this.tx.set(col.movements().doc(), m);
  }
}

/** Atomically increment a named counter and return the new value. */
export async function nextCounter(tx: Transaction, key: string): Promise<{ ref: DocumentReference; value: number }> {
  const ref = col.counters().doc(key);
  const snap = await tx.get(ref);
  const value = ((snap.get("value") as number | undefined) ?? 0) + 1;
  return { ref, value };
}

/** Indian financial year label, e.g. "25-26" for dates from 1 Apr 2025 to 31 Mar 2026. */
export function financialYear(d = new Date()): string {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

export function istDateKey(d = new Date()): string {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  return ist.toISOString().slice(0, 10).replace(/-/g, "").slice(2); // YYMMDD
}
