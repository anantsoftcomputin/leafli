import "server-only";
import type { Order, Subscription } from "@/lib/types";
import type { Brand } from "./layout";
import * as T from "./templates";

/** Realistic sample data so every template can be previewed and test-sent from the admin. */
const now = Date.now();
const order = {
  id: "sample",
  orderNo: "LF-261024-014",
  invoiceNo: "LF/26-27/00042",
  source: "website",
  customer: { name: "Asha Mehta", phone: "+919876543210", email: "asha@example.com", address: { line1: "12, Green Park Society", line2: "MG Road", landmark: "Near City Mall", city: "Pune", state: "Maharashtra", pincode: "411001" } },
  lines: [
    { menuItemId: "chicken-caesar", name: "Chicken Caesar Salad", qty: 1, unitPrice: 349, lineTotal: 349, unitCost: 0 },
    { menuItemId: "caprese", name: "Caprese Salad", qty: 2, unitPrice: 299, lineTotal: 598, unitCost: 0, notes: "No olives" },
  ],
  subtotal: 947,
  discount: 0,
  packagingCharge: 10,
  deliveryCharge: 40,
  taxableValue: 997,
  cgst: 24.93,
  sgst: 24.93,
  roundOff: 0.14,
  total: 1047,
  paymentMode: "online",
  paymentStatus: "paid",
  payment: { provider: "razorpay", rzpOrderId: "order_X", paymentId: "pay_X", method: "upi", refundedAmount: 1047, refundStatus: "pending" },
  delivery: { provider: "porter", partnerName: "Ravi", partnerPhone: "+919800000000", trackingUrl: "https://porter.in" },
  status: "dispatched",
  notes: "Ring the bell twice",
  createdAt: now,
} as unknown as Order;

const sub = {
  id: "sample",
  planName: "Monthly Green",
  customer: { name: "Asha Mehta", phone: "+919876543210", email: "asha@example.com" },
  address: order.customer.address!,
  startDate: new Date(now + 86400000).toISOString().slice(0, 10),
  endDate: new Date(now + 31 * 86400000).toISOString().slice(0, 10),
  mealsTotal: 20,
  mealsUsed: 18,
  deliveryDays: [1, 2, 3, 4, 5],
  slot: "lunch",
  diet: "veg",
  price: 5999,
  cgst: 149.98,
  sgst: 149.98,
  total: 6299,
  paymentMode: "online",
  paymentStatus: "paid",
  invoiceNo: "LF/26-27/00043",
  payment: { provider: "razorpay", rzpOrderId: "order_Y", paymentId: "pay_Y", method: "card" },
} as unknown as Subscription;

const images = {
  "chicken-caesar": null,
  caprese: null,
};

export const SAMPLES: Record<string, { label: string; group: "Customer" | "Team"; build: (b: Brand, imgs?: Record<string, string | null>) => T.Email }> = {
  welcome: { label: "Welcome (new account)", group: "Customer", build: (b) => T.welcome(b, { name: "Asha Mehta" }) },
  order_received_paid: { label: "Order confirmed (paid online)", group: "Customer", build: (b, i) => T.orderReceived(b, { ...order, payment: { ...order.payment!, refundedAmount: 0 } }, i ?? images) },
  order_received_cod: { label: "Order received (pay on delivery)", group: "Customer", build: (b, i) => T.orderReceived(b, { ...order, paymentMode: "pay_later", paymentStatus: "pending", payment: undefined }, i ?? images) },
  order_ready: { label: "Ready for pickup", group: "Customer", build: (b) => T.orderReadyForPickup(b, { ...order, payment: undefined, delivery: { provider: "pickup" } }) },
  order_dispatched: { label: "Out for delivery", group: "Customer", build: (b) => T.orderOnTheWay(b, { ...order, payment: { ...order.payment!, refundedAmount: 0 } }) },
  order_delivered: { label: "Delivered + rate us", group: "Customer", build: (b) => T.orderDelivered(b, order, "https://g.page/r/leafli/review") },
  order_cancelled: { label: "Order cancelled (refund)", group: "Customer", build: (b) => T.orderCancelled(b, { ...order, cancelReason: "Kitchen closed early due to a power cut" }) },
  payment_link: { label: "Payment link", group: "Customer", build: (b) => T.paymentLink(b, { ...order, paymentStatus: "pending", payment: undefined }, "https://rzp.io/l/sample") },
  refund_started: { label: "Refund started", group: "Customer", build: (b) => T.refundStarted(b, { name: "Asha", what: `order ${order.orderNo}`, amount: 349, full: false, reason: "Missing item", url: "/account" }) },
  refund_completed: { label: "Refund completed", group: "Customer", build: (b) => T.refundCompleted(b, { name: "Asha", what: `order ${order.orderNo}`, amount: 349, url: "/account" }) },
  sub_active: { label: "Plan active (with invoice)", group: "Customer", build: (b) => T.subscriptionActive(b, sub) },
  sub_pending: { label: "Plan reserved (awaiting payment)", group: "Customer", build: (b) => T.subscriptionAwaitingPayment(b, { ...sub, paymentMode: "offline", paymentStatus: "pending" }) },
  sub_paused: { label: "Plan paused", group: "Customer", build: (b) => T.subscriptionChanged(b, sub, "paused") },
  sub_resumed: { label: "Plan resumed", group: "Customer", build: (b) => T.subscriptionChanged(b, sub, "resumed") },
  sub_cancelled: { label: "Plan cancelled", group: "Customer", build: (b) => T.subscriptionChanged(b, sub, "cancelled") },
  sub_ending: { label: "Plan ending soon", group: "Customer", build: (b) => T.subscriptionEndingSoon(b, sub, 2) },
  sub_completed: { label: "Plan completed", group: "Customer", build: (b) => T.subscriptionCompleted(b, sub, false) },
  sub_expired: { label: "Plan expired", group: "Customer", build: (b) => T.subscriptionCompleted(b, sub, true) },
  staff_order: { label: "New order alert", group: "Team", build: (b) => T.staffNewOrder(b, { ...order, paymentMode: "pay_later", paymentStatus: "pending", payment: undefined }) },
  staff_sub: { label: "New plan alert", group: "Team", build: (b) => T.staffNewSubscription(b, sub) },
  staff_issue: { label: "Payment problem alert", group: "Team", build: (b) => T.staffPaymentIssue(b, { title: "Refund failed for LF-261024-014", detail: "Razorpay: The refund amount exceeds the captured amount.", url: "/admin/orders/sample" }) },
  test: { label: "SMTP test", group: "Team", build: (b) => T.testEmail(b) },
};
