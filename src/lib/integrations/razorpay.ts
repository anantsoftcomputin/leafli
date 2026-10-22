import "server-only";
import crypto from "node:crypto";

/**
 * Razorpay (Standard Checkout) server helpers.
 * Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 *   1. server creates an Order        POST /v1/orders
 *   2. browser opens Checkout with it  (checkout.js)
 *   3. server verifies the signature   HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 *   4. webhook `payment.captured` / `order.paid` confirms it server-to-server
 */
const KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

export const razorpayConfigured = () => Boolean(KEY_ID && KEY_SECRET);
export const razorpayKeyId = () => KEY_ID;

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
    amount: Math.round(amountRupees * 100),
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
  return call<{ id: string; status: string }>(`/payments/${encodeURIComponent(paymentId)}/refund`, {
    amount: Math.round(amountRupees * 100),
    speed: "normal",
    notes,
  });
}
