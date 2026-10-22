"use client";

import { api } from "@/lib/api";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: unknown) => void) => void };
  }
}

let loading: Promise<void> | null = null;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(s);
  });
  return loading;
}

export interface CheckoutArgs {
  keyId: string;
  rzpOrderId: string;
  amount: number; // paise
  orderId: string;
  orderNo: string;
  prefill?: { name?: string; email?: string; contact?: string };
  /** Defaults to order verification; subscriptions pass their own endpoint. */
  verifyPath?: string;
  description?: string;
}

/**
 * Open Razorpay Checkout and verify the payment on our server.
 * Resolves "paid" on success, "dismissed" if the customer closes the window.
 */
export async function payWithRazorpay(a: CheckoutArgs): Promise<"paid" | "dismissed"> {
  await loadCheckout();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: a.keyId,
      order_id: a.rzpOrderId,
      amount: a.amount,
      currency: "INR",
      name: "Leafli",
      description: a.description ?? `Order ${a.orderNo}`,
      image: "/brand/favicon.png",
      prefill: a.prefill,
      theme: { color: "#255f30" },
      handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          await api(a.verifyPath ?? "/api/payments/razorpay/verify", a.verifyPath ? r : { orderId: a.orderId, ...r });
          resolve("paid");
        } catch (e) {
          reject(e);
        }
      },
      modal: { ondismiss: () => resolve("dismissed"), confirm_close: true },
    });
    rzp.on("payment.failed", () => {
      /* Checkout shows the failure and lets the customer retry; nothing to do here. */
    });
    rzp.open();
  });
}
