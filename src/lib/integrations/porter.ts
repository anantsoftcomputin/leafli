import "server-only";
import type { Address, BusinessSettings } from "@/lib/types";

/**
 * Porter API for Businesses client.
 *
 * Endpoints follow Porter's integration docs (shared on onboarding):
 *   POST /v1/get_quote           – fares/ETAs per vehicle for a pickup→drop pair
 *   POST /v1/orders/create       – book a delivery
 *   GET  /v1/orders/{order_id}   – status, partner info, fare
 *   POST /v1/orders/{order_id}/cancel
 * Auth: `x-api-key` header. UAT and production use different base URLs, so the
 * base URL is configured via PORTER_BASE_URL. Verify field names against the
 * version of the spec Porter gives you — all mapping lives in this file.
 */

const BASE = process.env.PORTER_BASE_URL || "https://pfe-apigw-uat.porter.in";
const KEY = process.env.PORTER_API_KEY || "";

export const porterConfigured = () => Boolean(KEY);

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!KEY) throw new Error("Porter is not configured (set PORTER_API_KEY)");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-api-key": KEY, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = (body as { message?: string } | null)?.message ?? text;
    throw new Error(`Porter ${res.status}: ${msg}`);
  }
  return body as T;
}

const mobile = (phone?: string) => ({
  country_code: "+91",
  number: (phone ?? "").replace(/\D/g, "").slice(-10),
});

function porterAddress(a: Address, contact: { name: string; phone?: string }) {
  return {
    apartment_address: a.line2 ?? "",
    street_address1: a.line1,
    street_address2: "",
    landmark: a.landmark ?? "",
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    country: "India",
    lat: a.lat,
    lng: a.lng,
    contact_details: { name: contact.name, phone_number: `+91${mobile(contact.phone).number}` },
  };
}

export interface PorterQuote {
  vehicle: string;
  fare: number; // rupees
  etaMinutes: number | null;
}

export async function getQuote(
  kitchen: BusinessSettings,
  drop: Address,
  customer: { name: string; phone?: string },
): Promise<PorterQuote[]> {
  if (kitchen.address.lat == null || drop.lat == null)
    throw new Error("Kitchen and customer addresses need lat/lng for a Porter quote");
  const r = await call<{
    vehicles?: { type: string; eta?: { value: number; unit: string }; fare?: { minor_amount: number } }[];
  }>("/v1/get_quote", {
    method: "POST",
    body: JSON.stringify({
      pickup_details: { lat: kitchen.address.lat, lng: kitchen.address.lng },
      drop_details: { lat: drop.lat, lng: drop.lng },
      customer: { name: customer.name, mobile: mobile(customer.phone) },
    }),
  });
  return (r.vehicles ?? []).map((v) => ({
    vehicle: v.type,
    fare: (v.fare?.minor_amount ?? 0) / 100,
    etaMinutes: v.eta ? (v.eta.unit?.startsWith("hour") ? v.eta.value * 60 : v.eta.value) : null,
  }));
}

export interface PorterBooking {
  porterOrderId: string;
  requestId: string;
  trackingUrl?: string;
  fare?: number;
  estimatedPickup?: number | null;
}

export async function createDelivery(args: {
  requestId: string;
  kitchen: BusinessSettings;
  drop: Address;
  customer: { name: string; phone?: string };
  instructions?: string;
}): Promise<PorterBooking> {
  const { kitchen, drop, customer } = args;
  const r = await call<{
    order_id: string;
    request_id: string;
    tracking_url?: string;
    estimated_pickup_time?: number;
    estimated_fare_details?: { minor_amount: number };
  }>("/v1/orders/create", {
    method: "POST",
    body: JSON.stringify({
      request_id: args.requestId,
      delivery_instructions: {
        instructions_list: [
          { type: "text", description: args.instructions || "Food order — keep upright, handle with care" },
        ],
      },
      pickup_details: { address: porterAddress(kitchen.address, { name: kitchen.name, phone: kitchen.phone }) },
      drop_details: { address: porterAddress(drop, customer) },
      additional_comments: `Leafli order ${args.requestId}`,
    }),
  });
  return {
    porterOrderId: r.order_id,
    requestId: r.request_id,
    trackingUrl: r.tracking_url,
    fare: r.estimated_fare_details ? r.estimated_fare_details.minor_amount / 100 : undefined,
    estimatedPickup: r.estimated_pickup_time ? r.estimated_pickup_time * 1000 : null,
  };
}

export interface PorterStatus {
  status: string; // open | accepted | live | ended | cancelled
  partnerName?: string;
  partnerPhone?: string;
  vehicle?: string;
  fare?: number;
  trackingUrl?: string;
}

export async function getDelivery(porterOrderId: string): Promise<PorterStatus> {
  const r = await call<{
    status: string;
    tracking_url?: string;
    partner_info?: { name?: string; vehicle_type?: string; mobile?: { country_code?: string; mobile_number?: string } };
    fare_details?: { actual_fare_details?: { minor_amount: number }; estimated_fare_details?: { minor_amount: number } };
  }>(`/v1/orders/${encodeURIComponent(porterOrderId)}`);
  return parseStatus(r);
}

export async function cancelDelivery(porterOrderId: string) {
  await call(`/v1/orders/${encodeURIComponent(porterOrderId)}/cancel`, { method: "POST", body: "{}" });
}

/** Normalises a status response or webhook body. */
export function parseStatus(r: Record<string, unknown>): PorterStatus {
  const pi = (r.partner_info ?? {}) as {
    name?: string;
    vehicle_type?: string;
    mobile?: { country_code?: string; mobile_number?: string };
  };
  const fd = (r.fare_details ?? {}) as {
    actual_fare_details?: { minor_amount: number };
    estimated_fare_details?: { minor_amount: number };
  };
  const fare = fd.actual_fare_details?.minor_amount ?? fd.estimated_fare_details?.minor_amount;
  const status = String(r.status ?? r.event_type ?? r.order_status ?? "unknown").toLowerCase();
  return {
    status,
    partnerName: pi.name,
    partnerPhone: pi.mobile?.mobile_number,
    vehicle: pi.vehicle_type,
    fare: fare != null ? fare / 100 : undefined,
    trackingUrl: r.tracking_url as string | undefined,
  };
}

/** Map a Porter status/event to our order status, when it implies one. */
export function orderStatusFromPorter(status: string): "dispatched" | "delivered" | null {
  if (["live", "order_start_trip", "start_trip", "picked_up"].includes(status)) return "dispatched";
  if (["ended", "completed", "order_end_job", "end_job", "delivered"].includes(status)) return "delivered";
  return null;
}
