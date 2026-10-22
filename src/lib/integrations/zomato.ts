import "server-only";
import crypto from "node:crypto";
import type { Address, OrderStatus } from "@/lib/types";

/**
 * Zomato order integration adapter.
 *
 * Zomato does not offer a self-serve public ordering API. Restaurants receive
 * orders programmatically either (a) as an approved Zomato POS integration
 * partner, or (b) through an aggregator middleware (UrbanPiper, Petpooja, etc.)
 * that relays Zomato orders as webhooks and accepts status callbacks.
 *
 * Both routes work the same way from our side:
 *   inbound  – a webhook POSTs an order to /api/integrations/zomato/webhook
 *   outbound – we POST status changes (accept / ready / reject) back
 *
 * The exact payload shape comes from whichever partner you onboard with, so
 * ALL field mapping lives in `normalizeZomatoOrder` below. Until then the
 * webhook accepts the normalised shape documented in docs/INTEGRATIONS.md, and
 * staff can punch Zomato orders into the POS manually (source = Zomato).
 */

export interface NormalizedExternalOrder {
  externalId: string;
  customer: { name: string; phone?: string; address?: Address | null };
  lines: { externalItemId?: string; menuItemId?: string; name: string; qty: number; unitPrice: number }[];
  discount: number;
  notes?: string;
  deliveryByAggregator: boolean;
  placedAt?: number;
}

const SECRET = process.env.ZOMATO_WEBHOOK_SECRET || "";

/** Verify an HMAC-SHA256 signature of the raw body (hex), or a shared-secret header. */
export function verifyZomatoSignature(rawBody: string, headers: Headers): boolean {
  if (!SECRET) return false;
  const sig = headers.get("x-signature") ?? headers.get("x-zomato-signature") ?? "";
  if (sig) {
    const expected = crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex");
    const a = Buffer.from(sig.replace(/^sha256=/, ""));
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const shared = headers.get("x-webhook-secret") ?? "";
  const a = Buffer.from(shared);
  const b = Buffer.from(SECRET);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type AnyObj = Record<string, unknown>;
const get = (o: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as AnyObj)[k] : undefined), o);
const first = (o: unknown, ...paths: string[]) => paths.map((p) => get(o, p)).find((v) => v != null && v !== "");

/**
 * Map a partner payload to our normalised order. Handles the normalised shape
 * directly plus common relay layouts ({order: {...}}, {details, items}).
 * Adjust here once the partner spec is in hand.
 */
export function normalizeZomatoOrder(body: AnyObj): NormalizedExternalOrder {
  const o = (body.order as AnyObj) ?? body;
  const externalId = String(first(o, "externalId", "order_id", "id", "details.id", "details.ext_platforms.0.id") ?? "");
  if (!externalId) throw new Error("Zomato payload has no order id");
  const rawItems = (first(o, "lines", "items", "order_items", "dishes") as AnyObj[] | undefined) ?? [];
  const lines = rawItems.map((it) => ({
    externalItemId: first(it, "externalItemId", "item_id", "merchant_id", "id") as string | undefined,
    menuItemId: first(it, "menuItemId") as string | undefined,
    name: String(first(it, "name", "title", "item_name") ?? "Item"),
    qty: Number(first(it, "qty", "quantity") ?? 1),
    unitPrice: Number(first(it, "unitPrice", "price", "unit_price") ?? 0),
  }));
  const cust = (first(o, "customer", "customer_details") as AnyObj | undefined) ?? {};
  const addr = first(cust, "address") as AnyObj | string | undefined;
  return {
    externalId,
    customer: {
      name: String(first(cust, "name") ?? "Zomato customer"),
      phone: first(cust, "phone", "phone_number") as string | undefined,
      address:
        addr && typeof addr === "object"
          ? {
              line1: String(first(addr, "line1", "line_1", "address") ?? ""),
              city: String(first(addr, "city") ?? ""),
              state: String(first(addr, "state") ?? ""),
              pincode: String(first(addr, "pincode", "pin") ?? ""),
              lat: first(addr, "lat", "latitude") as number | undefined,
              lng: first(addr, "lng", "longitude") as number | undefined,
            }
          : null,
    },
    lines,
    discount: Number(first(o, "discount", "total_discount", "details.discount") ?? 0),
    notes: first(o, "notes", "instructions", "details.instructions") as string | undefined,
    // Zomato orders are normally delivered by Zomato's own riders.
    deliveryByAggregator: (first(o, "deliveryByAggregator") as boolean | undefined) ?? true,
    placedAt: Number(first(o, "placedAt", "created_at", "details.created")) || undefined,
  };
}

const STATUS_URL = process.env.ZOMATO_STATUS_CALLBACK_URL || "";
const STATUS_KEY = process.env.ZOMATO_API_KEY || "";

/** Map our status to the partner's vocabulary. */
const OUTBOUND: Partial<Record<OrderStatus, string>> = {
  accepted: "Acknowledged",
  preparing: "Food Ready Pending",
  ready: "Food Ready",
  dispatched: "Dispatched",
  delivered: "Completed",
  cancelled: "Cancelled",
};

/** Push a status change back to Zomato (or the relay partner). No-op if not configured. */
export async function pushZomatoStatus(externalId: string, status: OrderStatus, reason?: string) {
  if (!STATUS_URL || !OUTBOUND[status]) return { skipped: true };
  const res = await fetch(STATUS_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...(STATUS_KEY ? { authorization: `Bearer ${STATUS_KEY}` } : {}) },
    body: JSON.stringify({ order_id: externalId, new_status: OUTBOUND[status], message: reason ?? "" }),
  });
  if (!res.ok) throw new Error(`Zomato status push failed: ${res.status} ${await res.text()}`);
  return { ok: true };
}

const STOCK_URL = process.env.ZOMATO_ITEM_STOCK_URL || "";

/** Toggle an item in/out of stock on Zomato. No-op if not configured. */
export async function pushZomatoItemStock(zomatoItemIds: string[], available: boolean) {
  if (!STOCK_URL || !zomatoItemIds.length) return { skipped: true };
  const res = await fetch(STOCK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...(STATUS_KEY ? { authorization: `Bearer ${STATUS_KEY}` } : {}) },
    body: JSON.stringify({ item_ids: zomatoItemIds, in_stock: available }),
  });
  if (!res.ok) throw new Error(`Zomato stock push failed: ${res.status}`);
  return { ok: true };
}
