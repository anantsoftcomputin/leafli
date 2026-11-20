import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { withZomatoMenu, ZOMATO_STOCK_ITEMS, ZOMATO_SOURCE } from "@/lib/seed/zomato";
import type { MenuItem } from "@/lib/types";

/** Additive migration: does not replace staff prices, recipes, availability or stock counts. */
export async function importZomatoCatalog(apply = false) {
  const snap = await adminDb.collection("menuItems").get();
  const existing = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as MenuItem);
  const imported = withZomatoMenu(existing);
  const created: string[] = [];
  const enriched: string[] = [];
  for (const item of ZOMATO_STOCK_ITEMS) {
    if (!apply) continue;
    const ref = adminDb.collection("items").doc(item.id);
    await adminDb.runTransaction(async (tx) => { if (!(await tx.get(ref)).exists) { const { id: _id, ...data } = item; tx.set(ref, data); } });
  }
  for (const item of imported) {
    if (!item.sourceUrl) continue;
    const ref = adminDb.collection("menuItems").doc(item.id);
    const old = existing.find((m) => m.id === item.id);
    if (!old) created.push(item.name);
    else if ((!old.variants && item.variants?.length) || (!old.addonGroups && item.addonGroups?.length) || !old.slug || !old.zomatoItemId) enriched.push(item.name);
    if (!apply) continue;
    await adminDb.runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists) { const { id: _id, ...data } = item; tx.set(ref, data); return; }
      const patch: Record<string, unknown> = {};
      if (!fresh.get("variants") && item.variants?.length) patch.variants = item.variants;
      if (!fresh.get("addonGroups") && item.addonGroups?.length) patch.addonGroups = item.addonGroups;
      if (!fresh.get("slug")) patch.slug = item.slug || item.id;
      if (!fresh.get("zomatoItemId")) patch.zomatoItemId = item.zomatoItemId;
      if (Object.keys(patch).length) {
        patch.sourceUrl = ZOMATO_SOURCE;
        patch.openItems = [...new Set([...(fresh.get("openItems") ?? []), ...(item.openItems ?? [])])];
        tx.update(ref, patch);
      }
    });
  }
  return { apply, source: ZOMATO_SOURCE, snapshotDate: "2026-11-20", created, enriched };
}
