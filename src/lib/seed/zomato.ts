import snapshot from "./zomato-menu.json";
import type { MenuAddonGroup, MenuItem, StockItem } from "../types";

export const ZOMATO_SOURCE = snapshot.source;
const matches: Record<string, string> = {
  ctl_822955569: "asian-rice-noodle", ctl_822955570: "chana-moong", ctl_822955571: "caprese",
  ctl_822955572: "potato-apple-eggless", ctl_822955573: "chicken-caesar", ctl_822975791: "greek-hummus", ctl_822955567: "chocolate-fruit-bowl",
};
const newIds: Record<string, string> = {
  ctl_823229451: "grazing-box", ctl_826200135: "asian-veggie-noodle-combo", ctl_826201040: "chicken-mango-combo",
  ctl_826201041: "greek-caprese-combo", ctl_826201042: "asian-noodle-chocolate-combo", ctl_826201043: "potato-asian-veggie-combo",
  ctl_826201044: "salad-chocolate-combo", ctl_822975513: "asian-stir-fry-vegetables",
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const groups: MenuAddonGroup[] = Object.values(snapshot.modifierGroups).map((g) => ({
  ...g,
  name: g.name.replace(" ot ", " or "),
  options: g.options.map((a) => ({
    ...a,
    diet: a.name.startsWith("Chicken") ? "nonveg" : "veg",
    allergens: a.name.startsWith("Paneer") ? ["milk"] : a.name.startsWith("Tofu") ? ["soy"] : [],
    recipe: a.name.startsWith("Paneer") ? [{ itemId: "paneer", qty: 50 }] : a.name.startsWith("Tofu") ? [{ itemId: "tofu", qty: 50 }] : [],
  })),
}));

export const ZOMATO_STOCK_ITEMS: StockItem[] = [
  { id: "paneer", name: "Paneer", allergens: ["milk"] },
  { id: "tofu", name: "Tofu", allergens: ["soy"] },
].map((i) => ({ ...i, kind: "raw", category: "Protein", unit: "g", currentStock: 0, reorderLevel: 0, reorderQty: 500, costPerUnit: 0, costIsEstimate: true, active: true }));

/** Preserve existing website prices, recipes and diet declarations; import verified options and missing dishes. */
export function withZomatoMenu(existing: MenuItem[]): MenuItem[] {
  const result = existing.map((m) => ({ ...m }));
  for (const d of snapshot.dishes) {
    const id = matches[d.id] ?? newIds[d.id];
    const found = result.find((m) => m.id === id);
    const groupIds = new Set([...d.modifier_group_ids, ...d.variants.flatMap((v) => v.addonGroupIds)]);
    const addonGroups = groups.filter((g) => groupIds.has(g.id));
    const variants = d.variants.map((v) => ({ ...v }));
    // Choice-combo recipes differ by selected salad. Reuse an existing confirmed BOM where available.
    if (id === "salad-chocolate-combo") {
      const saladIds: Record<string, string> = { "Caprese Salad": "caprese", "Chicken Caesar": "chicken-caesar", "Asian Noodle": "asian-rice-noodle", "Asian stir fry vegetables": "asian-stir-fry-vegetables", "Roasted potato & Apple": "potato-apple-eggless", "Desi Mango & Sprouts": "chana-moong", "Greek Hummus": "greek-hummus" };
      for (const v of variants) Object.assign(v, { recipe: [...(existing.find((m) => m.id === saladIds[v.name])?.recipe ?? []), ...(existing.find((m) => m.id === "chocolate-fruit-bowl")?.recipe ?? [])] });
    }
    const warnings = ["Confirm portion BOM for Zomato variants and combos; source does not give ingredient weights.", ...(addonGroups.some((g) => g.options.some((a) => a.diet === "nonveg")) ? ["Map the 70 g cooked-chicken add-on to weighed prep stock; current SOP uses pieces, so conversion is not assumed."] : [])];
    const imported = { zomatoItemId: d.id, sourceUrl: ZOMATO_SOURCE, variants, addonGroups };
    if (found) {
      Object.assign(found, imported, { openItems: [...(found.openItems ?? []), ...warnings] });
      continue;
    }
    const isChicken = d.dietary_slugs.includes("non-veg");
    const description = d.desc.replace(/\n\nImage for representation[\s\S]*/, "");
    result.push({
      id, slug: slug(d.name), name: d.name, description, category: id.includes("combo") ? "Combos" : id === "grazing-box" ? "Sharing boxes" : "Warm salads",
      price: d.display_price, available: d.item_state === "available", channels: { pos: true, website: true, zomato: true },
      imageUrl: d.item_image_url ?? null, photoUrl: d.item_image_url ?? null,
      recipe: [], packagingCost: 0, diet: isChicken ? "nonveg" : "veg", allergens: id === "asian-stir-fry-vegetables" ? ["soy", "sesame"] : id === "grazing-box" ? ["milk", "gluten", "sesame"] : [],
      ingredients: description.split(/\n/).filter(Boolean), sortOrder: 100 + result.length,
      openItems: [...warnings, "Confirm allergens, ingredient weights and packaging cost in Menu & recipes before relying on food-cost reports."],
      ...imported,
    });
  }
  // Fixed combos: retain component ingredient quantities as a provisional full-bowl BOM.
  const combos: Record<string, string[]> = {
    "asian-veggie-noodle-combo": ["asian-stir-fry-vegetables", "asian-rice-noodle"],
    "chicken-mango-combo": ["chicken-caesar", "chana-moong"], "greek-caprese-combo": ["greek-hummus", "caprese"],
    "asian-noodle-chocolate-combo": ["asian-rice-noodle", "chocolate-fruit-bowl"], "potato-asian-veggie-combo": ["potato-apple-eggless", "asian-stir-fry-vegetables"],
  };
  for (const [id, componentIds] of Object.entries(combos)) {
    const dish = result.find((m) => m.id === id)!;
    const components = componentIds.map((c) => result.find((m) => m.id === c)).filter((m): m is MenuItem => !!m);
    dish.recipe = components.flatMap((m) => m.recipe.map((r) => ({ ...r, tbc: true })));
    dish.allergens = [...new Set(components.flatMap((m) => m.allergens))];
    dish.ingredients = components.map((m) => m.name);
    if (components.some((m) => m.diet === "egg") && dish.diet === "veg") dish.diet = "egg";
  }
  return result;
}
