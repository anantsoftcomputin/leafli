import "server-only";
import { WHATSAPP_LANG } from "@/lib/integrations/whatsapp";
import { SITE_URL } from "@/lib/site";

/**
 * Every WhatsApp message Leafli sends. Business-initiated messages must use a
 * Meta-approved template, so these definitions are submitted from Admin → WhatsApp
 * (or created by hand in WhatsApp Manager with the same name and text).
 *
 * Meta's rules these follow: UTILITY category (transactional, cheapest), a body may
 * not start or end with a variable, variables may not sit next to each other, and a
 * URL button has a fixed domain with one dynamic suffix at the end.
 */
export interface WaTemplate {
  name: string;
  label: string;
  audience: "customer" | "team";
  header?: string;
  body: string;
  /** One example value per {{n}} in the body (needed for approval). */
  example: string[];
  button?: { text: string; base: string; example: string };
}

const SITE = `${SITE_URL}/`;
const FOOTER = "Leafli · Fresh bowls. Happy moods.";

export const WA_TEMPLATES = {
  order_confirmed: {
    name: "leafli_order_confirmed",
    label: "Order confirmed",
    audience: "customer",
    header: "Order confirmed ✅",
    body: "Hi {{1}}, thanks for ordering from Leafli! Your order {{2}} is confirmed.\n\nItems: {{3}}\nTotal: {{4}} ({{5}})\n\nWe'll message you here when it's on the way.",
    example: ["Asha", "LF-261025-014", "1× Chicken Caesar Salad, 2× Caprese Salad", "₹1,047", "paid online"],
    button: { text: "Track order", base: SITE, example: `${SITE}account/orders/abc123` },
  },
  order_ready_pickup: {
    name: "leafli_order_ready_pickup",
    label: "Ready for pickup",
    audience: "customer",
    header: "Ready to collect 🛍️",
    body: "Hi {{1}}, your order {{2}} is packed and ready to collect from our kitchen. Please show the order number at the counter.",
    example: ["Asha", "LF-261025-014"],
    button: { text: "View order", base: SITE, example: `${SITE}account/orders/abc123` },
  },
  order_on_the_way: {
    name: "leafli_order_on_the_way",
    label: "Out for delivery",
    audience: "customer",
    header: "On the way 🛵",
    body: "Hi {{1}}, your order {{2}} is on the way with {{3}}.\n\nPayment: {{4}}\n\nTip: toss your dressing in just before eating for the best crunch.",
    example: ["Asha", "LF-261025-014", "Ravi (+91 98000 00000)", "already paid"],
    button: { text: "Track order", base: SITE, example: `${SITE}account/orders/abc123` },
  },
  order_delivered: {
    name: "leafli_order_delivered",
    label: "Delivered",
    audience: "customer",
    header: "Delivered 💚",
    body: "Hi {{1}}, your order {{2}} has been delivered. Enjoy your bowl!\n\nHow was it? Tap below to rate your order — it really helps our small kitchen.",
    example: ["Asha", "LF-261025-014"],
    button: { text: "Rate order", base: SITE, example: `${SITE}account/orders/abc123` },
  },
  order_cancelled: {
    name: "leafli_order_cancelled",
    label: "Order cancelled",
    audience: "customer",
    body: "Hi {{1}}, your Leafli order {{2}} has been cancelled.\n\n{{3}}\n\nReply to this message if you need any help.",
    example: ["Asha", "LF-261025-014", "A refund of ₹1,047 has been started to your original payment method (5–7 working days)."],
  },
  payment_link: {
    name: "leafli_payment_link",
    label: "Payment link",
    audience: "customer",
    header: "Complete your payment",
    body: "Hi {{1}}, please pay {{2}} for your Leafli order {{3}} using the secure Razorpay link below (UPI, card or netbanking). The link is valid for 7 days.",
    example: ["Asha", "₹1,047", "LF-261025-014"],
    button: { text: "Pay now", base: "https://rzp.io/", example: "https://rzp.io/rzp/abc123" },
  },
  refund_started: {
    name: "leafli_refund_started",
    label: "Refund started",
    audience: "customer",
    body: "Hi {{1}}, we've started a refund of {{2}} for {{3}}. It will reach your original payment method in 5–7 working days.",
    example: ["Asha", "₹349", "order LF-261025-014"],
  },
  refund_completed: {
    name: "leafli_refund_completed",
    label: "Refund completed",
    audience: "customer",
    body: "Hi {{1}}, your refund of {{2}} for {{3}} has been processed. Depending on your bank it can take a couple of days to show in your account.",
    example: ["Asha", "₹349", "order LF-261025-014"],
  },
  plan_active: {
    name: "leafli_plan_active",
    label: "Plan active",
    audience: "customer",
    header: "Your plan is active 🎉",
    body: "Hi {{1}}, your {{2}} plan is active! Your first bowl arrives on {{3}}.\n\nPick your bowls, skip or pause anytime — changes close at 9 pm the day before.",
    example: ["Asha", "Monthly Green", "Monday, 27 October"],
    button: { text: "Manage plan", base: SITE, example: `${SITE}account/subscriptions/abc123` },
  },
  plan_reserved: {
    name: "leafli_plan_reserved",
    label: "Plan reserved (pay offline)",
    audience: "customer",
    body: "Hi {{1}}, your {{2}} plan is reserved. Our team will contact you to collect {{3}} before your first delivery on {{4}}.\n\nThank you for choosing Leafli!",
    example: ["Asha", "Monthly Green", "₹6,299", "Monday, 27 October"],
    button: { text: "View plan", base: SITE, example: `${SITE}account/subscriptions/abc123` },
  },
  plan_update: {
    name: "leafli_plan_update",
    label: "Plan paused / resumed / cancelled",
    audience: "customer",
    body: "Hi {{1}}, your {{2}} plan has been {{3}}. You can manage it anytime from your Leafli account.",
    example: ["Asha", "Monthly Green", "paused"],
    button: { text: "Manage plan", base: SITE, example: `${SITE}account/subscriptions/abc123` },
  },
  plan_ending: {
    name: "leafli_plan_ending",
    label: "Plan ending soon",
    audience: "customer",
    body: "Hi {{1}}, only {{2}} bowls are left on your {{3}} plan. Renew now so your deliveries continue without a gap.",
    example: ["Asha", "2", "Monthly Green"],
    button: { text: "Renew plan", base: SITE, example: `${SITE}plans` },
  },
  plan_finished: {
    name: "leafli_plan_finished",
    label: "Plan completed / expired",
    audience: "customer",
    body: "Hi {{1}}, your {{2}} plan has {{3}}. Thank you for eating fresh with Leafli — start a new plan anytime.",
    example: ["Asha", "Monthly Green", "been completed"],
    button: { text: "See plans", base: SITE, example: `${SITE}plans` },
  },
  staff_new_order: {
    name: "leafli_staff_new_order",
    label: "Team: new order",
    audience: "team",
    header: "New order 🔔",
    body: "New {{1}} order {{2}} from {{3}}.\n\nItems: {{4}}\nTotal: {{5}}\n\nOpen the admin to accept it.",
    example: ["website", "LF-261025-014", "Asha (+91 98765 43210)", "1× Chicken Caesar Salad", "₹1,047 · pay on delivery"],
    button: { text: "Open order", base: SITE, example: `${SITE}admin/orders/abc123` },
  },
  staff_alert: {
    name: "leafli_staff_alert",
    label: "Team: needs attention",
    audience: "team",
    header: "Needs attention ⚠️",
    body: "Leafli alert: {{1}}\n\nDetails: {{2}}\n\nPlease check the admin panel.",
    example: ["Refund failed for LF-261025-014", "Razorpay could not process the refund."],
    button: { text: "Open admin", base: SITE, example: `${SITE}admin` },
  },
} satisfies Record<string, WaTemplate>;

export type WaTemplateKey = keyof typeof WA_TEMPLATES;

/** Payload for POST /{waba-id}/message_templates. */
export function toMetaDefinition(t: WaTemplate) {
  const components: unknown[] = [];
  if (t.header) components.push({ type: "HEADER", format: "TEXT", text: t.header });
  components.push({ type: "BODY", text: t.body, ...(t.example.length ? { example: { body_text: [t.example] } } : {}) });
  components.push({ type: "FOOTER", text: FOOTER });
  if (t.button) components.push({ type: "BUTTONS", buttons: [{ type: "URL", text: t.button.text, url: `${t.button.base}{{1}}`, example: [t.button.example] }] });
  return { name: t.name, language: WHATSAPP_LANG, category: "UTILITY", components };
}

/** Plain-text rendering, for the admin preview. */
export function previewText(t: WaTemplate) {
  const body = t.body.replace(/\{\{(\d+)\}\}/g, (_, n) => t.example[Number(n) - 1] ?? "");
  return [t.header && `*${t.header}*`, body, `_${FOOTER}_`].filter(Boolean).join("\n\n");
}
