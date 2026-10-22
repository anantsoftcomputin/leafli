import "server-only";
import { round2, toMap, unitCost } from "@/lib/costing";
import type { PrepBatch, PurchaseOrder, PurchaseOrderLine, StockItem, Supplier } from "@/lib/types";
import { HttpError, type Actor } from "./http";
import { col, financialYear, nextCounter, StockTx } from "./inventory";

const db = () => col.items().firestore;

/**
 * Produce `batches` multiples of a prep recipe (a dressing, sauce or cooked
 * component). Consumes raw stock, adds prep stock and opens a dated batch with
 * a use-by from the shelf-life guide. Per the SOPs, the actual weighed yield
 * can be recorded and optionally adopted as the new standard yield.
 */
export async function produceBatch(
  args: { itemId: string; batches: number; actualYield?: number; adoptYield?: boolean; note?: string },
  actor: Actor,
) {
  if (!(args.batches > 0)) throw new HttpError(400, "Batches must be more than zero");
  return db().runTransaction(async (tx) => {
    const stx = new StockTx(tx, actor);
    await stx.load([args.itemId]);
    const prep = stx.item(args.itemId);
    if (prep.kind !== "prep" || !prep.recipe?.length || !prep.yieldQty)
      throw new HttpError(400, `${prep.name} has no recipe/yield set up`);
    await stx.load(prep.recipe.map((r) => r.itemId));

    const batchRef = col.batches().doc();
    let cost = 0;
    for (const r of prep.recipe) {
      const qty = r.qty * args.batches;
      const { unitCost } = stx.consume(r.itemId, qty, "production_out", {
        refType: "batch",
        refId: batchRef.id,
        note: prep.name,
      });
      cost += unitCost * qty;
    }
    const produced = round2(args.actualYield && args.actualYield > 0 ? args.actualYield : prep.yieldQty * args.batches);
    const batchUnitCost = produced > 0 ? cost / produced : 0;
    stx.add(prep.id, produced, batchUnitCost, "production_in", { refType: "batch", refId: batchRef.id, note: args.note });

    if (args.adoptYield && args.actualYield)
      stx.setCost(prep.id, { yieldQty: round2(args.actualYield / args.batches), yieldIsEstimate: false });

    const now = Date.now();
    const batch: Omit<PrepBatch, "id"> = {
      itemId: prep.id,
      itemName: prep.name,
      qty: produced,
      remaining: produced,
      batches: args.batches,
      unitCost: round2(batchUnitCost * 10000) / 10000,
      preparedAt: now,
      useBy: prep.shelfLifeHours ? now + prep.shelfLifeHours * 3600 * 1000 : null,
      preparedBy: actor.uid,
      preparedByName: actor.name,
      status: "active",
    };
    tx.set(batchRef, batch);
    stx.commit();
    return { id: batchRef.id, ...batch, cost: round2(cost) };
  });
}

/** Write off what's left of a batch (expired past use-by, or discarded on quality). */
export async function closeBatch(batchId: string, status: "expired" | "discarded", reason: string, actor: Actor) {
  return db().runTransaction(async (tx) => {
    const ref = col.batches().doc(batchId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "Batch not found");
    const b = snap.data() as PrepBatch;
    if (b.status !== "active") throw new HttpError(409, "Batch is already closed");
    const stx = new StockTx(tx, actor);
    await stx.load([b.itemId]);
    if (b.remaining > 0)
      stx.add(b.itemId, -b.remaining, b.unitCost, "wastage", { refType: "batch", refId: batchId, note: `${status}: ${reason}` });
    tx.update(ref, { status, remaining: 0, closedAt: Date.now(), closeReason: reason });
    stx.commit();
    return { ok: true, wasted: b.remaining };
  });
}

export async function recordWastage(itemId: string, qty: number, reason: string, actor: Actor) {
  if (!(qty > 0)) throw new HttpError(400, "Quantity must be more than zero");
  return db().runTransaction(async (tx) => {
    const stx = new StockTx(tx, actor);
    await stx.load([itemId]);
    stx.consume(itemId, qty, "wastage", { refType: "manual", note: reason });
    stx.commit();
    return { ok: true };
  });
}

/** Physical stock count: set stock to the counted quantity and log the variance. */
export async function stockCount(itemId: string, counted: number, note: string, actor: Actor) {
  if (!(counted >= 0)) throw new HttpError(400, "Counted quantity cannot be negative");
  return db().runTransaction(async (tx) => {
    const stx = new StockTx(tx, actor);
    await stx.load([itemId]);
    const variance = round2(counted - stx.stockOf(itemId));
    if (variance < 0) stx.consume(itemId, -variance, "adjustment", { refType: "manual", note: note || "Stock count" });
    else if (variance > 0) stx.add(itemId, variance, stx.costOf(itemId), "adjustment", { refType: "manual", note: note || "Stock count" });
    stx.commit();
    return { variance };
  });
}

