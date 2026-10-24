import "server-only";
import type { Order, Subscription } from "@/lib/types";
import { DAY_NAMES, SLOT_LABEL } from "@/lib/subscriptions";
import { abs, bill, type BillLine, type Brand, button, details, esc, hero, inr, layout, note, para, progress, textVersion } from "./layout";

export interface Email {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

const first = (name?: string) => (name || "there").trim().split(/\s+/)[0]!;
const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function make(brand: Brand, subject: string, preheader: string, blocks: string[], text: (string | false | null | undefined)[], audience?: "customer" | "staff"): Email {
  return { subject, preheader, html: layout({ preheader, blocks, brand, audience }), text: textVersion(text, brand) };
}

// ── order helpers ───────────────────────────────────────

type OrderLike = Pick<
  Order,
  "id" | "orderNo" | "customer" | "lines" | "subtotal" | "discount" | "packagingCharge" | "deliveryCharge" | "cgst" | "sgst" | "roundOff" | "total" | "paymentMode" | "paymentStatus" | "delivery" | "createdAt"
> &
  Partial<Pick<Order, "invoiceNo" | "payment" | "notes" | "status">> & { cancelReason?: string };

const orderUrl = (o: { id: string }) => `/account/orders/${o.id}`;
const isPickup = (o: OrderLike) => o.delivery?.provider === "pickup";

function orderBill(o: OrderLike, images: Record<string, string | null | undefined>) {
  const lines: BillLine[] = o.lines.map((l) => ({ name: l.name, qty: l.qty, amount: l.lineTotal, imageUrl: images[l.menuItemId], note: l.notes }));
  const gst = (o.cgst ?? 0) + (o.sgst ?? 0);
  return bill(
    lines,
    [
      ["Subtotal", o.subtotal],
      ["Discount", -(o.discount ?? 0)],
      ["Packaging", o.packagingCharge ?? 0],
      ["Delivery", o.deliveryCharge ?? 0],
      ["GST", gst],
      ["Round off", o.roundOff ?? 0],
    ],
    o.total,
    o.invoiceNo ? `Tax invoice ${esc(o.invoiceNo)} · ${paymentText(o)}` : paymentText(o),
  );
}

function paymentText(o: OrderLike) {
  if ((o.payment?.refundedAmount ?? 0) > 0) return `Refunded ${inr(o.payment!.refundedAmount!)}`;
  if (o.paymentStatus === "paid") return o.payment?.method ? `Paid online via ${o.payment.method.toUpperCase()}` : o.paymentMode === "online" ? "Paid online" : "Paid";
  return o.paymentMode === "online" ? "Payment pending" : "Pay on delivery (cash / UPI)";
}

const STEPS = ["Placed", "Preparing", "On the way", "Delivered"];
const STEPS_PICKUP = ["Placed", "Preparing", "Ready", "Collected"];

function addressText(o: OrderLike) {
  const a = o.customer.address;
  return a ? [a.line1, a.line2, a.landmark, a.city, a.pincode].filter(Boolean).map(esc).join(", ") : "";
}

function orderItemsText(o: OrderLike) {
  return o.lines.map((l) => `${l.qty} × ${l.name} — ${inr(l.lineTotal)}`).join("\n") + `\nTotal: ${inr(o.total)} (${paymentText(o)})`;
}

// ── customer: account ───────────────────────────────────

export function welcome(brand: Brand, a: { name?: string }): Email {
  return make(
    brand,
    `Welcome to Leafli, ${first(a.name)} 🥗`,
    "Fresh salads and bowls, made to order in our kitchen. Here's how it works.",
    [
      hero({ emoji: "👋", eyebrow: "Welcome", title: `Hi ${first(a.name)}, welcome to Leafli`, text: "Your account is ready. Every bowl is weighed and assembled fresh when you order — no shortcuts, no sad salads." }),
      details(
        [
          ["🥗 Order a bowl", "Pick, pay, track it live"],
          ["🗓️ Subscribe & save", "Bowls on your days, your diet"],
          ["🔔 Live updates", "Turn on notifications for status alerts"],
        ],
        "What you can do",
      ),
      button("Explore the menu", "/menu"),
      para(`<span style="color:#5d6b63;font-size:14px;">Prefer a routine? <a href="${esc(abs("/plans"))}">See our meal plans</a> — choose your days and we handle the rest.</span>`),
    ],
    [`Hi ${first(a.name)}, welcome to Leafli!`, "Your account is ready. Every bowl is made fresh when you order.", `Menu: ${abs("/menu")}`, `Meal plans: ${abs("/plans")}`],
  );
}

// ── customer: orders ────────────────────────────────────

/** Sent once the order is live: pay-later orders at once, online orders once paid. */
export function orderReceived(brand: Brand, o: OrderLike, images: Record<string, string | null | undefined> = {}): Email {
  const paid = o.paymentStatus === "paid";
  const title = paid ? "Payment received — your order is in!" : "We've got your order!";
  return make(
    brand,
    `${paid ? "Order confirmed" : "Order received"} · ${o.orderNo}`,
    `${o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")} — ${inr(o.total)}. We'll keep you posted.`,
    [
      hero({ emoji: "🥗", eyebrow: `Order ${o.orderNo}`, title, text: `Thanks ${esc(first(o.customer.name))}! The kitchen is reviewing your order now. We'll email you again when it's ${isPickup(o) ? "ready to collect" : "on the way"}.` }),
      progress(isPickup(o) ? STEPS_PICKUP : STEPS, 0),
      button("Track your order", orderUrl(o)),
      orderBill(o, images),
      details(
        [
          ["Placed", esc(fmtTime(o.createdAt))],
          [isPickup(o) ? "Pickup" : "Deliver to", isPickup(o) ? "From our kitchen" : addressText(o) || "—"],
          ...(o.notes ? ([["Note", esc(o.notes)]] as [string, string][]) : []),
        ],
        "Details",
      ),
      ...(!paid && o.paymentMode !== "online" ? [note(`💵 <b>Pay on delivery.</b> Keep ${inr(o.total)} ready by cash or UPI.`, "mango")] : []),
    ],
    [title, `Order ${o.orderNo}`, orderItemsText(o), `Track: ${abs(orderUrl(o))}`],
  );
}

export function orderReadyForPickup(brand: Brand, o: OrderLike): Email {
  return make(
    brand,
    `Ready to collect · ${o.orderNo}`,
    "Your bowl is packed and waiting at the counter.",
    [
      hero({ emoji: "🛍️", eyebrow: `Order ${o.orderNo}`, title: "Your order is ready to collect", text: "Packed and sealed, dressings on the side. Show this order number at the counter." }),
      progress(STEPS_PICKUP, 2),
      details([["Order number", `<span style="font-size:18px;">${esc(o.orderNo.slice(-3))}</span>`], ["Amount", `${inr(o.total)} · ${paymentText(o)}`]]),
      button("View order", orderUrl(o)),
    ],
    [`Order ${o.orderNo} is ready to collect.`, `Amount: ${inr(o.total)} (${paymentText(o)})`],
  );
}

export function orderOnTheWay(brand: Brand, o: OrderLike & { delivery: Order["delivery"] }): Email {
  const d = o.delivery;
  return make(
    brand,
    `On the way 🛵 · ${o.orderNo}`,
    d.partnerName ? `${d.partnerName} has picked up your order.` : "Your rider has picked up your order.",
    [
      hero({ emoji: "🛵", eyebrow: `Order ${o.orderNo}`, title: "Your bowl is on the way", text: "Your rider has picked it up from our kitchen. Keep your phone handy." }),
      progress(STEPS, 2),
      details(
        [
          ...(d.partnerName ? ([["Rider", esc(d.partnerName)]] as [string, string][]) : []),
          ...(d.partnerPhone ? ([["Rider phone", `<a href="tel:${esc(d.partnerPhone)}">${esc(d.partnerPhone)}</a>`]] as [string, string][]) : []),
          ["Deliver to", addressText(o) || "—"],
          ["Amount", `${inr(o.total)} · ${paymentText(o)}`],
        ],
      ),
      button(d.trackingUrl ? "Track the rider live" : "Track your order", d.trackingUrl || orderUrl(o)),
      ...(o.paymentStatus !== "paid" ? [note(`💵 Please keep <b>${inr(o.total)}</b> ready — cash or UPI to the rider.`, "mango")] : []),
      note("🥗 <b>Tip:</b> toss your dressing in just before eating for the best crunch.", "lime"),
    ],
    [`Order ${o.orderNo} is on the way.`, d.partnerName && `Rider: ${d.partnerName}${d.partnerPhone ? ` (${d.partnerPhone})` : ""}`, `Track: ${d.trackingUrl || abs(orderUrl(o))}`],
  );
}

export function orderDelivered(brand: Brand, o: OrderLike, reviewUrl?: string): Email {
  return make(
    brand,
    `Delivered — enjoy! 💚 · ${o.orderNo}`,
    "Tell us how it was — it takes 10 seconds.",
    [
      hero({ emoji: "💚", eyebrow: `Order ${o.orderNo}`, title: "Delivered. Enjoy your bowl!", text: `Thanks for choosing Leafli, ${esc(first(o.customer.name))}. We'd love to know how it tasted.` }),
      progress(isPickup(o) ? STEPS_PICKUP : STEPS, 3),
      button("Rate your order", orderUrl(o)),
      ...(reviewUrl ? [para(`<span style="color:#5d6b63;font-size:14px;">Loved it? A <a href="${esc(reviewUrl)}">Google review</a> helps a small kitchen more than you'd think.</span>`)] : []),
      note(`🗓️ <b>Eat like this every day?</b> Our <a href="${esc(abs("/plans"))}">meal plans</a> bring your bowls on the days you choose.`, "lime"),
    ],
    [`Order ${o.orderNo} has been delivered. Enjoy!`, `Rate it: ${abs(orderUrl(o))}`, reviewUrl && `Google review: ${reviewUrl}`],
  );
}

export function orderCancelled(brand: Brand, o: OrderLike): Email {
  const paid = Boolean(o.payment?.paymentId);
  const refund = paid
    ? note(`💸 <b>Refund of ${inr(o.payment?.refundedAmount || o.total)} started</b> to your original payment method. Banks usually take 5–7 working days. We'll email you when it lands.`, "leaf")
    : note("You haven't been charged for this order.", "leaf");
  return make(
    brand,
    `Order cancelled · ${o.orderNo}`,
    paid ? "Your refund has been started." : "You haven't been charged.",
    [
      hero({ emoji: "🙏", eyebrow: `Order ${o.orderNo}`, title: "Your order was cancelled", text: o.cancelReason ? `Reason: ${esc(o.cancelReason)}` : "We're sorry this one didn't work out." }),
      refund,
      button("Order again", "/menu"),
      para(`<span style="color:#5d6b63;font-size:14px;">Something wrong? Just reply to this email and we'll sort it out.</span>`),
    ],
    [`Order ${o.orderNo} was cancelled.`, o.cancelReason && `Reason: ${o.cancelReason}`, paid ? `A refund of ${inr(o.payment?.refundedAmount || o.total)} has been started (5–7 working days).` : "You haven't been charged."],
  );
}

export function paymentLink(brand: Brand, o: OrderLike, url: string): Email {
  return make(
    brand,
    `Pay ${inr(o.total)} for order ${o.orderNo}`,
    "Secure payment by UPI, card or netbanking — takes a few seconds.",
    [
      hero({ emoji: "🔒", eyebrow: `Order ${o.orderNo}`, title: `Complete your payment of ${inr(o.total)}`, text: "Pay securely with UPI, card, netbanking or wallet through Razorpay. The link is valid for 7 days." }),
      button(`Pay ${inr(o.total)}`, url),
      orderBill(o, {}),
    ],
    [`Pay ${inr(o.total)} for order ${o.orderNo}:`, url, orderItemsText(o)],
  );
}

// ── customer: refunds ───────────────────────────────────

export function refundStarted(brand: Brand, a: { name?: string; what: string; amount: number; full: boolean; reason?: string; url: string }): Email {
  return make(
    brand,
    `Refund of ${inr(a.amount)} started · ${a.what}`,
    "Banks usually take 5–7 working days. We'll email you when it lands.",
    [
      hero({ emoji: "💸", eyebrow: "Refund", title: `We've refunded ${inr(a.amount)}`, text: `Hi ${esc(first(a.name))}, we've started a ${a.full ? "full" : "partial"} refund for ${esc(a.what)}.` }),
      details([
        ["Amount", inr(a.amount)],
        ["To", "Your original payment method"],
        ["Expected", "5–7 working days"],
        ...(a.reason ? ([["Reason", esc(a.reason)]] as [string, string][]) : []),
      ]),
      button("View details", a.url),
    ],
    [`We've started a refund of ${inr(a.amount)} for ${a.what}.`, "It goes back to your original payment method in 5–7 working days."],
  );
}

export function refundCompleted(brand: Brand, a: { name?: string; what: string; amount: number; url: string }): Email {
  return make(
    brand,
    `Refund complete · ${inr(a.amount)}`,
    "The money is on its way to your account.",
    [
      hero({ emoji: "✅", eyebrow: "Refund", title: `Your refund of ${inr(a.amount)} is complete`, text: `Razorpay has processed the refund for ${esc(a.what)}. Depending on your bank it can take a couple of days to show on your statement.` }),
      button("View details", a.url),
    ],
    [`Your refund of ${inr(a.amount)} for ${a.what} has been processed.`],
  );
}

// ── customer: subscriptions ─────────────────────────────

type SubLike = Pick<Subscription, "id" | "planName" | "customer" | "startDate" | "endDate" | "mealsTotal" | "deliveryDays" | "slot" | "diet" | "price" | "cgst" | "sgst" | "total" | "paymentMode" | "paymentStatus" | "address"> &
  Partial<Pick<Subscription, "invoiceNo" | "payment" | "mealsUsed">>;

const subUrl = (s: { id: string }) => `/account/subscriptions/${s.id}`;
const days = (s: SubLike) => s.deliveryDays.map((d) => DAY_NAMES[d]).join(", ");
const DIET: Record<string, string> = { veg: "Veg", egg: "Egg", nonveg: "Non-veg" };

function planDetails(s: SubLike) {
  return details(
    [
      ["Plan", esc(s.planName)],
      ["Bowls", `${s.mealsTotal}`],
      ["Starts", esc(fmtDate(s.startDate))],
      ["Valid until", esc(fmtDate(s.endDate))],
      ["Days", esc(`${days(s)} · ${SLOT_LABEL[s.slot] ?? s.slot}`)],
      ["Diet", esc(DIET[s.diet] ?? s.diet)],
    ],
    "Your plan",
  );
}

export function subscriptionActive(brand: Brand, s: SubLike): Email {
  return make(
    brand,
    `${s.planName} is active 🎉`,
    `Your first bowl arrives ${fmtDate(s.startDate)}.`,
    [
      hero({ emoji: "🎉", eyebrow: "Subscription", title: `${s.planName} is active`, text: `Welcome aboard, ${esc(first(s.customer.name))}! Your first bowl arrives <b>${esc(fmtDate(s.startDate))}</b>. Pick your bowls any time — or let our chef surprise you.` }),
      button("Choose your bowls", subUrl(s)),
      planDetails(s),
      bill(
        [{ name: s.planName, qty: 1, amount: s.price }],
        [["CGST", s.cgst], ["SGST", s.sgst]],
        s.total,
        `${s.invoiceNo ? `Tax invoice ${esc(s.invoiceNo)} · ` : ""}${s.payment?.method ? `Paid via ${esc(s.payment.method.toUpperCase())}` : "Paid"}`,
        "Invoice",
      ),
      note("⏰ Changes for any day (skip, pause, pick a bowl) close at <b>9 pm the day before</b>.", "lime"),
    ],
    [`${s.planName} is active!`, `First bowl: ${fmtDate(s.startDate)}`, `Days: ${days(s)}`, `Total paid: ${inr(s.total)}`, `Manage: ${abs(subUrl(s))}`],
  );
}

export function subscriptionAwaitingPayment(brand: Brand, s: SubLike): Email {
  return make(
    brand,
    `One step left: pay for ${s.planName}`,
    `${inr(s.total)} to start your plan on ${fmtDate(s.startDate)}.`,
    [
      hero({ emoji: "🗓️", eyebrow: "Subscription", title: `Your ${s.planName} is reserved`, text: s.paymentMode === "online" ? "Complete the payment to confirm your deliveries." : "Our team will contact you to collect payment before your first delivery." }),
      ...(s.paymentMode === "online" ? [button(`Pay ${inr(s.total)}`, subUrl(s))] : []),
      planDetails(s),
    ],
    [`Your ${s.planName} is reserved.`, `Amount: ${inr(s.total)}`, `Manage: ${abs(subUrl(s))}`],
  );
}

export function subscriptionChanged(brand: Brand, s: SubLike, change: "paused" | "resumed" | "cancelled", extra?: string): Email {
  const m = {
    paused: { emoji: "⏸️", title: "Your plan is paused", text: "No deliveries until you resume. Paused days are added back to your validity when you resume." },
    resumed: { emoji: "▶️", title: "Welcome back — your plan is running again", text: `Deliveries continue on ${esc(days(s))}. Your plan is now valid until <b>${esc(fmtDate(s.endDate))}</b>.` },
    cancelled: { emoji: "👋", title: "Your plan has been cancelled", text: "We're sorry to see you go. If any refund is due, you'll get a separate email when it's started." },
  }[change];
  return make(
    brand,
    `${s.planName}: ${change}`,
    m.title,
    [hero({ emoji: m.emoji, eyebrow: s.planName, title: m.title, text: m.text }), ...(extra ? [note(esc(extra), "leaf")] : []), button(change === "cancelled" ? "See our plans" : "Manage your plan", change === "cancelled" ? "/plans" : subUrl(s))],
    [`${s.planName}: ${m.title}`, extra],
  );
}

export function subscriptionEndingSoon(brand: Brand, s: SubLike, left: number): Email {
  return make(
    brand,
    `${left} bowl${left === 1 ? "" : "s"} left on your ${s.planName}`,
    "Renew now so your deliveries don't stop.",
    [
      hero({ emoji: "⏳", eyebrow: s.planName, title: `Only ${left} bowl${left === 1 ? "" : "s"} left`, text: `Your plan ends soon (valid until ${esc(fmtDate(s.endDate))}). Renew now and your bowls keep coming without a gap.` }),
      button("Renew my plan", "/plans"),
    ],
    [`Only ${left} bowls left on your ${s.planName}.`, `Renew: ${abs("/plans")}`],
  );
}

export function subscriptionCompleted(brand: Brand, s: SubLike, expired: boolean): Email {
  return make(
    brand,
    expired ? `Your ${s.planName} has expired` : `You finished your ${s.planName} 🎉`,
    "Thanks for eating fresh with us. Ready for another round?",
    [
      hero({
        emoji: expired ? "📅" : "🏁",
        eyebrow: s.planName,
        title: expired ? "Your plan has expired" : `${s.mealsTotal} bowls done — well played!`,
        text: expired ? `Your plan's validity ended on ${esc(fmtDate(s.endDate))}.` : `Thanks for eating fresh with us, ${esc(first(s.customer.name))}.`,
      }),
      button("Start a new plan", "/plans"),
    ],
    [expired ? `Your ${s.planName} has expired.` : `You've finished your ${s.planName}.`, `New plan: ${abs("/plans")}`],
  );
}

// ── staff alerts ────────────────────────────────────────

export function staffNewOrder(brand: Brand, o: OrderLike & { source: string }): Email {
  const src = o.source === "zomato" ? "Zomato" : o.source === "pos" ? "POS" : "Website";
  return make(
    brand,
    `🔔 New ${src} order ${o.orderNo.slice(-3)} · ${inr(o.total)}`,
    o.lines.map((l) => `${l.qty}× ${l.name}`).join(", "),
    [
      hero({ eyebrow: `${src} order`, title: `${o.orderNo} · ${inr(o.total)}`, text: `${esc(o.customer.name)}${o.customer.phone ? ` · ${esc(o.customer.phone)}` : ""}` }),
      button("Open in admin", `/admin/orders/${o.id}`),
      orderBill(o, {}),
      details([
        [isPickup(o) ? "Pickup" : "Deliver to", isPickup(o) ? "Customer pickup" : addressText(o) || "—"],
        ["Payment", paymentText(o)],
        ...(o.notes ? ([["Note", esc(o.notes)]] as [string, string][]) : []),
      ]),
    ],
    [`New ${src} order ${o.orderNo} — ${inr(o.total)}`, orderItemsText(o), abs(`/admin/orders/${o.id}`)],
    "staff",
  );
}

export function staffNewSubscription(brand: Brand, s: SubLike): Email {
  return make(
    brand,
    `🗓️ New plan: ${s.planName} · ${s.customer.name}`,
    `Starts ${fmtDate(s.startDate)} · ${inr(s.total)}`,
    [
      hero({ eyebrow: "New subscription", title: `${s.planName} · ${inr(s.total)}`, text: `${esc(s.customer.name)}${s.customer.phone ? ` · ${esc(s.customer.phone)}` : ""}` }),
      button("Open subscriptions", "/admin/subscriptions"),
      planDetails(s),
      details([["Address", [s.address.line1, s.address.line2, s.address.city, s.address.pincode].filter(Boolean).map(esc).join(", ")], ["Payment", s.paymentStatus === "paid" ? "Paid online" : s.paymentMode === "online" ? "Online — pending" : "Collect offline"]]),
    ],
    [`New ${s.planName} for ${s.customer.name}`, `Starts ${fmtDate(s.startDate)}`, abs("/admin/subscriptions")],
    "staff",
  );
}

export function staffPaymentIssue(brand: Brand, a: { title: string; detail: string; url: string }): Email {
  return make(
    brand,
    `⚠️ ${a.title}`,
    a.detail,
    [hero({ emoji: "⚠️", eyebrow: "Needs attention", title: a.title }), note(esc(a.detail), "tomato"), button("Open in admin", a.url)],
    [a.title, a.detail, abs(a.url)],
    "staff",
  );
}

export function testEmail(brand: Brand): Email {
  return make(
    brand,
    "Leafli email is working ✅",
    "Your SMTP settings are correct.",
    [hero({ emoji: "✅", eyebrow: "Test", title: "Email is set up correctly", text: "This message was sent from your Leafli kitchen system through support@leafli.in. Customers will get order, payment and plan emails like this one." })],
    ["Email is set up correctly."],
    "staff",
  );
}
