// End-to-end test of the stock / order engine against the Firestore emulator.
// Run: npm run test:e2e   (needs Java + firebase-tools)
import assert from "node:assert/strict";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "demo-leafli";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= "demo-leafli";
process.env.RAZORPAY_KEY_ID = "rzp_test_dummy";
process.env.RAZORPAY_KEY_SECRET = "test_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "hook_secret";

async function main() {
  const { adminDb } = await import("../src/lib/firebase/admin");
  const { MENU_ITEMS, PLANS, PREP_ITEMS, RAW_ITEMS, SUPPLIERS } = await import("../src/lib/seed/sopData");
  const subsSvc = await import("../src/lib/server/subscriptions");
  const { addDays } = await import("../src/lib/subscriptions");
  const { istDate } = await import("../src/lib/site");
  const { DEFAULT_SETTINGS } = await import("../src/lib/billing");
  const ops = await import("../src/lib/server/stockOps");
  const { createOrder, setOrderStatus, markOrderPaid } = await import("../src/lib/server/orders");
  const rzp = await import("../src/lib/integrations/razorpay");
  const { summarize } = await import("../src/lib/reports");
  const crypto = await import("node:crypto");
  type Actor = import("../src/lib/server/http").Actor;

  const actor: Actor = { uid: "test-admin", role: "admin", name: "Tester" };
  const stock = async (id: string) => (await adminDb.collection("items").doc(id).get()).get("currentStock") as number;
  const near = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 0.01, `${msg}: expected ${b}, got ${a}`);
  let step = 0;
  const ok = (msg: string) => console.log(`  ✓ ${++step}. ${msg}`);

  // ---- seed
  const batch = adminDb.batch();
  for (const s of SUPPLIERS) batch.set(adminDb.collection("suppliers").doc(s.id), s);
  for (const i of [...RAW_ITEMS, ...PREP_ITEMS]) {
    const { id, ...rest } = i;
    batch.set(adminDb.collection("items").doc(id), rest);
  }
  for (const m of MENU_ITEMS) {
    const { id, ...rest } = m;
    batch.set(adminDb.collection("menuItems").doc(id), rest);
  }
  for (const p of PLANS) {
    const { id, ...rest } = p;
    batch.set(adminDb.collection("plans").doc(id), rest);
  }
  batch.set(adminDb.collection("settings").doc("business"), { ...DEFAULT_SETTINGS, packagingChargePerOrder: 10 });
  await batch.commit();
  await ops.recostPreps();
  ok("seeded SOP data and computed prep standard costs");

  // ---- purchasing
  const r = await ops.generateReorderPOs(actor);
  assert.ok(r.created.length >= 5, "reorder should create POs for every supplier (all stock is 0)");
  const again = await ops.generateReorderPOs(actor);
  assert.equal(again.created.length, 0, "items already on open POs must not be re-ordered");
  ok(`reorder created ${r.created.length} draft POs; second run creates none`);

  for (const po of r.created) {
    // Receive everything at 10% above the placeholder cost.
    await ops.receivePurchaseOrder(po.id, po.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, unitCost: l.unitCost * 1.1 })), actor);
  }
  const lettuce = (await adminDb.collection("items").doc("lettuce").get()).data()!;
  near(lettuce.currentStock, 4000, "lettuce received (reorder qty + shortfall below reorder level)");
  near(lettuce.costPerUnit, 0.22, "lettuce weighted cost");
  assert.equal(lettuce.costIsEstimate, false);
  await assert.rejects(ops.receivePurchaseOrder(r.created[0]!.id, [{ itemId: "lettuce", qty: 1, unitCost: 1 }], actor), /already received/);
  ok("received POs: stock added, cost updated, estimate flag cleared, double receipt blocked");

  // ---- production
  const eggsBefore = await stock("egg-pasteurised");
  const dressing = await ops.produceBatch({ itemId: "caesar-dressing", batches: 2, actualYield: 590 }, actor);
  near(await stock("caesar-dressing"), 590, "dressing produced");
  near(await stock("egg-pasteurised"), eggsBefore - 4, "eggs consumed by dressing");
  assert.ok(dressing.useBy! - dressing.preparedAt === 72 * 3600 * 1000, "use-by = 3 days");
  for (const id of ["chicken-cooked", "boiled-egg", "croutons", "chana-cooked", "moong-prepared", "mango-chilli-dressing"])
    await ops.produceBatch({ itemId: id, batches: id === "chicken-cooked" || id === "boiled-egg" ? 6 : 1 }, actor);
  ok("produced batches; raw ingredients consumed; use-by set from shelf-life guide");

  // ---- POS order: immediate deduction
  const lettuceBefore = await stock("lettuce");
  const pos = await createOrder(
    { source: "pos", customer: { name: "Walk-in" }, lines: [{ menuItemId: "chicken-caesar", qty: 2 }], paymentMode: "upi", deliveryProvider: "pickup", autoAccept: true },
    actor,
  );
  assert.equal(pos.status, "accepted");
  assert.ok(pos.invoiceNo?.startsWith("LF/"), "POS order gets a GST invoice number");
  near(pos.taxableValue, 550 * 2 + 10, "taxable incl. packaging");
  near(pos.cgst, round2((1110 * 5) / 200), "CGST");
  near(await stock("lettuce"), lettuceBefore - 70, "lettuce deducted");
  near(await stock("chicken-cooked"), 4, "cooked chicken portions deducted");
  near(await stock("caesar-dressing"), 500, "dressing deducted FIFO");
  assert.ok(pos.foodCost > 0, "food cost recorded");
  ok(`POS order ${pos.orderNo} / ${pos.invoiceNo}: stock deducted, GST ${pos.cgst}+${pos.sgst}, food cost ₹${pos.foodCost}`);

  // ---- Website order: deduct on accept, restore on early cancel
  const web = await createOrder(
    { source: "website", customer: { name: "Asha", phone: "+919999999999" }, lines: [{ menuItemId: "chana-moong", qty: 1 }], paymentMode: "pay_later", deliveryProvider: "pickup" },
    actor,
  );
  assert.equal(web.status, "new");
  const chanaBefore = await stock("chana-cooked");
  await setOrderStatus(web.id, "accepted", actor);
  near(await stock("chana-cooked"), chanaBefore - 100, "chana deducted on accept");
  await setOrderStatus(web.id, "cancelled", actor, "Customer cancelled");
  near(await stock("chana-cooked"), chanaBefore, "chana restored on cancel");
  const chanaBatch = (await adminDb.collection("prepBatches").where("itemId", "==", "chana-cooked").get()).docs[0]!.data();
  near(chanaBatch.remaining, chanaBefore, "batch remaining restored");
  assert.equal(chanaBatch.status, "active");
  ok("website order: deducted on accept, fully restored (incl. batch) when cancelled before prep");

  // ---- Cancel after preparing: no restore
  const web2 = await createOrder(
    { source: "website", customer: { name: "Ravi" }, lines: [{ menuItemId: "chana-moong", qty: 1 }], paymentMode: "pay_later", deliveryProvider: "pickup" },
    actor,
  );
  await setOrderStatus(web2.id, "accepted", actor);
  await setOrderStatus(web2.id, "preparing", actor);
  await setOrderStatus(web2.id, "cancelled", actor, "Rider no-show");
  near(await stock("chana-cooked"), chanaBefore - 100, "prepared food not restored");
  await assert.rejects(setOrderStatus(web2.id, "accepted", actor), /Cannot move/);
  ok("cancel after preparing keeps the deduction; illegal transitions rejected");

  // ---- Zomato idempotency + no GST
  const z1 = await createOrder(
    { source: "zomato", externalId: "Z-123", customer: { name: "Zomato customer" }, lines: [{ menuItemId: "chana-moong", qty: 1, unitPriceOverride: 289 }], paymentMode: "zomato", deliveryProvider: "zomato" },
    actor,
  );
  const z2 = await createOrder(
    { source: "zomato", externalId: "Z-123", customer: { name: "Zomato customer" }, lines: [{ menuItemId: "chana-moong", qty: 1 }], paymentMode: "zomato", deliveryProvider: "zomato" },
    actor,
  );
  assert.equal(z1.id, z2.id);
  assert.equal(z2.duplicate, true);
  assert.equal(z1.cgst, 0);
  assert.equal(z1.invoiceNo, undefined);
  near(z1.subtotal, 289, "zomato price override");
  near(z1.aggregatorCommission, 72.25, "commission 25%");
  ok("Zomato order: idempotent on external id, aggregator price, no GST/invoice, commission tracked");

  // ---- Online (Razorpay) payment rules
  const online = await createOrder(
    { source: "website", customer: { name: "Neha" }, lines: [{ menuItemId: "chana-moong", qty: 1 }], paymentMode: "online", deliveryProvider: "pickup" },
    actor,
  );
  await adminDb.collection("orders").doc(online.id).update({ payment: { provider: "razorpay", rzpOrderId: "order_TEST1" } });
  await assert.rejects(setOrderStatus(online.id, "accepted", actor), /hasn't been paid/);
  const all1 = (await adminDb.collection("orders").get()).docs.map((d) => ({ id: d.id, ...d.data() })) as never[];
  const before = summarize(all1).orders;
  const sig = crypto.createHmac("sha256", "test_secret").update("order_TEST1|pay_TEST1").digest("hex");
  assert.ok(rzp.verifyPaymentSignature("order_TEST1", "pay_TEST1", sig), "valid checkout signature accepted");
  assert.ok(!rzp.verifyPaymentSignature("order_TEST1", "pay_EVIL", sig), "tampered payment id rejected");
  const body = JSON.stringify({ event: "payment.captured" });
  assert.ok(rzp.verifyWebhookSignature(body, crypto.createHmac("sha256", "hook_secret").update(body).digest("hex")), "webhook signature accepted");
  assert.ok(!rzp.verifyWebhookSignature(body + " ", crypto.createHmac("sha256", "hook_secret").update(body).digest("hex")), "altered webhook body rejected");
  await assert.rejects(markOrderPaid(online.id, "order_OTHER", "pay_TEST1"), /does not belong/);
  assert.equal((await markOrderPaid(online.id, "order_TEST1", "pay_TEST1")).alreadyPaid, false);
  assert.equal((await markOrderPaid(online.id, "order_TEST1", "pay_TEST1")).alreadyPaid, true, "second confirmation (webhook) is a no-op");
  const all2 = (await adminDb.collection("orders").get()).docs.map((d) => ({ id: d.id, ...d.data() })) as never[];
  assert.equal(summarize(all2).orders, before + 1, "paid order now counts in sales");
  await setOrderStatus(online.id, "accepted", actor);
  ok("online order: blocked until paid, signatures verified, payment matched to its order, idempotent, then accepted");

  // ---- Stray payments, failures, payment links
  const pays = await import("../src/lib/server/payments");
  assert.equal((await markOrderPaid(online.id, "order_TEST1", "pay_SECOND")).stray, true, "a second payment on a paid order is flagged for refund");
  const gone = await createOrder(
    { source: "website", customer: { name: "Late" }, lines: [{ menuItemId: "chana-moong", qty: 1 }], paymentMode: "online", deliveryProvider: "pickup" },
    actor,
  );
  await adminDb.collection("orders").doc(gone.id).update({ payment: { provider: "razorpay", rzpOrderId: "order_GONE" } });
  await pays.recordFailure({ kind: "order", id: gone.id }, { error_description: "Bank declined", error_reason: null, created_at: 100 });
  await pays.recordFailure({ kind: "order", id: gone.id }, { error_description: "Older failure", error_reason: null, created_at: 50 });
  assert.equal((await adminDb.collection("orders").doc(gone.id).get()).get("payment.lastError"), "Bank declined", "newest failure reason kept");
  await setOrderStatus(gone.id, "cancelled", actor, "customer left");
  const late = await markOrderPaid(gone.id, "order_GONE", "pay_LATE");
  assert.ok(late.stray && late.alreadyPaid, "payment after cancellation is flagged for refund, not kept");
  assert.equal((await adminDb.collection("orders").doc(gone.id).get()).get("paymentStatus"), "pending");
  assert.deepEqual(await pays.targetOfPayment({ order_id: "order_GONE", notes: [] }), { kind: "order", id: gone.id, viaLink: false });
  assert.deepEqual(await pays.targetOfPayment({ order_id: "order_X", notes: { leafliOrderId: "abc", via: "payment_link" } }), { kind: "order", id: "abc", viaLink: true });

  const cod = await createOrder(
    { source: "website", customer: { name: "Cod" }, lines: [{ menuItemId: "chana-moong", qty: 1 }], paymentMode: "pay_later", deliveryProvider: "pickup" },
    actor,
  );
  assert.equal((await markOrderPaid(cod.id, "order_LINK", "pay_LINK", { viaLink: true, method: "upi" })).alreadyPaid, false);
  const codDoc = (await adminDb.collection("orders").doc(cod.id).get()).data()!;
  assert.equal(codDoc.paymentStatus, "paid");
  assert.equal(codDoc.paymentMode, "online");
  assert.equal(codDoc.payment.method, "upi");
  ok("stray payments flagged for refund, failure reasons recorded, payment-link payments settle pay-later orders");

  // ---- Subscriptions: buy → activate → daily kitchen orders
  const start = addDays(istDate(), 1);
  await assert.rejects(
    subsSvc.createSubscription({ planId: "taster-week", startDate: istDate(), deliveryDays: [0, 1, 2, 3, 4, 5, 6], slot: "lunch", diet: "veg", address: { line1: "1 Test Rd", city: "Pune", state: "MH", pincode: "411001", lat: 18.5, lng: 73.8 }, customer: { name: "Sub", phone: "+919000000000" }, paymentMode: "offline" }, actor),
    /tomorrow or later/,
  );
  const sub = await subsSvc.createSubscription(
    { planId: "taster-week", startDate: start, deliveryDays: [0, 1, 2, 3, 4, 5, 6], slot: "lunch", diet: "veg", address: { line1: "1 Test Rd", city: "Pune", state: "MH", pincode: "411001", lat: 18.5, lng: 73.8 }, customer: { name: "Sub", phone: "+919000000000" }, paymentMode: "offline" },
    actor,
  );
  near(sub.total, Math.round(2099 * 1.05), "plan total incl. 5% GST");
  const menuNow = (await adminDb.collection("menuItems").get()).docs.map((d) => ({ id: d.id, ...d.data() })) as never[];
  let gen = await subsSvc.generateSubscriptionOrders(start, actor, menuNow);
  assert.equal(gen.created.length, 0, "unpaid subscription produces no kitchen orders");
  await subsSvc.activateSubscription(sub.id, null);
  const subDoc = (await adminDb.collection("subscriptions").doc(sub.id).get()).data()!;
  assert.equal(subDoc.status, "active");
  assert.ok(String(subDoc.invoiceNo).startsWith("LF/"), "subscription gets a GST invoice number");
  gen = await subsSvc.generateSubscriptionOrders(start, actor, menuNow);
  assert.equal(gen.created.length, 1, "one kitchen order for the due day");
  const rerun = await subsSvc.generateSubscriptionOrders(start, actor, menuNow);
  assert.equal(rerun.created.length, 0, "re-running the day creates no duplicates");
  const mealOrder = (await adminDb.collection("orders").where("subscriptionId", "==", sub.id).get()).docs;
  assert.equal(mealOrder.length, 1);
  const mo = mealOrder[0]!.data();
  assert.equal(mo.cgst, 0, "no second GST on a prepaid meal");
  assert.equal(mo.invoiceNo, undefined, "no second invoice on a prepaid meal");
  assert.equal(mo.stockDeducted, true, "meal deducts stock");
  assert.ok(["veg"].includes((MENU_ITEMS.find((m) => m.id === mo.lines[0].menuItemId)?.diet) ?? ""), "veg subscriber gets a veg bowl");
  near(mo.lines[0].unitPrice, 420, "meal valued at per-bowl plan price");
  const after = (await adminDb.collection("subscriptions").doc(sub.id).get()).data()!;
  assert.equal(after.mealsUsed, 1);
  await subsSvc.updateSubscription(sub.id, { type: "skip", date: addDays(start, 1) }, actor, true, menuNow);
  gen = await subsSvc.generateSubscriptionOrders(addDays(start, 1), actor, menuNow);
  assert.equal(gen.created.length, 0, "skipped day produces no order");
  ok(`subscription: GST invoice on purchase, 1 prepaid kitchen order (no double GST), idempotent, skip honoured`);

  // ---- Wastage, counts, batch close
  await ops.recordWastage("lettuce", 100, "Wilted", actor);
  const counted = await ops.stockCount("lettuce", 2000, "Weekly count", actor);
  near(await stock("lettuce"), 2000, "count sets stock");
  ok(`wastage logged; stock count variance ${counted.variance} g`);

  const b = (await adminDb.collection("prepBatches").where("itemId", "==", "mango-chilli-dressing").get()).docs[0]!;
  await ops.closeBatch(b.id, "expired", "Past use-by", actor);
  near(await stock("mango-chilli-dressing"), 0, "expired batch's remaining stock written off");
  ok("expired batch closed and written off");

  // Ledger consistency: every item's stock equals the sum of its movements.
  const moves = await adminDb.collection("stockMovements").get();
  const sums = new Map<string, number>();
  for (const m of moves.docs) sums.set(m.get("itemId"), (sums.get(m.get("itemId")) ?? 0) + (m.get("qty") as number));
  const all = await adminDb.collection("items").get();
  for (const d of all.docs) near(d.get("currentStock") as number, round2(sums.get(d.id) ?? 0), `ledger for ${d.id}`);
  ok(`ledger reconciles: ${moves.size} movements match stock on all ${all.size} items`);

  console.log("\nAll end-to-end checks passed.");
  process.exit(0);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
