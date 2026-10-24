import type { NextRequest } from "next/server";
import { z } from "zod";
import { preflight, withCors } from "@/lib/server/cors";
import { HttpError, requireUser, route, STAFF } from "@/lib/server/http";
import { createOrder, setOrderStatus } from "@/lib/server/orders";
import { notifyNewOrder } from "@/lib/server/push";
import { onOrderLive } from "@/lib/server/notifications";
import { col } from "@/lib/server/inventory";
import { createRazorpayOrder, razorpayConfigured, razorpayKeyId } from "@/lib/integrations/razorpay";

const address = z.object({
  label: z.string().optional(),
  line1: z.string().min(3),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/, "6-digit pincode"),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const schema = z.object({
  source: z.enum(["pos", "website", "zomato"]),
  externalId: z.string().optional().nullable(),
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: address.optional().nullable(),
  }),
  lines: z
    .array(
      z.object({
        menuItemId: z.string(),
        qty: z.number().int().positive().max(50),
        notes: z.string().max(200).optional(),
        unitPriceOverride: z.number().nonnegative().optional(),
      }),
    )
    .min(1),
  discount: z.number().nonnegative().optional(),
  paymentMode: z.enum(["cash", "upi", "card", "online", "zomato", "pay_later"]),
  paymentStatus: z.enum(["pending", "paid"]).optional(),
  deliveryProvider: z.enum(["porter", "zomato", "self", "pickup"]),
  deliveryCharge: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
  /** Customer ticked "send me updates on WhatsApp". */
  notify: z.object({ whatsapp: z.boolean() }).optional(),
});

export const OPTIONS = preflight;

/**
 * Create an order. Staff can create any channel (POS, manual Zomato entry).
 * Customers (website / leafli.in) can only create website orders for
 * themselves, cannot discount, and always start as "new" for kitchen acceptance.
 */
export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req);
  const input = schema.parse(await req.json());
  const isStaff = STAFF.includes(actor.role);
  if (!isStaff) {
    if (input.source !== "website") throw new HttpError(403, "Customers can only place website orders");
    if (input.deliveryProvider === "porter" || input.deliveryProvider === "self") {
      if (!input.customer.address) throw new HttpError(400, "A delivery address is required");
    }
    Object.assign(input, {
      discount: 0,
      deliveryCharge: undefined,
      paymentStatus: "pending",
      externalId: null,
      lines: input.lines.map(({ unitPriceOverride: _ignored, ...l }) => l),
    });
    if (!["online", "pay_later"].includes(input.paymentMode)) input.paymentMode = "pay_later";
  }
  if (input.paymentMode === "online" && !razorpayConfigured())
    throw new HttpError(503, "Online payment isn't available right now — choose pay on delivery");
  const order = await createOrder(
    {
      ...input,
      customerUid: isStaff ? null : actor.uid,
      autoAccept: isStaff && input.source === "pos",
    },
    actor,
  );
  // Online payment: open a Razorpay order for the server-computed total.
  if (input.paymentMode === "online" && !order.duplicate) {
    let rzp;
    try {
      rzp = await createRazorpayOrder(order.total, order.orderNo, { leafliOrderId: order.id, orderNo: order.orderNo });
    } catch (e) {
      // Don't leave an order that can never be paid; the customer just tries again.
      await setOrderStatus(order.id, "cancelled", actor, "Online payment could not be started").catch(() => {});
      await col.logs().add({ provider: "razorpay", direction: "out", orderId: order.id, error: String(e), at: Date.now() });
      throw new HttpError(502, "We couldn't start the online payment. Please try again or choose pay on delivery.");
    }
    await col.orders().doc(order.id).update({ payment: { provider: "razorpay", rzpOrderId: rzp.id } });
    return withCors(
      req,
      Response.json({
        ...order,
        checkout: { keyId: razorpayKeyId(), rzpOrderId: rzp.id, amount: rzp.amount, currency: rzp.currency },
      }),
    );
  }
  // Pay-later website orders are live straight away: alert the kitchen.
  if (!order.duplicate && order.status === "new") {
    await notifyNewOrder(order);
    await onOrderLive(order.id);
  }
  return withCors(req, Response.json(order));
});
