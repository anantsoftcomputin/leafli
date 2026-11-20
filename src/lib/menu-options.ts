import type { MenuAddonGroup, MenuItem, MenuSelection, MenuVariant, RecipeLine } from "./types";
import { round2 } from "./costing";

type ConfigurableMenu = Pick<MenuItem, "price"> & { recipe?: RecipeLine[]; variants?: MenuVariant[]; addonGroups?: MenuAddonGroup[] };

/** The same validation and arithmetic drive checkout previews and authoritative server pricing. */
export function resolveSelection(item: ConfigurableMenu, selection: MenuSelection = {}, basePrice = item.price) {
  const variants = item.variants ?? [];
  const variant = selection.variantId ? variants.find((v) => v.id === selection.variantId) : variants.find((v) => v.available && v.price === basePrice) ?? variants.find((v) => v.available);
  if (selection.variantId && (!variant || !variant.available)) throw new Error("That option is no longer available");
  if (variants.length && !variant) throw new Error("Choose an option for this dish");
  const ids = selection.addonIds ?? [];
  if (new Set(ids).size !== ids.length) throw new Error("An add-on can only be selected once per bowl");
  const groups = (item.addonGroups ?? []).filter((g) => !variant?.addonGroupIds || variant.addonGroupIds.includes(g.id));
  const addons = groups.flatMap((g) => g.options.filter((a) => ids.includes(a.id)));
  if (addons.length !== ids.length || addons.some((a) => !a.available)) throw new Error("An add-on is no longer available for this dish");
  for (const g of groups) {
    const count = g.options.filter((a) => ids.includes(a.id)).length;
    if (count < g.min || count > g.max) throw new Error(`Choose ${g.min === g.max ? g.min : `${g.min}–${g.max}`} from ${g.name}`);
  }
  const baseUnitPrice = variant?.price ?? basePrice;
  if (!Number.isFinite(baseUnitPrice) || baseUnitPrice < 0 || addons.some((a) => !Number.isFinite(a.price) || a.price < 0)) throw new Error("This dish has an invalid price. Please contact the kitchen.");
  return {
    variant,
    addons,
    baseUnitPrice,
    unitPrice: round2(baseUnitPrice + addons.reduce((sum, a) => sum + a.price, 0)),
    recipe: [...(variant?.recipe ?? item.recipe ?? []), ...addons.flatMap((a) => a.recipe ?? [])],
  };
}

export function cartKey(id: string, selection: MenuSelection = {}) {
  return selection.variantId || selection.addonIds?.length
    ? JSON.stringify([id, selection.variantId ?? "", [...(selection.addonIds ?? [])].sort()]) : id;
}
export function parseCartKey(key: string): MenuSelection & { menuItemId: string } {
  if (!key.startsWith("[")) return { menuItemId: key };
  const [menuItemId, variantId, addonIds] = JSON.parse(key);
  if (typeof menuItemId !== "string" || typeof variantId !== "string" || !Array.isArray(addonIds) || addonIds.some((id) => typeof id !== "string")) throw new Error("Invalid saved cart");
  return { menuItemId, ...(variantId ? { variantId } : {}), addonIds };
}

/** Only explicitly public option fields leave the server; recipes and costs stay private. */
export function publicOptions(item: Pick<MenuItem, "variants" | "addonGroups">) {
  return {
    variants: (item.variants ?? []).map(({ recipe: _recipe, ...v }) => v),
    addonGroups: (item.addonGroups ?? []).map((g) => ({ ...g, options: g.options.map(({ recipe: _recipe, ...a }) => a) })),
  };
}

/** Keep compatible extras when switching portion; drop only choices that no longer apply. */
export function compatibleAddonIds(item: Pick<MenuItem, "variants" | "addonGroups">, variantId: string | undefined, ids: string[]) {
  const variant = item.variants?.find((v) => v.id === variantId);
  const groups = (item.addonGroups ?? []).filter((g) => !variant?.addonGroupIds || variant.addonGroupIds.includes(g.id));
  return groups.flatMap((g) => g.options.filter((a) => a.available && ids.includes(a.id)).slice(0, g.max).map((a) => a.id));
}

/** Editing replaces the old line; matching configurations merge without losing bowls. */
export function configureCart(cart: Record<string, number>, key: string, qty: number, previousKey?: string) {
  if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new Error("Choose between 1 and 20 bowls.");
  if (previousKey && !cart[previousKey]) throw new Error("This bowl was removed. Close this window and add it again.");
  const next = { ...cart };
  if (previousKey) delete next[previousKey];
  const combined = (next[key] ?? 0) + qty;
  if (combined > 20) throw new Error("You can have up to 20 bowls with the same options. Reduce the quantity and try again.");
  next[key] = combined;
  return next;
}