export async function createPurchaseOrder(
  args: { supplierId: string; lines: { itemId: string; qty: number; unitCost: number }[]; expectedAt?: number | null; notes?: string; status?: "draft" | "sent" },
  actor: Actor,
) {
  if (!args.lines.length) throw new HttpError(400, "Purchase order has no lines");
  return db().runTransaction(async (tx) => {
    const supSnap = await tx.get(col.suppliers().doc(args.supplierId));
    if (!supSnap.exists) throw new HttpError(400, "Supplier not found");
    const itemSnaps = await tx.getAll(...args.lines.map((l) => col.items().doc(l.itemId)));
    const counter = await nextCounter(tx, `po-${financialYear()}`);
    const lines: PurchaseOrderLine[] = args.lines.map((l, i) => ({
      itemId: l.itemId,
      itemName: (itemSnaps[i]!.get("name") as string) ?? l.itemId,
      qty: round2(l.qty),
      unitCost: l.unitCost,
    }));
    const ref = col.pos().doc();
    const po: Omit<PurchaseOrder, "id"> = {
      poNo: `PO/${financialYear()}/${String(counter.value).padStart(4, "0")}`,
      supplierId: args.supplierId,
      supplierName: (supSnap.get("name") as string) ?? "",
      lines,
      status: args.status ?? "draft",
      total: round2(lines.reduce((s, l) => s + l.qty * l.unitCost, 0)),
      expectedAt: args.expectedAt ?? null,
      receivedAt: null,
      createdAt: Date.now(),
      createdBy: actor.uid,
      ...(args.notes ? { notes: args.notes } : {}),
    };
    tx.set(counter.ref, { value: counter.value }, { merge: true });
    tx.set(ref, po);
    return { id: ref.id, ...po };
  });
}

/**
 * Generate draft POs for every raw item at or below its reorder level that is
 * not already on an open PO, grouped by supplier. Order quantity is the
 * item's reorder quantity, topped up to cover any deficit below the reorder
 * level and rounded up to whole purchase units.
 */
export async function generateReorderPOs(actor: Actor) {
  const [itemsSnap, openSnap] = await Promise.all([
    col.items().where("active", "==", true).get(),
    col.pos().where("status", "in", ["draft", "sent"]).get(),
  ]);
  const onOrder = new Set(openSnap.docs.flatMap((d) => (d.get("lines") as PurchaseOrderLine[]).map((l) => l.itemId)));
  const bySupplier = new Map<string, { itemId: string; qty: number; unitCost: number }[]>();
  const skippedNoSupplier: string[] = [];
  for (const d of itemsSnap.docs) {
    const it = { id: d.id, ...(d.data() as Omit<StockItem, "id">) };
    if (it.kind !== "raw" || onOrder.has(it.id) || it.currentStock > it.reorderLevel) continue;
    if (!it.supplierId) {
      skippedNoSupplier.push(it.name);
      continue;
    }
    const factor = it.purchaseFactor || 1;
    const need = Math.max(it.reorderQty, it.reorderLevel - it.currentStock + it.reorderQty);
    const qty = Math.ceil(need / factor) * factor;
    const list = bySupplier.get(it.supplierId) ?? [];
    list.push({ itemId: it.id, qty, unitCost: it.costPerUnit });
    bySupplier.set(it.supplierId, list);
  }
  const created = [];
  for (const [supplierId, lines] of bySupplier)
    created.push(await createPurchaseOrder({ supplierId, lines, notes: "Auto-generated from reorder levels" }, actor));
  return { created, skippedNoSupplier };
}

/** Receive goods against a PO: add stock, roll the weighted-average cost, re-cost preps. */
export async function receivePurchaseOrder(
  poId: string,
  received: { itemId: string; qty: number; unitCost: number }[],
  actor: Actor,
) {
  await db().runTransaction(async (tx) => {
    const ref = col.pos().doc(poId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "Purchase order not found");
    const po = snap.data() as PurchaseOrder;
    if (po.status === "received" || po.status === "cancelled") throw new HttpError(409, `PO is already ${po.status}`);
    const stx = new StockTx(tx, actor);
    await stx.load(received.map((r) => r.itemId));
    for (const r of received) {
      if (!(r.qty > 0)) continue;
      const it = stx.item(r.itemId);
      const onHand = Math.max(stx.stockOf(r.itemId), 0);
      const newCost = (onHand * (it.costIsEstimate ? r.unitCost : it.costPerUnit) + r.qty * r.unitCost) / (onHand + r.qty);
      stx.add(r.itemId, r.qty, r.unitCost, "purchase", { refType: "po", refId: poId, note: po.poNo });
      stx.setCost(r.itemId, { costPerUnit: round2(newCost * 10000) / 10000, costIsEstimate: false, lastPurchaseCost: r.unitCost });
    }
    const lines = po.lines.map((l) => ({ ...l, receivedQty: received.find((r) => r.itemId === l.itemId)?.qty ?? 0 }));
    tx.update(ref, {
      status: "received",
      receivedAt: Date.now(),
      receivedBy: actor.uid,
      lines,
      receivedTotal: round2(received.reduce((s, r) => s + r.qty * r.unitCost, 0)),
    });
    stx.commit();
  });
  await recostPreps();
  return { ok: true };
}

/** Recompute standard cost per unit for every prep item from current raw costs. */
export async function recostPreps() {
  const snap = await col.items().get();
  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockItem, "id">) }));
  const map = toMap(items);
  const batch = col.items().firestore.batch();
  let n = 0;
  for (const it of items) {
    if (it.kind !== "prep") continue;
    const c = round2(unitCost(it.id, map) * 10000) / 10000;
    if (c !== it.costPerUnit) {
      batch.update(col.items().doc(it.id), { costPerUnit: c, updatedAt: Date.now() });
      n++;
    }
  }
  if (n) await batch.commit();
  return { updated: n };
}

export type { Supplier };
