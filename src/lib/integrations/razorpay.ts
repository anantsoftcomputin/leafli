import "server-only";
import crypto from "node:crypto";

/**
 * Razorpay (Standard Checkout) server helpers.
 * Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 *   1. server creates an Order        POST /v1/orders
 *   2. browser opens Checkout with it  (checkout.js)
 *   3. server verifies the signature   HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 *   4. webhook `payment.captured` / `order.paid` confirms it server-to-server
 * Plus: capture of authorized payments, refunds (full/partial), payment links for
 * pay-later orders, and order → payments lookup for reconciliation.
 */
const KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

export const razorpayConfigured = () => Boolean(KEY_ID && KEY_SECRET);
export const razorpayKeyId = () => KEY_ID;

export const razorpayMode = () => (KEY_ID.startsWith("rzp_live_") ? "live" : KEY_ID ? "test" : "—");

const paise = (rupees: number) => Math.round(rupees * 100);

export interface RzpPayment {
  id: string;
  order_id: string | null;
  amount: number; // paise
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  amount_refunded?: number;
  error_description?: string | null;
  error_reason?: string | null;
  notes?: Record<string, string> | unknown[];
  created_at: number;
}

export interface RzpRefund {
  id: string;
  payment_id: string;
  amount: number; // paise
  status: "pending" | "processed" | "failed";
  notes?: Record<string, string> | unknown[];
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  if (!razorpayConfigured()) throw new Error("Online payments are not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) throw new Error(`Razorpay: ${data.error?.description ?? res.status}`);
  return data;
}

export function createRazorpayOrder(amountRupees: number, receipt: string, notes: Record<string, string>) {
  return call<{ id: string; amount: number; currency: string; status: string }>("/orders", {
    amount: paise(amountRupees),
    currency: "INR",
    receipt: receipt.slice(0, 40),
    notes,
  });
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Signature returned to the browser after a successful Checkout payment. */
export function verifyPaymentSignature(rzpOrderId: string, paymentId: string, signature: string) {
  const expected = crypto.createHmac("sha256", KEY_SECRET).update(`${rzpOrderId}|${paymentId}`).digest("hex");
  return safeEqual(expected, signature);
}

/** X-Razorpay-Signature on webhooks: HMAC_SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string) {
  if (!WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

export function refundPayment(paymentId: string, amountRupees: number, notes: Record<string, string>) {
  return call<RzpRefund>(`/payments/${encodeURIComponent(paymentId)}/refund`, {
    amount: paise(amountRupees),
    speed: "normal",
    notes,
  });
}

export const fetchPayment = (paymentId: string) => call<RzpPayment>(`/payments/${encodeURIComponent(paymentId)}`);

/** All payment attempts made against a Razorpay order (newest first). */
export const fetchOrderPayments = (rzpOrderId: string) =>
  call<{ items: RzpPayment[] }>(`/orders/${encodeURIComponent(rzpOrderId)}/payments`).then((r) => r.items);

/** Only needed when auto-capture is off in the dashboard; uncaptured payments auto-refund after a few days. */
export const capturePayment = (paymentId: string, amountPaise: number) =>
  call<RzpPayment>(`/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: "INR" });

/**
 * Make sure an authorized payment is captured. Returns the payment in its final state,
 * or null if it can't count as paid (failed / still created).
 */
export async function ensureCaptured(paymentId: string): Promise<RzpPayment | null> {
  let p = await fetchPayment(paymentId);
  if (p.status === "authorized") {
    try {
      p = await capturePayment(p.id, p.amount);
    } catch {
      p = await fetchPayment(paymentId); // raced with auto-capture
    }
  }
  return p.status === "captured" || p.status === "refunded" ? p : null;
}

/** Hosted payment link, sent to the customer by SMS (and email if given) by Razorpay. */
export function createPaymentLink(a: {
  amountRupees: number;
  description: string;
  customer: { name: string; contact?: string; email?: string };
  notes: Record<string, string>;
  callbackUrl?: string;
  expireBy?: number; // unix seconds
}) {
  return call<{ id: string; short_url: string; status: string }>("/payment_links", {
    amount: paise(a.amountRupees),
    currency: "INR",
    description: a.description.slice(0, 2048),
    customer: { name: a.customer.name, ...(a.customer.contact ? { contact: a.customer.contact } : {}), ...(a.customer.email ? { email: a.customer.email } : {}) },
    notify: { sms: Boolean(a.customer.contact), email: Boolean(a.customer.email) },
    reminder_enable: true,
    notes: a.notes,
    ...(a.callbackUrl ? { callback_url: a.callbackUrl, callback_method: "get" } : {}),
    ...(a.expireBy ? { expire_by: a.expireBy } : {}),
  });
}

export const cancelPaymentLink = (linkId: string) => call<{ status: string }>(`/payment_links/${encodeURIComponent(linkId)}/cancel`, {});

/** Cheap authenticated call used by the settings page to prove the keys work. */
export async function pingRazorpay(): Promise<{ ok: boolean; error?: string }> {
  try {
    await call("/payments?count=1");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
