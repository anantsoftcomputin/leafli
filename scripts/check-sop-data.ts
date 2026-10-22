// Sanity checks for the SOP master data and the costing/billing maths.
// Run: npm run check
import { computeBill, DEFAULT_SETTINGS } from "../src/lib/billing";
import { costMenuItem, inr, toMap, unitCost } from "../src/lib/costing";
import { MENU_ITEMS, PREP_ITEMS, RAW_ITEMS, SUPPLIERS } from "../src/lib/seed/sopData";

const items = [...RAW_ITEMS, ...PREP_ITEMS];
const map = toMap(items);
const supplierIds = new Set(SUPPLIERS.map((s) => s.id));
const errors: string[] = [];

const ids = new Set<string>();
for (const i of items) {
  if (ids.has(i.id)) errors.push(`duplicate item id ${i.id}`);
  ids.add(i.id);
  if (i.supplierId && !supplierIds.has(i.supplierId)) errors.push(`${i.id}: unknown supplier ${i.supplierId}`);
  for (const r of i.recipe ?? []) if (!map.has(r.itemId)) errors.push(`${i.id}: unknown ingredient ${r.itemId}`);
  if (i.kind === "prep" && !(i.yieldQty! > 0)) errors.push(`${i.id}: prep without yield`);
}
for (const m of MENU_ITEMS) for (const r of m.recipe) if (!map.has(r.itemId)) errors.push(`${m.id}: unknown ingredient ${r.itemId}`);

console.log("Prep standard costs:");
for (const p of PREP_ITEMS) console.log(`  ${p.name.padEnd(42)} ${inr(unitCost(p.id, map) * (p.yieldQty ?? 0)).padStart(10)} / batch of ${p.yieldQty}${p.unit}`);

console.log("\nDish costing (placeholder prices & costs):");
for (const m of MENU_ITEMS) {
  const c = costMenuItem(m, map);
  console.log(`  ${m.name.padEnd(36)} cost ${inr(c.totalCost).padStart(9)}  price ${inr(m.price).padStart(8)}  FC ${String(c.foodCostPct).padStart(5)}%${c.hasTbc ? "  [TBC items]" : ""}`);
}

const b = computeBill({ source: "pos", lines: [{ unitPrice: 349, qty: 2 }, { unitPrice: 229, qty: 1 }], discount: 50, delivery: false }, DEFAULT_SETTINGS);
const expectTaxable = 349 * 2 + 229 - 50;
if (b.taxableValue !== expectTaxable) errors.push(`bill taxable ${b.taxableValue} != ${expectTaxable}`);
if (b.cgst !== 21.93 || b.sgst !== 21.93) errors.push(`bill gst ${b.cgst}/${b.sgst}`);
if (b.total !== Math.round(expectTaxable * 1.05)) errors.push(`bill total ${b.total}`);
const z = computeBill({ source: "zomato", lines: [{ unitPrice: 300, qty: 1 }] }, DEFAULT_SETTINGS);
if (z.cgst !== 0 || !z.gstCollectedByAggregator || z.aggregatorCommission !== 75) errors.push("zomato bill wrong");
console.log(`\nPOS bill check: taxable ${b.taxableValue}, CGST ${b.cgst}, SGST ${b.sgst}, total ${b.total}`);

if (errors.length) {
  console.error("\nFAILED:\n  " + errors.join("\n  "));
  process.exit(1);
}
console.log(`\nOK — ${RAW_ITEMS.length} raw items, ${PREP_ITEMS.length} preps, ${MENU_ITEMS.length} dishes, ${SUPPLIERS.length} suppliers.`);

// ---- subscription scheduling checks
import("../src/lib/subscriptions").then(({ upcomingDates, isDue, dishFor, eligibleDishes, canChange, addDays, weekday }) => {
  const fail = (m: string) => {
    console.error("FAILED: " + m);
    process.exit(1);
  };
  const sub = {
    startDate: "2026-11-02", // Monday
    endDate: addDays("2026-11-02", 10),
    deliveryDays: [1, 2, 3, 4, 5],
    skipped: ["2026-11-04"],
    fulfilled: {} as Record<string, string>,
    status: "active" as const,
    pausedFrom: null,
    mealsTotal: 5,
    mealsUsed: 0,
    selections: { "2026-11-03": "caprese" } as Record<string, string>,
    diet: "veg" as const,
  };
  if (weekday("2026-11-02") !== 1) fail("weekday");
  const up = upcomingDates(sub, "2026-11-01");
  if (up.join() !== "2026-11-02,2026-11-03,2026-11-05,2026-11-06,2026-11-09") fail("upcoming dates " + up.join());
  if (isDue(sub, "2026-11-04")) fail("skipped day must not be due");
  if (isDue(sub, "2026-11-07")) fail("Saturday not a delivery day");
  if (isDue({ ...sub, status: "paused", pausedFrom: "2026-11-01" }, "2026-11-02")) fail("paused");
  if (isDue({ ...sub, mealsUsed: 5 }, "2026-11-02")) fail("no credits left");
  const elig = eligibleDishes(MENU_ITEMS, [], "veg");
  if (elig.some((m) => m.diet !== "veg" || m.category.includes("Dessert"))) fail("veg eligibility");
  if (dishFor(sub, "2026-11-03", elig)?.id !== "caprese") fail("customer selection honoured");
  if (dishFor(sub, "2026-11-02", elig)?.id === dishFor(sub, "2026-11-03", elig.filter((m) => m.id !== "caprese"))?.id) fail("rotation should vary day to day");
  if (canChange("2026-11-03", new Date("2026-11-02T21:30:00+05:30"))) fail("cutoff 9 pm previous day");
  if (!canChange("2026-11-03", new Date("2026-11-02T20:59:00+05:30"))) fail("before cutoff");
  console.log("Subscription scheduling: OK");
});
